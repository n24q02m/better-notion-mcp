/**
 * HTTP Transport -- Local OAuth 2.1 mode via `@n24q02m/mcp-core`.
 *
 * Uses `runLocalServer` from mcp-core which:
 *  - Serves the credential form on /authorize (rendered from RELAY_SCHEMA)
 *  - Stores the Notion token encrypted on disk via the onCredentialsSaved callback
 *  - Issues a local JWT on /token (PKCE) that the MCP client uses for Bearer auth
 *  - Routes /mcp (Bearer-protected) to a StreamableHTTPServerTransport
 *
 * Token lifecycle: on startup we check env/encrypted-config; if neither has a
 * token the server still starts (degraded mode). Tools that require a token
 * throw NotionMCPError with instructions pointing the user at /authorize.
 * Once the user submits the form, onCredentialsSaved writes the token so
 * subsequent tool calls succeed without restart.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type RelayConfigSchema, runLocalServer } from '@n24q02m/mcp-core'
import { Client } from '@notionhq/client'
import { createMCPServer } from '../create-server.js'
import { getNotionToken, resolveCredentialState } from '../credential-state.js'
import { RELAY_SCHEMA } from '../relay-schema.js'
import { NotionMCPError } from '../tools/helpers/errors.js'

const SERVER_NAME = 'better-notion-mcp'

export async function startHttp() {
  // Resolve persisted credentials first (env var / encrypted config). This
  // populates the credential-state module so the Notion factory can read it.
  await resolveCredentialState()

  // In-memory token cache for this process. Seeded from persisted state and
  // updated when the user completes the credential form.
  let currentToken: string | null = getNotionToken()

  const notionClientFactory = () => {
    if (!currentToken) {
      throw new NotionMCPError(
        'Notion token not configured',
        'NOT_CONFIGURED',
        `Open /authorize on this server in your browser to paste your Notion integration token. Get a token at https://www.notion.so/my-integrations. Example: NOTION_TOKEN=ntn_xxxxxxxxxxxxx`
      )
    }
    return new Client({ auth: currentToken, notionVersion: '2025-09-03' })
  }

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 0

  const handle = await runLocalServer(
    // createMCPServer returns a Server; runLocalServer only calls .connect()
    // which both Server and McpServer implement identically.
    () => createMCPServer(notionClientFactory) as unknown as McpServer,
    {
      serverName: SERVER_NAME,
      // RELAY_SCHEMA is typed against the relay (multi-schema) surface; the
      // local-oauth-app surface is a strict subset. Cast is safe: fields,
      // key/label/type/placeholder/helpText/helpUrl/required are all present.
      relaySchema: RELAY_SCHEMA as unknown as RelayConfigSchema,
      port,
      onCredentialsSaved: (creds) => {
        const token = creds?.NOTION_TOKEN
        if (typeof token === 'string' && token.length > 0) {
          currentToken = token
          console.error(`[${SERVER_NAME}] Notion token received via /authorize`)
        }
        // Local flow completes immediately; no subsequent steps.
        return null
      }
    }
  )

  console.error(`[${SERVER_NAME}] HTTP mode on http://${handle.host}:${handle.port}/mcp`)
  if (!currentToken) {
    console.error(`[${SERVER_NAME}] Open http://${handle.host}:${handle.port}/authorize to configure your Notion token`)
  }

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      await handle.close()
      resolve()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
  })
}
