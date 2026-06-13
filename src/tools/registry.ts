/**
 * Tool Registry - 10 Composite Tools
 * Consolidated registration for maximum coverage with minimal tools
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { buildOpenRelayHandler } from '@n24q02m/mcp-core'
import type { Client } from '@notionhq/client'
import { getState } from '../credential-state.js'
// Import mega tools
import { blocks } from './composite/blocks.js'
import { commentsManage } from './composite/comments.js'
import { config } from './composite/config.js'
import { contentConvert } from './composite/content.js'
import { databases } from './composite/databases.js'
import { fileUploads } from './composite/file-uploads.js'
import { pages } from './composite/pages.js'
import { users } from './composite/users.js'
import { workspace } from './composite/workspace.js'
import { TOKEN_FREE_TOOLS, TOOLS, VALID_HELP_TOOL_NAMES, VALID_HELP_TOOLS_STRING } from './definitions.js'
import { aiReadableMessage, findClosestMatch, NotionMCPError } from './helpers/errors.js'
import { wrapToolResult } from './helpers/security.js'
import { getToolDocumentation, registerResourceHandlers } from './resources.js'

// publicUrl is null in stdio mode (no relay form to open). HTTP mode
// substitutes it with PUBLIC_URL so the tool returns a valid /authorize URL.
const openRelayHandler = buildOpenRelayHandler({
  serverName: 'better-notion-mcp',
  publicUrl: process.env.PUBLIC_URL ?? null
})

/**
 * Register all tools with MCP server
 * @param notionClientFactory - Returns a Notion Client.
 *   Called per tool invocation to support both singleton (stdio) and per-request (HTTP) patterns.
 */
export function registerTools(server: Server, notionClientFactory: () => Client) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }))

  // Register handlers for documentation resources
  registerResourceHandlers(server)

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await handleCallTool(request.params, notionClientFactory)
  })
}

/**
 * Main tool execution dispatcher
 */
async function handleCallTool(
  params: { name: string; arguments?: Record<string, any> },
  notionClientFactory: () => Client
) {
  const { name, arguments: args } = params

  if (!args) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: No arguments provided'
        }
      ],
      isError: true
    }
  }

  // Credential guard. In stdio mode the server exits at startup if
  // NOTION_TOKEN is missing (see main.ts startServer('stdio')); reaching
  // this branch means HTTP mode where the per-subject token store is
  // empty for the current caller. help and content_convert work without
  // a token.
  if (!TOKEN_FREE_TOOLS.has(name)) {
    const credState = getState()
    if (credState !== 'configured') {
      const publicUrl = process.env.PUBLIC_URL
      const setupInstructions = publicUrl
        ? `Notion access token is not present for this session. Open ${publicUrl}/authorize in your browser to complete the Notion OAuth flow, then retry the tool.`
        : 'Notion access token is not present. In stdio mode set NOTION_TOKEN env var (https://www.notion.so/my-integrations). In HTTP mode complete the OAuth flow at <PUBLIC_URL>/authorize.'
      return {
        content: [{ type: 'text', text: setupInstructions }],
        isError: true
      }
    }
  }

  try {
    let result
    const notion = notionClientFactory()

    switch (name) {
      case 'pages':
        result = await pages(notion, args as any)
        break
      case 'databases':
        result = await databases(notion, args as any)
        break
      case 'blocks':
        result = await blocks(notion, args as any)
        break
      case 'users':
        result = await users(notion, args as any)
        break
      case 'workspace':
        result = await workspace(notion, args as any)
        break
      case 'comments':
        result = await commentsManage(notion, args as any)
        break
      case 'content_convert':
        result = await contentConvert(args as any)
        break
      case 'config':
        result = await config(args as any)
        break
      case 'config__open_relay':
        result = await openRelayHandler()
        break
      case 'file_uploads':
        result = await fileUploads(notion, args as any)
        break
      case 'help': {
        const toolName = (args as { tool_name: string }).tool_name
        // Security: validate tool_name against allowlist to prevent path traversal
        if (!VALID_HELP_TOOL_NAMES.has(toolName)) {
          throw new NotionMCPError(
            `Invalid tool name: ${toolName}`,
            'VALIDATION_ERROR',
            `Valid tools: ${VALID_HELP_TOOLS_STRING}`
          )
        }

        const documentation = await getToolDocumentation(toolName)
        result = { tool: toolName, documentation }
        break
      }
      default: {
        const validTools = TOOLS.map((t) => t.name)
        const closest = findClosestMatch(name, validTools)
        const suggestion = closest ? ` Did you mean '${closest}'?` : ''
        throw new NotionMCPError(
          `Unknown tool: ${name}.${suggestion}`,
          'UNKNOWN_TOOL',
          `Available tools: ${validTools.join(', ')}`
        )
      }
    }

    const jsonText = JSON.stringify(result, null, 2)
    return {
      content: [
        {
          type: 'text',
          text: wrapToolResult(name, jsonText)
        }
      ]
    }
  } catch (error) {
    const enhancedError =
      error instanceof NotionMCPError
        ? error
        : new NotionMCPError((error as Error).message, 'TOOL_ERROR', 'Check the error details and try again')

    return {
      content: [
        {
          type: 'text',
          text: aiReadableMessage(enhancedError)
        }
      ],
      isError: true
    }
  }
}
