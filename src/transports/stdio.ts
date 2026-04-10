/**
 * Stdio Transport
 * Non-blocking startup: resolves credentials fast (<50ms), starts MCP server immediately.
 * Relay setup is triggered lazily when a token-requiring tool is called without credentials.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@notionhq/client'
import { createMCPServer } from '../create-server.js'
import {
  getNotionToken,
  getSetupUrl,
  getState,
  resolveCredentialState,
  triggerRelaySetup
} from '../credential-state.js'
import { NotionMCPError } from '../tools/helpers/errors.js'

export async function startStdio() {
  // Non-blocking credential resolution (<50ms)
  const state = await resolveCredentialState()

  let notionClientFactory: () => Client

  if (state === 'configured') {
    const token = getNotionToken()!
    const notion = new Client({ auth: token, notionVersion: '2025-09-03' })
    notionClientFactory = () => notion
  } else {
    // Server starts in degraded mode -- help + content_convert available immediately.
    // Token-requiring tools trigger lazy relay setup and return setup instructions.
    console.error(
      'Warning: NOTION_TOKEN not set. help and content_convert tools available; other tools will show setup instructions.'
    )
    console.error('Get your token from https://www.notion.so/my-integrations')

    notionClientFactory = () => {
      // Check if token was acquired via background relay poll since startup
      const currentToken = getNotionToken()
      if (currentToken) {
        return new Client({ auth: currentToken, notionVersion: '2025-09-03' })
      }

      // Trigger relay setup lazily (first tool call without credentials)
      const currentState = getState()
      if (currentState === 'awaiting_setup') {
        // Fire-and-forget relay trigger -- next call will have the URL
        triggerRelaySetup().catch(() => {})
      }

      const setupUrl = getSetupUrl()
      const setupInstructions = setupUrl
        ? `Setup in progress. Open this URL to configure your Notion token:\n${setupUrl}\n\nOr set NOTION_TOKEN manually in your MCP server config.`
        : 'NOTION_TOKEN environment variable is not set. Get your integration token from https://www.notion.so/my-integrations and set it as NOTION_TOKEN in your MCP server config. Example: NOTION_TOKEN=ntn_xxxxxxxxxxxxx'
      throw new NotionMCPError('Notion token not configured', 'NOT_CONFIGURED', setupInstructions)
    }
  }

  const server = createMCPServer(notionClientFactory)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
