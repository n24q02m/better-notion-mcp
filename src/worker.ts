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

// Bearer credential presence check. Structural only -- validity is the container's job.
const BEARER = /^Bearer\s+\S/i

function unauthenticated(request: Request): Response {
  const { origin } = new URL(request.url)
  return new Response(null, {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`
    }
  })
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
    // Edge auth gate. mcp-core's OAuth AS runs INSIDE the container, so before this
    // gate every anonymous /mcp request started the container and reset its 5m idle
    // timer -- an unauthenticated caller could pin it awake and bill GiB-s around the
    // clock. Verified 2026-07-09: a python-httpx client POSTed /mcp with no
    // Authorization header every ~20s for 12h+. The check is STRUCTURAL: it rejects
    // requests carrying no bearer credential at all and reproduces the container's own
    // 401 (empty body + RFC 9728 WWW-Authenticate). Token VALIDITY is never judged
    // here -- the container remains the sole authority, so no mcp-core auth logic is
    // duplicated at the edge.
    const url = new URL(request.url)
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      if (!BEARER.test(request.headers.get('authorization') ?? '')) return unauthenticated(request)
    }
    // Standing GET /mcp = the streamable-HTTP server-push SSE stream. On a
    // scale-to-zero container this is pure idle cost: @cloudflare/containers
    // counts an open stream as an in-flight request forever (inflight > 0 =>
    // activity never expires), so a single idle client pins the container
    // awake 24/7. None of this stack's servers send server-initiated
    // messages; request-scoped notifications ride the POST's own SSE
    // response. The spec allows declining the stream: both official SDKs
    // treat 405 as the optional-feature path and continue POST-only.
    if (request.method === 'GET' && (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/'))) {
      return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } })
    }
    if (env.NOTION) {
      const userId = await extractUserId()
      const stub = env.NOTION.get(env.NOTION.idFromName(userId))
      return stub.fetch(request)
    }
    return new Response('not found', { status: 404 })
  }
}

async function extractUserId(): Promise<string> {
  // SINGLE-DO COLLAPSE (2026-06-30): route EVERY request (OAuth /authorize,
  // /token, /.well-known AND every sub's /mcp) to the one reserved "default"
  // Durable Object. Under max_instances=1 (locked solo-dev cost rule) the prior
  // per-sub-DO routing DEADLOCKED: the OAuth flow (no Bearer) warmed DO "default"
  // while the first /mcp (Bearer sub) needed DO "<sub>" -- a 2nd container that
  // cannot spawn under max=1 ("Maximum number of running container instances
  // exceeded" 500). Safe: the container is STATELESS -- per-sub data is
  // externalised (D1 sub-column / Vectorize sub-filter / KV) keyed by the Bearer
  // JWT sub, so one container serves all subs with no leakage. (Trade-off: one
  // shared container for all subs; fine for solo / low concurrency.)
  return 'default'
}

// Per-user container Durable Object. wrangler.jsonc binds NOTION to this class
// and runs the registry.cloudflare.com/<ACCOUNT_ID>/better-notion-mcp:beta image;
// one instance per JWT sub. The container's HTTP server listens on 8080
// (Dockerfile http target: PORT=8080 + EXPOSE 8080).
export class NotionContainer extends Container<Env> {
  defaultPort = 8080
  sleepAfter = '5m'
  // Port-readiness probe used by @cloudflare/containers' waitForPort(): it does
  // tcpPort.fetch('http://' + pingEndpoint) against the container's bound port, so the
  // host segment is only a Host header (no DNS) and ANY HTTP response marks the port
  // ready. We point it at /health because core-ts serves a cheap 200 there while '/'
  // 302-redirects into the OAuth app. This does NOT drive the platform's `healthy`
  // metric -- see the edge auth gate above for the real cause of containers never sleeping.
  pingEndpoint = 'localhost/health'
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
