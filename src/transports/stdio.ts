/**
 * Stdio Transport
 * Reads NOTION_TOKEN from env, creates singleton Notion client, connects via stdio
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@notionhq/client'
import { NotionMCPError } from '../tools/helpers/errors.js'
import { createMCPServer } from '../create-server.js'

export async function startStdio() {
  const notionToken = process.env.NOTION_TOKEN

  let notionClientFactory: () => Client

  if (notionToken) {
    const notion = new Client({ auth: notionToken, notionVersion: '2025-09-03' })
    notionClientFactory = () => notion
  } else {
    console.error('Warning: NOTION_TOKEN not set. help and content_convert tools available; other tools will show setup instructions.')
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
