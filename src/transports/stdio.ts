/**
 * Stdio Transport
 * Reads NOTION_TOKEN from env, creates singleton Notion client, connects via stdio
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@notionhq/client'
import { createMCPServer } from '../create-server.js'

export async function startStdio() {
  const notionToken = process.env.NOTION_TOKEN

  if (!notionToken) {
    console.error('NOTION_TOKEN environment variable is required')
    console.error('Get your token from https://www.notion.so/my-integrations')
    process.exit(1)
  }

  const notion = new Client({ auth: notionToken, notionVersion: '2025-09-03' })
  const server = createMCPServer(() => notion)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
