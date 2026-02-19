/**
 * Tool Registry - 7 Mega Tools
 * Consolidated registration for maximum coverage with minimal tools
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { Client } from '@notionhq/client'

// Import mega tools
import { blocks } from './composite/blocks.js'
import { commentsManage } from './composite/comments.js'
import { contentConvert } from './composite/content.js'
import { databases } from './composite/databases.js'
import { pages } from './composite/pages.js'
import { users } from './composite/users.js'
import { workspace } from './composite/workspace.js'
import { aiReadableMessage, NotionMCPError } from './helpers/errors.js'

// Get docs directory path - works for both bundled CLI and unbundled code
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// For bundled CLI: __dirname = /bin/, docs at /build/src/docs/
// For unbundled: __dirname = /build/src/tools/, docs at /build/src/docs/
const DOCS_DIR = __dirname.endsWith('bin')
  ? join(__dirname, '..', 'build', 'src', 'docs')
  : join(__dirname, '..', 'docs')

/**
 * Documentation resources for full tool details
 */
const RESOURCES = [
  { uri: 'notion://docs/pages', name: 'Pages Tool Docs', file: 'pages.md' },
  { uri: 'notion://docs/databases', name: 'Databases Tool Docs', file: 'databases.md' },
  { uri: 'notion://docs/blocks', name: 'Blocks Tool Docs', file: 'blocks.md' },
  { uri: 'notion://docs/users', name: 'Users Tool Docs', file: 'users.md' },
  { uri: 'notion://docs/workspace', name: 'Workspace Tool Docs', file: 'workspace.md' },
  { uri: 'notion://docs/comments', name: 'Comments Tool Docs', file: 'comments.md' },
  { uri: 'notion://docs/content_convert', name: 'Content Convert Tool Docs', file: 'content_convert.md' }
]

/**
 * 7 Mega Tools covering 75% of Official Notion API
 * Compressed descriptions for token optimization (~77% reduction)
 */
const TOOLS = [
  {
    name: 'pages',
    description:
      'Page lifecycle: create, get, update, archive, restore, duplicate. Requires parent_id for create. Returns markdown content for get.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'get', 'update', 'archive', 'restore', 'duplicate'],
          description: 'Action to perform'
        },
        page_id: { type: 'string', description: 'Page ID (required for most actions)' },
        page_ids: { type: 'array', items: { type: 'string' }, description: 'Multiple page IDs for batch operations' },
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Markdown content' },
        append_content: { type: 'string', description: 'Markdown to append' },
        prepend_content: { type: 'string', description: 'Markdown to prepend' },
        parent_id: { type: 'string', description: 'Parent page or database ID' },
        properties: { type: 'object', description: 'Page properties (for database pages)' },
        icon: { type: 'string', description: 'Emoji icon' },
        cover: { type: 'string', description: 'Cover image URL' },
        archived: { type: 'boolean', description: 'Archive status' }
      },
      required: ['action']
    }
  },
  {
    name: 'databases',
    description:
      'Database operations: create, get, query, create_page, update_page, delete_page, create_data_source, update_data_source, update_database. Databases contain data sources with schema and rows.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'create',
            'get',
            'query',
            'create_page',
            'update_page',
            'delete_page',
            'create_data_source',
            'update_data_source',
            'update_database'
          ],
          description: 'Action to perform'
        },
        database_id: { type: 'string', description: 'Database ID (container)' },
        data_source_id: { type: 'string', description: 'Data source ID (for update_data_source action)' },
        parent_id: { type: 'string', description: 'Parent page ID (for create/update_database)' },
        title: { type: 'string', description: 'Title (for database or data source)' },
        description: { type: 'string', description: 'Description' },
        properties: { type: 'object', description: 'Schema properties (for create/update data source)' },
        is_inline: { type: 'boolean', description: 'Display as inline (for create/update_database)' },
        icon: { type: 'string', description: 'Emoji icon (for update_database)' },
        cover: { type: 'string', description: 'Cover image URL (for update_database)' },
        filters: { type: 'object', description: 'Query filters (for query action)' },
        sorts: { type: 'array', items: { type: 'object' }, description: 'Query sorts' },
        limit: { type: 'number', description: 'Max query results' },
        search: { type: 'string', description: 'Smart search across text fields (for query)' },
        page_id: { type: 'string', description: 'Single page ID (for update_page)' },
        page_ids: { type: 'array', items: { type: 'string' }, description: 'Multiple page IDs (for delete_page)' },
        page_properties: { type: 'object', description: 'Page properties to update (for update_page)' },
        pages: { type: 'array', items: { type: 'object' }, description: 'Array of pages for bulk create/update' }
      },
      required: ['action']
    }
  },
  {
    name: 'blocks',
    description:
      'Block-level content: get, children, append, update, delete. Page IDs are valid block IDs. Use for precise edits.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'children', 'append', 'update', 'delete'],
          description: 'Action to perform'
        },
        block_id: { type: 'string', description: 'Block ID' },
        content: { type: 'string', description: 'Markdown content (for append/update)' }
      },
      required: ['action', 'block_id']
    }
  },
  {
    name: 'users',
    description: 'User info: list, get, me, from_workspace. Use from_workspace if list fails due to permissions.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'me', 'from_workspace'],
          description: 'Action to perform'
        },
        user_id: { type: 'string', description: 'User ID (for get action)' }
      },
      required: ['action']
    }
  },
  {
    name: 'workspace',
    description:
      'Workspace: info, search. Search returns pages/databases shared with integration. Use filter.object for type.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['info', 'search'],
          description: 'Action to perform'
        },
        query: { type: 'string', description: 'Search query' },
        filter: {
          type: 'object',
          properties: {
            object: { type: 'string', enum: ['page', 'data_source'] }
          }
        },
        sort: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['ascending', 'descending'] },
            timestamp: { type: 'string', enum: ['last_edited_time', 'created_time'] }
          }
        },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['action']
    }
  },
  {
    name: 'comments',
    description: 'Comments: list, create. Use page_id for new discussion, discussion_id for replies.',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Page ID' },
        discussion_id: { type: 'string', description: 'Discussion ID (for replies)' },
        action: { type: 'string', enum: ['list', 'create'], description: 'Action to perform' },
        content: { type: 'string', description: 'Comment content (for create)' }
      },
      required: ['action']
    }
  },
  {
    name: 'content_convert',
    description: 'Convert: markdown-to-blocks, blocks-to-markdown. Most tools handle markdown automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['markdown-to-blocks', 'blocks-to-markdown'],
          description: 'Conversion direction'
        },
        content: { description: 'Content to convert (string or array/JSON string)' }
      },
      required: ['direction', 'content']
    }
  },
  {
    name: 'help',
    description: 'Get full documentation for a tool. Use when compressed descriptions are insufficient.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          enum: ['pages', 'databases', 'blocks', 'users', 'workspace', 'comments', 'content_convert'],
          description: 'Tool to get documentation for'
        }
      },
      required: ['tool_name']
    }
  }
]

/**
 * Register all tools with MCP server
 */
export function registerTools(server: Server, notionToken: string) {
  const notion = new Client({
    auth: notionToken,
    notionVersion: '2025-09-03' // Use latest API version with data_sources support
  })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }))

  // Resources handlers for full documentation
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      mimeType: 'text/markdown'
    }))
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    const resource = RESOURCES.find((r) => r.uri === uri)

    if (!resource) {
      throw new NotionMCPError(
        `Resource not found: ${uri}`,
        'RESOURCE_NOT_FOUND',
        `Available: ${RESOURCES.map((r) => r.uri).join(', ')}`
      )
    }

    const content = readFileSync(join(DOCS_DIR, resource.file), 'utf-8')
    return {
      contents: [{ uri, mimeType: 'text/markdown', text: content }]
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

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

    try {
      let result

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
        case 'help': {
          const toolName = (args as { tool_name: string }).tool_name
          const docFile = `${toolName}.md`
          try {
            const content = readFileSync(join(DOCS_DIR, docFile), 'utf-8')
            result = { tool: toolName, documentation: content }
          } catch {
            throw new NotionMCPError(`Documentation not found for: ${toolName}`, 'DOC_NOT_FOUND', 'Check tool_name')
          }
          break
        }
        default:
          throw new NotionMCPError(
            `Unknown tool: ${name}`,
            'UNKNOWN_TOOL',
            `Available tools: ${TOOLS.map((t) => t.name).join(', ')}`
          )
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
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
  })
}
