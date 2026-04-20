/**
 * HTTP Transport -- dispatches between two modes per MCP matrix:
 *
 *   MCP_MODE=remote-oauth (default) -- runLocalServer with delegatedOAuth
 *     {flow:'redirect', upstream: Notion OAuth}. Per-user Notion tokens stored
 *     by JWT `sub`. This is what the deployed `better-notion-mcp.n24q02m.com`
 *     serves; also the recommended self-host config.
 *
 *   MCP_MODE=local-relay -- runLocalServer with relaySchema (paste integration
 *     token on /authorize). Single-user, no external OAuth. Recommended only
 *     for local development or offline environments.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type RelayConfigSchema, runLocalServer } from '@n24q02m/mcp-core'
import { Client } from '@notionhq/client'
import { NotionTokenStore } from '../auth/notion-token-store.js'
import { createMCPServer } from '../create-server.js'
import { getNotionToken, resolveCredentialState } from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { NotionMCPError } from '../tools/helpers/errors.js'

const SERVER_NAME = 'better-notion-mcp'

export const subjectContext = new AsyncLocalStorage<{ sub: string }>()

export type HttpMode = 'remote-oauth' | 'local-relay'

export function resolveHttpMode(env: NodeJS.ProcessEnv): HttpMode {
  const raw = env.MCP_MODE?.toLowerCase().trim()
  if (raw === 'local-relay' || raw === 'remote-oauth') return raw
  return 'remote-oauth'
}

export async function startHttp(): Promise<void> {
  const mode = resolveHttpMode(process.env)
  await resolveCredentialState()

  const tokenStore = new NotionTokenStore()
  let localToken: string | null = getNotionToken()

  const notionClientFactory = () => {
    if (mode === 'remote-oauth') {
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
    if (!localToken) {
      throw new NotionMCPError(
        'Notion integration token not configured',
        'NOT_CONFIGURED',
        'Open /authorize on this server in your browser to paste your Notion integration token.'
      )
    }
    return new Client({ auth: localToken, notionVersion: '2025-09-03' })
  }

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0
  const host = process.env.HOST

  let handle: Awaited<ReturnType<typeof runLocalServer>>
  if (mode === 'remote-oauth') {
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID
    const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET are required for remote-oauth mode.')
    }
    handle = await runLocalServer(() => createMCPServer(notionClientFactory) as unknown as McpServer, {
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
        onTokenReceived: (tokens) => {
          const accessToken = String(tokens.access_token ?? '')
          const sub = String((tokens as { owner_user_id?: string }).owner_user_id ?? 'default')
          if (accessToken) tokenStore.save(sub, accessToken)
        }
      },
      authScope: async (claims, next) => {
        const sub = typeof claims.sub === 'string' ? claims.sub : 'default'
        await subjectContext.run({ sub }, next)
      }
    })
    console.error(`[${SERVER_NAME}] remote-oauth mode on http://${handle.host}:${handle.port}/mcp`)
  } else {
    handle = await runLocalServer(() => createMCPServer(notionClientFactory) as unknown as McpServer, {
      serverName: SERVER_NAME,
      port,
      host,
      relaySchema: RELAY_SCHEMA as unknown as RelayConfigSchema,
      onCredentialsSaved: (creds) => {
        const token = creds?.NOTION_TOKEN
        if (typeof token === 'string' && token.length > 0) {
          localToken = token
          console.error(`[${SERVER_NAME}] Notion token received via /authorize`)
        }
        return null
      }
    })
    console.error(`[${SERVER_NAME}] local-relay mode on http://${handle.host}:${handle.port}/mcp`)
    if (!localToken) {
      console.error(`[${SERVER_NAME}] Open http://${handle.host}:${handle.port}/authorize to paste your Notion token`)
    }
  }

  await new Promise<void>((resolve) => {
    const shutdown = async (): Promise<void> => {
      await handle.close()
      resolve()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}
