import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NotionTokenStore } from '../auth/notion-token-store.js'
import { selectTokenStore } from './http.js'

describe('CREDENTIAL_SECRET -> EdDSA signing (deterministic, no-disk)', () => {
  it('JWTIssuer selects EdDSA when CREDENTIAL_SECRET is set, RS256 when unset', async () => {
    const { JWTIssuer } = await import('@n24q02m/mcp-core')
    const withSecret = new JWTIssuer('better-notion-mcp', undefined, 'test-secret')
    const withoutSecret = new JWTIssuer('better-notion-mcp', undefined, null)
    expect(withSecret.alg).toBe('EdDSA')
    expect(withoutSecret.alg).toBe('RS256')
  })

  it('two issuers from the same CREDENTIAL_SECRET converge on the same signing key (survives recreate)', async () => {
    const { JWTIssuer } = await import('@n24q02m/mcp-core')
    const a = new JWTIssuer('better-notion-mcp', undefined, 'stable-secret')
    await a.init()
    const token = await a.issueAccessToken('user@example.com')
    // simulate container recreate: a fresh issuer derived from the same secret
    const b = new JWTIssuer('better-notion-mcp', undefined, 'stable-secret')
    await b.init()
    const payload = await b.verifyAccessToken(token)
    expect(payload.sub).toBe('user@example.com')
  })

  it('http transport documents the CREDENTIAL_SECRET requirement for EdDSA', () => {
    const src = readFileSync('src/transports/http.ts', 'utf-8')
    expect(src).toContain('CREDENTIAL_SECRET')
  })
})

describe('per-sub token isolation (anonymous-bucket-collapse guard)', () => {
  it('distinct JWT subs keep distinct Notion tokens (no bleed)', () => {
    const store = new NotionTokenStore()
    store.save('alice', 'ntn_alice')
    store.save('bob', 'ntn_bob')
    expect(store.get('alice')).toBe('ntn_alice')
    expect(store.get('bob')).toBe('ntn_bob')
    expect(store.get('alice')).not.toBe(store.get('bob'))
  })

  it('the wrangler deploy config never enables MCP_AUTH_DISABLE on shared infra', () => {
    const raw = readFileSync('wrangler.jsonc', 'utf-8')
    // The guard is a literal absence: MCP_AUTH_DISABLE must not appear as an
    // enabled var. (If ever needed for a private self-host, it is the operator's
    // opt-in, never on *.n24q02m.com.)
    expect(/"MCP_AUTH_DISABLE"\s*:\s*"1"/.test(raw)).toBe(false)
  })
})

describe('token store selection', () => {
  it('selects KvNotionTokenStore when MCP_STORAGE_BACKEND=cf-kv', async () => {
    process.env.MCP_STORAGE_BACKEND = 'cf-kv'
    process.env.MCP_KV_BASE_URL = 'http://kv.internal'
    const { KvNotionTokenStore } = await import('../auth/notion-token-store-kv.js')
    expect(selectTokenStore()).toBeInstanceOf(KvNotionTokenStore)
    delete process.env.MCP_STORAGE_BACKEND
  })

  it('selects the in-memory NotionTokenStore otherwise', async () => {
    delete process.env.MCP_STORAGE_BACKEND
    expect(selectTokenStore()).toBeInstanceOf(NotionTokenStore)
  })
})

describe('sleepAfter eviction vs lock-refresh interval (CRITIC)', () => {
  it('the worker DO sets sleepAfter=1h (eviction is safe; worker adds no own timer)', () => {
    // A slept DO stops the mcp-core lock-refresh timer, which is safe because
    // (a) mcp-core unref()s it so it never blocks, and (b) the lock file is
    // ephemeral and re-swept on next boot. Assert the worker does not try to
    // defeat eviction with its own timer, and keeps the 1h sleep window.
    // (worker.ts is excluded from the main tsconfig project, so assert against
    // its source text rather than importing it across the project boundary.)
    const src = readFileSync('src/worker.ts', 'utf-8')
    expect(src).not.toContain('setInterval')
    expect(src).toContain("sleepAfter = '1h'")
  })
})
