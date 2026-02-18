/**
 * Better Notion MCP Server
 * Using composite tools for human-friendly AI agent interactions
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools/registry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export async function initServer() {
  // Get Notion token from environment
  const notionToken = process.env.NOTION_TOKEN

  if (!notionToken) {
    console.error('NOTION_TOKEN environment variable is required')
    console.error('Get your token from https://www.notion.so/my-integrations')
    process.exit(1)
  }

  // Create MCP server
  const server = new Server(
    {
      name: '@n24q02m/better-notion-mcp',
      version: getVersion()
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  )

  // Register composite tools
  registerTools(server, notionToken)

  // Connect stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
