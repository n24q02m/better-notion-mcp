// src/worker.ts
// Worker fronting the better-notion-mcp container Durable Object.
//
// Two distinct request paths:
//  - INBOUND: requests on the custom domain hit the default export `fetch`,
//    which routes them to the per-user NotionContainer Durable Object.
//  - OUTBOUND: the container calls http://kv.internal/... which is intercepted
//    by the `@cloudflare/containers` proxy and dispatched to the
//    `NotionContainer.outboundByHost` handlers below, serviced from the Worker's
//    KV binding. enableInternet=true lets every OTHER host (api.notion.com)
//    reach the public internet.
//
// notion is KV-only: it has no docs DB and no vectors, so the d1.internal /
// vectorize.internal handlers from the wet template are intentionally dropped.
import { Container, ContainerProxy, type OutboundHandler } from '@cloudflare/containers'
import { JWTIssuer } from '@n24q02m/mcp-core'

// ContainerProxy must be re-exported from the Worker entrypoint: the containers
// runtime discovers it via `ctx.exports.ContainerProxy` to route the container's
// intercepted outbound traffic (kv.internal) back into the Worker. Without this
// re-export, applyOutboundInterception() throws at container start.
export { ContainerProxy }

export interface Env {
  KV: {
    get(k: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
    get(k: string): Promise<string | null>
    put(k: string, v: string | ArrayBuffer): Promise<void>
    delete(k: string): Promise<void>
  }
  NOTION?: { idFromName(n: string): unknown; get(id: unknown): { fetch(r: Request): Promise<Response> } }
  // Container config (wrangler.jsonc `vars`) + secrets (`wrangler secret put`),
  // forwarded into the container process via NotionContainer.envVars.
  MCP_TRANSPORT: string
  MCP_STORAGE_BACKEND: string
  MCP_KV_BASE_URL: string
  PUBLIC_URL: string
  PORT: string
  // mcp-core core-ts defaults the listen host to 127.0.0.1 (local-server.ts).
  // The CF container is reachable only when the server binds 0.0.0.0:8080, so
  // HOST=0.0.0.0 is forwarded (matching the OCI VM compose). Without it the
  // container "is not listening in the TCP address 10.0.0.1:8080".
  HOST: string
  CREDENTIAL_SECRET: string
  // Gate A (shared relay-password front door). Forwarding it gates /authorize
  // behind /login like the OCI VM; omitting it leaves an open self-service relay
  // even though the OAuth step itself is delegated to Notion.
  MCP_RELAY_PASSWORD: string
  NOTION_OAUTH_CLIENT_ID: string
  NOTION_OAUTH_CLIENT_SECRET: string
}

// Keys forwarded from the Worker env (wrangler vars + secrets) into the container
// process. Unset/empty values are dropped so an unused optional secret never
// injects a blank. Exported for the env-forwarding regression test (HOST must
// stay in the list or the container binds 127.0.0.1 and CF can't reach it).
export const CONTAINER_ENV_KEYS = [
  'MCP_TRANSPORT',
  'MCP_STORAGE_BACKEND',
  'MCP_KV_BASE_URL',
  'PUBLIC_URL',
  'PORT',
  'HOST',
  'CREDENTIAL_SECRET',
  'MCP_RELAY_PASSWORD',
  'NOTION_OAUTH_CLIENT_ID',
  'NOTION_OAUTH_CLIENT_SECRET'
] as const

// CF Containers readiness-probe target (NotionContainer.pingEndpoint). The
// default 'ping' hits path '/', which the delegated-OAuth server 302-redirects
// through /authorize to api.notion.com (https) — the redirect-following probe
// then dies on the https hop. The well-known doc answers 200 with no redirect.
// Exported so the regression test pins it away from the default.
export const CONTAINER_PING_ENDPOINT = 'ping/.well-known/oauth-protected-resource'

function pickContainerEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of CONTAINER_ENV_KEYS) {
    const v = (env as unknown as Record<string, unknown>)[k]
    if (typeof v === 'string' && v !== '') out[k] = v
  }
  return out
}

// --- Outbound handler (container -> Worker KV binding) ----------------------
// Runs when the container makes an outbound HTTP request to kv.internal. Wired
// via `NotionContainer.outboundByHost` (assignment, NOT a class field) so the
// assignment hits the inherited setter and populates the package's module-level
// handler registry. A `static outboundByHost = {...}` field would use
// define-semantics, bypass the setter, and silently fall through to the public
// internet (kv.internal -> NXDOMAIN).

const kvOutbound: OutboundHandler<Env> = async (request, env) => {
  const url = new URL(request.url)
  const key = decodeURIComponent(url.pathname.replace(/^\//, ''))
  // Readiness probe (E.1): once this handler answers, outbound interception is
  // wired, so the container's first credential PUT is safe. Reserved key,
  // checked before the normal key lookup so it never shadows a real KV key.
  // Security (Sentinel): restrict KV access to the app's own namespace.
  // Directly mapping untrusted paths to KV keys is a vulnerability (E.3).
  if (key !== '__ready' && (!key.startsWith('better-notion/') || key.includes('/../') || key.includes('/..'))) {
    return new Response('forbidden: invalid KV key prefix', { status: 403 })
  }
  if (request.method === 'GET' && key === '__ready') {
    return Response.json({ ready: true })
  }
  if (request.method === 'GET') {
    // Credential blobs are binary (nonce + AES-GCM ciphertext); read/write as
    // ArrayBuffer so bytes round-trip without UTF-8 corruption.
    const v = await env.KV.get(key, 'arrayBuffer')
    return v === null ? new Response('', { status: 404 }) : new Response(v, { status: 200 })
  }
  if (request.method === 'PUT') {
    await env.KV.put(key, await request.arrayBuffer())
    return new Response('', { status: 200 })
  }
  if (request.method === 'DELETE') {
    await env.KV.delete(key)
    return new Response('', { status: 200 })
  }
  return new Response('method not allowed', { status: 405 })
}

// Outbound handler registry, keyed by internal hostname. Production container
// outbound (kv.internal) reaches these via @cloudflare/containers' ContainerProxy
// + the NotionContainer.outboundByHost assignment below — NOT via the public
// `fetch` export. Exported so unit tests can invoke a handler directly instead of
// routing an internal-host request through the public entrypoint. notion is
// KV-only (no D1/Vectorize handlers).
export const OUTBOUND_BY_HOST: Record<string, OutboundHandler<Env>> = {
  'kv.internal': kvOutbound
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Public entrypoint: ONLY routes inbound requests to the per-user container
    // DO. The kv.internal outbound handler is deliberately NOT dispatched here —
    // exposing it on the public fetch surface would let an external caller
    // (request hostname spoofed to kv.internal) read/write/delete the credential
    // KV namespace unauthenticated. Production container outbound reaches it via
    // @cloudflare/containers' ContainerProxy + the NotionContainer.outboundByHost
    // registry below; unit tests call the handlers directly via the
    // OUTBOUND_BY_HOST export.
    if (env.NOTION) {
      const userId = await extractUserId(request, env)
      const stub = env.NOTION.get(env.NOTION.idFromName(userId))
      return stub.fetch(request)
    }
    return new Response('not found', { status: 404 })
  }
}

async function extractUserId(request: Request, env: Env): Promise<string> {
  // JWT sub from the Bearer token (verified by mcp-core OAuth middleware in the
  // container). SINGLE-USER CONTRACT (E.2): no token or no `sub` -> the reserved
  // id "default", so setup and serving collapse onto ONE Durable Object id and
  // the credential write+read avoid a cross-colo KV hop. Per-`sub` tokens get
  // their own isolated DO (multi-user). Downstream servers MUST keep this.
  const auth = request.headers.get('authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/)
  if (!m) return 'default'

  const jwt = m[1]
  try {
    // If CREDENTIAL_SECRET is set, we MUST verify the signature. mcp-core's
    // JWTIssuer handles the EdDSA verification when provided with the secret.
    // (Without a secret, it falls back to RS256; on CF, a missing secret means
    // it can't verify the deterministic EdDSA tokens it issued previously.)
    if (env.CREDENTIAL_SECRET) {
      const issuer = new JWTIssuer('better-notion-mcp', undefined, env.CREDENTIAL_SECRET)
      await issuer.init()
      const claims = await issuer.verifyAccessToken(jwt)
      return typeof claims.sub === 'string' ? claims.sub : 'default'
    }

    // Fallback for local development or setups without a secret: unverified extraction.
    const payload = JSON.parse(atob(jwt.split('.')[1] ?? ''))
    return typeof payload.sub === 'string' ? payload.sub : 'default'
  } catch {
    return 'default'
  }
}

// Per-user container Durable Object. wrangler.jsonc binds NOTION to this class
// and runs the registry.cloudflare.com/<ACCOUNT_ID>/better-notion-mcp:beta image;
// one instance per JWT sub. The container's HTTP server listens on 8080
// (Dockerfile http target: PORT=8080 + EXPOSE 8080).
export class NotionContainer extends Container<Env> {
  defaultPort = 8080
  sleepAfter = '5m'
  // Readiness-probe path override (see CONTAINER_PING_ENDPOINT): the default
  // 'ping' redirect-chains through delegated Notion OAuth to an external https
  // URL and breaks the CF container health check.
  pingEndpoint = CONTAINER_PING_ENDPOINT
  // The container reaches api.notion.com over the public internet; kv.internal
  // stays intercepted (see outboundByHost).
  enableInternet = true
  // Forward Worker config (vars) + secrets into the container process. Without
  // this, CREDENTIAL_SECRET is unset and JWTIssuer falls back to RS256-on-disk
  // (ephemeral FS) -> OAuth identity breaks across container recreation.
  envVars = pickContainerEnv(this.env)
}

// Register outbound interception. MUST be an assignment (invokes the inherited
// `static set outboundByHost`) — a class field would bypass the setter. Reuses
// OUTBOUND_BY_HOST so the proxy registry and the direct fetch dispatch are one
// source of truth (footgun #1: assignment, never a static field). KV-only: no
// d1.internal / vectorize.internal.
NotionContainer.outboundByHost = OUTBOUND_BY_HOST as Record<string, OutboundHandler>
