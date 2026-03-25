/**
 * Stdio Transport
 * Reads NOTION_TOKEN from env or relay config, creates singleton Notion client, connects via stdio
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@notionhq/client'
import { createMCPServer } from '../create-server.js'
import { ensureConfig } from '../relay-setup.js'
import { NotionMCPError } from '../tools/helpers/errors.js'

export async function startStdio() {
  let notionToken = process.env.NOTION_TOKEN

  // If NOTION_TOKEN is not set, try relay config resolution
  if (!notionToken) {
    const relayToken = await ensureConfig()
    if (relayToken) {
      notionToken = relayToken
    }
  }

  let notionClientFactory: () => Client

  if (notionToken) {
    const notion = new Client({ auth: notionToken, notionVersion: '2025-09-03' })
    notionClientFactory = () => notion
  } else {
    console.error(
      'Warning: NOTION_TOKEN not set. help and content_convert tools available; other tools will show setup instructions.'
    )
    console.error('Get your token from https://www.notion.so/my-integrations')
    notionClientFactory = () => {
      throw new NotionMCPError(
        'NOTION_TOKEN environment variable is not set',
        'NOT_CONFIGURED',
        'Get your integration token from https://www.notion.so/my-integrations and set it as NOTION_TOKEN in your MCP server config. Example: NOTION_TOKEN=ntn_xxxxxxxxxxxxx'
      )
    }
  }

  const server = createMCPServer(notionClientFactory)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
