#!/usr/bin/env node
// cf-deploy.mjs - config-only `wrangler deploy` for the live CF Worker+Container.
//
// The committed wrangler.jsonc keeps three deploy-time placeholders out of git so
// no live resource IDs (or an env-specific public URL) are checked in:
//   - <YOUR_ACCOUNT_ID>              in the container image ref
//   - <better-notion-kv-namespace-id> in the KV binding
//   - <YOUR_PUBLIC_URL>              in vars.PUBLIC_URL (worker base URL)
// This script substitutes all three into a throwaway, gitignored wrangler.deploy.jsonc
// (deleted after the run) and runs `wrangler deploy` against it, so the committed
// wrangler.jsonc stays clean.
//
// It does NOT build or push an image: it reuses the already-pushed container
// tag referenced in wrangler.jsonc (`:beta`) and ships only the Worker bundle +
// container config (instance_type / max_instances / sleepAfter). Use
// scripts/deploy_cf.py for a full build+push+canary rollout.
//
// Required env:
//   CLOUDFLARE_API_TOKEN   - CF API token (any secret manager works)
//   CLOUDFLARE_ACCOUNT_ID  - substituted for <YOUR_ACCOUNT_ID>
//   PUBLIC_URL             - substituted for <YOUR_PUBLIC_URL> (worker base URL)
// Optional env:
//   CF_KV_NAMESPACE_ID     - substituted for <better-notion-kv-namespace-id>
//                            (defaults to the live "KV" namespace below)
//
// The committed wrangler.jsonc declares a `routes` custom_domain block, but the
// custom domain (notion.n24q02m.com) is attached out-of-band and re-asserting it
// needs zone-level workers_routes edit (which the project/infra deploy token does
// not carry). This is config-only, so the routes block is stripped from the
// deploy copy; the live route is untouched.
//
// Pass --dry-run (or `bun run cf:dryrun`) to substitute + print the plan without
// deploying.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... bun run cf:deploy
//   CLOUDFLARE_ACCOUNT_ID=... bun run cf:dryrun
//   # or, injecting the token from skret:
//   MSYS_NO_PATHCONV=1 skret run -e dev --path=/n24q02m/dev -- \
//     env CLOUDFLARE_ACCOUNT_ID=<acct> bun run cf:deploy

import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const dryRun = process.argv.includes('--dry-run')

// wrangler resolves `main` (src/worker.ts) + the src tree relative to the config
// file's directory, so the resolved config must live in the repo root, not an
// OS temp dir. Use the gitignored wrangler.deploy.jsonc name and delete it after.
const DEPLOY_CONFIG = 'wrangler.deploy.jsonc'

// Live "KV" namespace id (title "KV", account 53feac446...). Public binding id,
// not a secret; overridable via CF_KV_NAMESPACE_ID for forks/other accounts.
const DEFAULT_KV_NAMESPACE_ID = '156ad6a2b7d94298a76ebe11d30510d0'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
if (!accountId) {
  console.error('CLOUDFLARE_ACCOUNT_ID is required (substituted for <YOUR_ACCOUNT_ID>).')
  process.exit(1)
}
if (!dryRun && !process.env.CLOUDFLARE_API_TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is required (wrangler auth).')
  process.exit(1)
}
const kvNamespaceId = process.env.CF_KV_NAMESPACE_ID || DEFAULT_KV_NAMESPACE_ID

const src = readFileSync('wrangler.jsonc', 'utf8')

// PUBLIC_URL is required only while the committed config still carries the
// <YOUR_PUBLIC_URL> placeholder; a BYO fork that hardcodes vars.PUBLIC_URL
// needs no env.
const publicUrl = process.env.PUBLIC_URL
if (src.includes('<YOUR_PUBLIC_URL>') && !publicUrl) {
  console.error('PUBLIC_URL is not set (base wrangler.jsonc uses <YOUR_PUBLIC_URL>).')
  process.exit(1)
}

const resolved = src
  .replaceAll('<YOUR_ACCOUNT_ID>', accountId)
  .replaceAll('<better-notion-kv-namespace-id>', kvNamespaceId)
  .replaceAll('<YOUR_PUBLIC_URL>', publicUrl ?? '')
  // Drop the single-line `"routes": [...],` block: the custom domain is already
  // attached, and this also strips the <YOUR_WORKER_DOMAIN> placeholder so it
  // never reaches wrangler.
  .replace(/^\s*"routes":\s*\[[^\]]*\],?\s*$/m, '')
  // Serve ONLY the custom domain. Without these, wrangler enables a public
  // workers.dev URL + preview URLs by default -> an unintended public surface.
  .replace(/^\{\s*$/m, '{\n  "workers_dev": false,\n  "preview_urls": false,')

if (dryRun) {
  console.log(`cf:dryrun -> would write ${DEPLOY_CONFIG} and run: bunx wrangler deploy --config ${DEPLOY_CONFIG}`)
  if (publicUrl) console.log(`cf:dryrun -> PUBLIC_URL resolved to ${publicUrl}`)
  // Fail loudly if any placeholder survived substitution: an unsubstituted
  // <...> token would otherwise ship literally into the deployed config.
  const leftover = [...new Set(resolved.match(/<[A-Za-z0-9_-]+>/g) ?? [])]
  if (leftover.length > 0) {
    console.error(`cf:dryrun -> unsubstituted placeholder(s) would reach wrangler: ${leftover.join(', ')}`)
    process.exit(1)
  }
  console.log('cf:dryrun -> no unsubstituted placeholders remain (live resource IDs suppressed).')
  process.exit(0)
}

writeFileSync(DEPLOY_CONFIG, resolved, 'utf8')
try {
  console.log(`cf:deploy -> bunx wrangler deploy --config ${DEPLOY_CONFIG}`)
  // wrangler is not a direct dependency; bunx resolves/fetches it (matches
  // scripts/deploy_cf.py). `shell:true` is needed on Windows to launch bunx.
  const r = spawnSync('bunx', ['wrangler', 'deploy', '--config', DEPLOY_CONFIG], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  process.exitCode = r.status ?? 1
} finally {
  // resolved config holds real IDs; never leave it on disk (also gitignored).
  rmSync(DEPLOY_CONFIG, { force: true })
}
