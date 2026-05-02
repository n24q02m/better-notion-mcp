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
 * Required env: NOTION_OAUTH_CLIENT_ID, NOTION_OAUTH_CLIENT_SECRET,
 * DCR_SERVER_SECRET (multi-user JWT signing).
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runHttpServer } from '@n24q02m/mcp-core'
import { Client } from '@notionhq/client'
import { NotionTokenStore } from '../auth/notion-token-store.js'
import { createMCPServer } from '../create-server.js'
import { resolveCredentialState, setState, setSubjectTokenResolver } from '../credential-state.js'
import { NotionMCPError } from '../tools/helpers/errors.js'

const SERVER_NAME = 'better-notion-mcp'

export const subjectContext = new AsyncLocalStorage<{ sub: string }>()

export async function startHttp(): Promise<void> {
  await resolveCredentialState()

  const tokenStore = new NotionTokenStore()

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

  const handle = await runHttpServer(() => createMCPServer(notionClientFactory) as unknown as McpServer, {
    serverName: SERVER_NAME,
    port,
    host,
    delegatedOAuth: {
      flow: 'redirect',
      upstream: {
        authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token',
        clientId,
        clientSecret,
        scopes: []
      },
      onTokenReceived: (tokens: Record<string, unknown>) => {
        const accessToken = String(tokens.access_token ?? '')
        const sub = String((tokens as { owner_user_id?: string }).owner_user_id ?? 'default')
        if (accessToken) tokenStore.save(sub, accessToken)
        // Return sub so mcp-core (>=1.6.2) propagates it into the bearer
        // JWT's `sub` claim, which `authScope` below then matches back
        // to the stored Notion token.
        return sub
      }
    },
    authScope: async (claims: { sub?: unknown }, next: () => Promise<void>) => {
      const sub = typeof claims.sub === 'string' ? claims.sub : 'default'
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
