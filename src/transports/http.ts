/**
 * HTTP Transport -- single remote-oauth multi-user mode.
 *
 * Post stdio-pure + http-multi-user split (2026-05-01): the MCP_MODE flavor
 * (``local-relay`` vs ``remote-oauth``) is gone. HTTP mode is always
 * delegated OAuth 2.1 redirect flow to Notion at
 * ``https://api.notion.com/v1/oauth/authorize`` with per-JWT-sub Notion
 * token storage. Single-user paste-token relay form is no longer supported
 * here -- use stdio mode with NOTION_TOKEN env for single-user setups.
 *
 * Required env: NOTION_OAUTH_CLIENT_ID, NOTION_OAUTH_CLIENT_SECRET.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runHttpServer } from '@n24q02m/mcp-core'
import { Client } from '@notionhq/client'
import { NotionTokenStore, type NotionTokenStoreLike } from '../auth/notion-token-store.js'
import { KvNotionTokenStore } from '../auth/notion-token-store-kv.js'
import { createMCPServer } from '../create-server.js'
import { resolveCredentialState, setState, setSubjectTokenResolver } from '../credential-state.js'
import { NotionMCPError } from '../tools/helpers/errors.js'

const SERVER_NAME = 'better-notion-mcp'

export const subjectContext = new AsyncLocalStorage<{ sub: string }>()

/**
 * Select the per-sub Notion token store. The cf-kv backend -> KV write-through
 * (durable across container recreate; the Cloudflare deployment store). Any other
 * backend (stdio / local single-process) -> in-memory store. Read once at
 * startup; on CF, MCP_STORAGE_BACKEND=cf-kv is set by wrangler vars, so the
 * durable KV store is always selected there.
 */
export function selectTokenStore(): NotionTokenStoreLike {
  if ((process.env.MCP_STORAGE_BACKEND ?? '').toLowerCase() === 'cf-kv') {
    return new KvNotionTokenStore()
  }
  return new NotionTokenStore()
}

/**
 * Derive the JWT subject from the upstream Notion token response.
 *
 * Notion's OAuth token payload identifies the authorizing principal by
 * ``owner.user.id`` (user-level integrations) and ALWAYS carries
 * ``workspace_id`` + ``bot_id``. There is NO ``owner_user_id`` field. Prefer the
 * human user id for per-user isolation, then fall back to the workspace, then
 * the bot, so the JWT ``sub`` (and thus the per-sub Durable Object + KV token
 * bucket) is a stable real identity rather than the shared ``'default'`` bucket
 * — collapsing every caller onto ``'default'`` would silently break multi-user
 * isolation. ``'default'`` is reserved for a malformed response only.
 */
export function deriveSubject(tokens: Record<string, unknown>): string {
  const owner = tokens.owner as { user?: { id?: unknown } } | undefined
  const userId = owner?.user?.id
  if (typeof userId === 'string' && userId) return userId
  const workspaceId = tokens.workspace_id
  if (typeof workspaceId === 'string' && workspaceId) return workspaceId
  const botId = tokens.bot_id
  if (typeof botId === 'string' && botId) return botId
  return 'default'
}

export async function startHttp(): Promise<void> {
  await resolveCredentialState()

  const tokenStore = selectTokenStore()

  // Self-validating deploy: when the durable KV store is selected (Cloudflare),
  // confirm the container -> Worker `kv.internal` outbound path is wired at
  // startup. If it is NOT, the fire path of the first token write would vanish
  // silently and the token would never survive a container recreate. Log the
  // outcome loudly; non-fatal so /authorize still runs, but a broken outbound
  // path is now visible in `wrangler tail` instead of being invisible.
  if (tokenStore.ready) {
    try {
      await tokenStore.ready()
      console.error(`[${SERVER_NAME}] durable KV store reachable (kv.internal outbound wired)`)
    } catch (err) {
      console.error(
        `[${SERVER_NAME}] durable KV store UNREACHABLE at startup: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  const notionClientFactory = () => {
    const ctx = subjectContext.getStore()
    const token = ctx ? tokenStore.get(ctx.sub) : undefined
    if (!token) {
      throw new NotionMCPError(
        'Notion access token not present for this session',
        'NOT_CONFIGURED',
        'Re-authorize via the Notion OAuth flow on /authorize.'
      )
    }
    return new Client({ auth: token, notionVersion: '2025-09-03' })
  }

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0
  const host = process.env.HOST

  const clientId = process.env.NOTION_OAUTH_CLIENT_ID
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET are required for http mode.')
  }

  // MCP_AUTH_DISABLE=1 skips Bearer JWT verification — for deployments behind
  // an external auth boundary (reverse proxy, API gateway like agentgateway).
  // Caller is responsible for upstream auth + providing Notion token via a
  // separate channel (e.g. NOTION_TOKEN env var resolved by tokenStore default).
  const authDisabled = process.env.MCP_AUTH_DISABLE === '1'

  // CF deploy requirement (P3-03): CREDENTIAL_SECRET MUST be set in the
  // container env (wrangler secret put). When set, mcp-core's JWTIssuer derives
  // a deterministic Ed25519 (EdDSA) signing key via HKDF-SHA256 with no disk I/O.
  // Without it, JWTIssuer falls back to RS256 keys persisted to disk on the
  // EPHEMERAL container FS, so OAuth identity breaks on every container recreate.
  // Setting CREDENTIAL_SECRET is the must-do CF fix; no code change is needed
  // here because runHttpServer/createDelegatedOAuthApp already read it from env.

  const handle = await runHttpServer(() => createMCPServer(notionClientFactory) as unknown as McpServer, {
    serverName: SERVER_NAME,
    port,
    host,
    authDisabled,
    delegatedOAuth: {
      flow: 'redirect',
      upstream: {
        authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
        clientId,
        clientSecret,
        scopes: []
      },
      onTokenReceived: async (tokens: Record<string, unknown>) => {
        const accessToken = String(tokens.access_token ?? '')
        const sub = deriveSubject(tokens)
        // Structural breadcrumb (KEY NAMES + derived sub only, NEVER token
        // values) so the Notion token response shape is verifiable in deploy
        // logs without leaking the access token.
        console.error(`[${SERVER_NAME}] onTokenReceived keys=[${Object.keys(tokens).join(',')}] sub=${sub}`)
        // AWAIT the durable write (do not fire-and-forget). The KV store sets
        // its in-memory cache synchronously before the awaited KV PUT, so the
        // same-request factory read still hits the warm cache. mcp-core wraps
        // this callback in try/catch and returns a 500 "Failed to persist
        // tokens" to the browser if it throws — so a broken KV write surfaces
        // at auth time instead of silently losing the token once the in-memory
        // cache evaporates on container recreate.
        if (accessToken) await tokenStore.save(sub, accessToken)
        // Return sub so mcp-core propagates it into the bearer JWT's `sub`
        // claim, which `authScope` below then matches back to the stored token.
        return sub
      }
    },
    authScope: async (claims: { sub?: unknown; anonymous?: unknown }, next: () => Promise<void>) => {
      // Anonymous caller (auth-disabled mode behind gateway): use 'default'
      // bucket so a single deployment can serve one Notion token via env.
      const sub = claims.anonymous === true ? 'default' : typeof claims.sub === 'string' ? claims.sub : 'default'
      // Warm the per-sub cache from the durable store (KV) BEFORE the tool
      // dispatch reads it synchronously via the factory/resolver. After a
      // container delete+recreate the in-memory cache is empty; without this a
      // freshly-recreated container would report no token (forcing needless
      // re-auth) even though the encrypted token is still in KV. No-op for the
      // in-memory store. A KV read failure is treated as a cache miss (re-auth)
      // and never blocks the request.
      try {
        await tokenStore.getAsync(sub)
      } catch {
        // durable read failed -> fall through to cache-miss handling downstream
      }
      await subjectContext.run({ sub }, next)
    }
  })

  // The server is fully configured once OAuth client credentials are
  // validated; per-user Notion tokens live in `tokenStore` keyed by JWT
  // sub. Mark state=configured so `config(action=status)` reflects
  // server readiness.
  setState('configured')
  // Route `getSubjectToken()` to the per-user store so
  // `config(action=status).has_token` reflects whether THIS caller has
  // authorized.
  setSubjectTokenResolver(() => {
    const ctx = subjectContext.getStore()
    return ctx ? (tokenStore.get(ctx.sub) ?? null) : null
  })
  console.error(`[${SERVER_NAME}] http mode on http://${handle.host}:${handle.port}/mcp`)

  await new Promise<void>((resolve) => {
    const shutdown = async (): Promise<void> => {
      await handle.close()
      resolve()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}
