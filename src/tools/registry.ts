/**
 * Tool Registry - 10 Composite Tools
 * Consolidated registration for maximum coverage with minimal tools
 */

import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
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
import { aiReadableMessage, findClosestMatch, NotionMCPError } from './helpers/errors.js'
import { wrapToolResult } from './helpers/security.js'

// Tools that work without a Notion token
const TOKEN_FREE_TOOLS = new Set(['help', 'content_convert', 'config', 'config__open_relay'])

// publicUrl is null in stdio mode (no relay form to open). HTTP mode
// substitutes it with PUBLIC_URL so the tool returns a valid /authorize URL.
const openRelayHandler = buildOpenRelayHandler({
  serverName: 'better-notion-mcp',
  publicUrl: process.env.PUBLIC_URL ?? null
})

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
  { uri: 'notion://docs/content_convert', name: 'Content Convert Tool Docs', file: 'content_convert.md' },
  { uri: 'notion://docs/file_uploads', name: 'File Uploads Tool Docs', file: 'file_uploads.md' }
]

/**
 * 10 Tools covering ~95% of Official Notion API
 * Compressed descriptions for token optimization (~77% reduction)
 *
 * Decision tree for LLMs:
 * - `pages` = page CRUD (create/read/update/archive standalone pages or database rows)
 * - `databases` = DB schema, query rows, bulk row CRUD
 * - `blocks` = content *within* a page (paragraphs, headings, lists, tables)
 * - `workspace` = search across workspace, get workspace info
 */
const TOOLS = [
  {
    name: 'pages',
    description:
      'Page CRUD for individual pages and database rows.\n\nActions (required params -> optional):\n- create (parent_id -> title, content, properties, icon, cover)\n- get (page_id): returns markdown content\n- get_property (page_id, property_id)\n- update (page_id -> title, content, append_content, properties, icon, cover, archived)\n- move (page_id, parent_id)\n- archive (page_id) / restore (page_id)\n- duplicate (page_id -> parent_id)\n\nUse `databases` instead for querying or bulk row operations. Property format: simple values auto-convert -- string for title/rich_text/select/status, number for number, boolean for checkbox, string[] for multi_select, ISO date "2025-01-15" for date. Example: properties: {"Name": "My Page", "Status": "In Progress", "Tags": ["tag1", "tag2"], "Due": "2025-06-01", "Count": 42, "Done": true}.',
    annotations: {
      title: 'Pages',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'get', 'get_property', 'update', 'move', 'archive', 'restore', 'duplicate'],
          description: 'Action to perform'
        },
        page_id: { type: 'string', description: 'Page ID (required for most actions)' },
        page_ids: { type: 'array', items: { type: 'string' }, description: 'Multiple page IDs for batch operations' },
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Markdown content' },
        append_content: { type: 'string', description: 'Markdown to append' },
        parent_id: { type: 'string', description: 'Parent page or database ID' },
        properties: { type: 'object', description: 'Page properties (JSON)' },
        icon: { type: 'string', description: 'Emoji or URL' },
        cover: { type: 'string', description: 'Image URL' },
        archived: { type: 'boolean', description: 'Set archived status' }
      },
      required: ['action']
    }
  },
  {
    name: 'databases',
    description:
      'Database schema and row operations.\n\nActions (required params -> optional):\n- list (parent_id): list databases in a page\n- get (database_id): get schema\n- query (database_id -> filter, sorts, limit): find rows\n- create_pages (database_id, pages[]): bulk insert\n- update_pages (database_id, pages[]): bulk update\n- delete_pages (database_id, page_ids[]): bulk archive\n\nFilter/Sort follow Notion API format. For `query`, set `filter` to `{"property": "Name", "rich_text": {"contains": "test"}}`. Use `pages` tool for individual row CRUD.',
    annotations: {
      title: 'Databases',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'query', 'create_pages', 'update_pages', 'delete_pages'],
          description: 'Action to perform'
        },
        database_id: { type: 'string', description: 'Database ID' },
        parent_id: { type: 'string', description: 'Parent page ID for list' },
        filter: { type: 'object', description: 'Notion query filter' },
        sorts: { type: 'array', items: { type: 'object' }, description: 'Notion query sorts' },
        limit: { type: 'number', description: 'Max results' },
        pages: { type: 'array', items: { type: 'object' }, description: 'Page data for bulk actions' },
        page_ids: { type: 'array', items: { type: 'string' }, description: 'IDs for bulk delete' }
      },
      required: ['action']
    }
  },
  {
    name: 'blocks',
    description:
      'Content management within pages (paragraphs, lists, headings, tables).\n\nActions:\n- get (block_id): get block details\n- children (block_id): list nested blocks\n- append (block_id, content): add markdown content\n- update (block_id, content): replace block content\n- delete (block_id): remove block',
    annotations: {
      title: 'Blocks',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'children', 'append', 'update', 'delete'],
          description: 'Action to perform'
        },
        block_id: { type: 'string', description: 'Block ID' },
        content: { type: 'string', description: 'Markdown content' }
      },
      required: ['action']
    }
  },
  {
    name: 'users',
    description:
      'Retrieve user and bot information.\n\nActions:\n- list: all workspace users\n- get (user_id): specific user details\n- me: current integration bot info',
    annotations: {
      title: 'Users',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'me'],
          description: 'Action to perform'
        },
        user_id: { type: 'string', description: 'User ID for get' }
      },
      required: ['action']
    }
  },
  {
    name: 'workspace',
    description:
      'Global workspace operations.\n\nActions:\n- search (query -> filter, sorts, limit): search pages and databases by title\n- info: get workspace name and integration limits',
    annotations: {
      title: 'Workspace',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'info'],
          description: 'Action to perform'
        },
        query: { type: 'string', description: 'Search query' },
        filter: { type: 'object', description: 'Search filter (property: "object", value: "page"|"database")' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['action']
    }
  },
  {
    name: 'comments',
    description:
      'Manage page and block comments.\n\nActions:\n- list (block_id): list comments on a page or block\n- create (block_id, content): add a new comment (markdown)',
    annotations: {
      title: 'Comments',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create'],
          description: 'Action to perform'
        },
        block_id: { type: 'string', description: 'Page or Block ID' },
        content: { type: 'string', description: 'Comment markdown' }
      },
      required: ['action']
    }
  },
  {
    name: 'content_convert',
    description:
      'Utility to convert between formats (no Notion API calls).\n\nDirections:\n- markdown-to-blocks: Markdown string -> Notion Block objects\n- blocks-to-markdown: Notion Block objects -> Markdown string',
    annotations: {
      title: 'Content Convert',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['markdown-to-blocks', 'blocks-to-markdown'],
          description: 'Conversion direction'
        },
        content: { type: 'string', description: 'Markdown content (for markdown-to-blocks)' },
        blocks: { type: 'array', items: { type: 'object' }, description: 'Notion blocks (for blocks-to-markdown)' }
      },
      required: ['direction']
    }
  },
  {
    name: 'file_uploads',
    description:
      'Handle file uploads to Notion (images, PDFs, videos).\n\nProcess:\n1. create: get an upload ID\n2. send: upload base64 chunks\n3. complete: finalize and get the Notion URL\n\nSupports single-part and multi-part (up to 100MB). Use the returned URL in page/block properties.',
    annotations: {
      title: 'File Uploads',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'send', 'complete', 'retrieve', 'list'],
          description: 'Action to perform'
        },
        file_upload_id: { type: 'string', description: 'File upload ID (from create step)' },
        filename: { type: 'string', description: 'Filename (for create)' },
        content_type: { type: 'string', description: 'MIME type (for create, e.g. "image/png")' },
        mode: { type: 'string', enum: ['single', 'multi_part'], description: 'Upload mode (default: single)' },
        number_of_parts: { type: 'number', description: 'Number of parts (for multi_part mode)' },
        part_number: { type: 'number', description: 'Part number (for send in multi_part mode)' },
        file_content: {
          type: 'string',
          description:
            'Base64-encoded file content (for send). Must be valid base64: only A-Z, a-z, 0-9, +, /, = chars. Use Buffer.from(bytes).toString("base64") to encode.'
        },
        limit: { type: 'number', description: 'Max results for list' }
      },
      required: ['action']
    }
  },
  {
    name: 'help',
    description: 'Get full documentation for a tool. Use when compressed descriptions are insufficient.',
    annotations: {
      title: 'Help',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          enum: ['pages', 'databases', 'blocks', 'users', 'workspace', 'comments', 'content_convert', 'file_uploads'],
          description: 'Tool to get documentation for'
        }
      },
      required: ['tool_name']
    }
  },
  {
    name: 'config',
    description:
      'Manage server configuration and credential state.\n\nActions:\n- status: current credential state, token source, setup URL\n- setup_start (-> force): trigger relay setup to configure Notion token via browser\n- setup_reset: clear credentials and config, return to awaiting_setup\n- setup_complete: re-check credentials after external config changes\n- set: update a runtime setting (notion has no mutable settings; returns info)\n- cache_clear: clear any cached state (no-op for notion)',
    annotations: {
      title: 'Config',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'setup_start', 'setup_reset', 'setup_complete', 'set', 'cache_clear'],
          description: 'Action to perform'
        },
        force: {
          type: 'boolean',
          description: 'Force setup_start even if already configured'
        },
        key: {
          type: 'string',
          description: 'Setting key (for set action)'
        },
        value: {
          type: 'string',
          description: 'Setting value (for set action)'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'config__open_relay',
    description:
      'Open the relay configuration form for better-notion-mcp in the user browser. Returns the relay URL, whether the browser launched, and the current credential state. Auto-respawns the daemon if it has died.',
    annotations: {
      title: 'Open Relay',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
      required: []
    }
  }
]

// Pre-compute valid tool names for the help endpoint to avoid allocations on every call
// BOLT OPTIMIZATION: Use Set for O(1) lookups instead of dynamic array creation
const VALID_HELP_TOOL_NAMES = new Set(TOOLS.map((t) => t.name).filter((name) => name !== 'help'))
const VALID_HELP_TOOLS_STRING = Array.from(VALID_HELP_TOOL_NAMES).join(', ')

/**
 * Register ListTools handler
 */
function registerListTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }))
}

/**
 * Register Resources handlers for documentation
 */
function registerResources(server: Server) {
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

    try {
      const content = await readFile(join(DOCS_DIR, basename(resource.file)), 'utf-8')
      return {
        contents: [{ uri, mimeType: 'text/markdown', text: content }]
      }
    } catch {
      throw new NotionMCPError(`Documentation not found for: ${resource.name}`, 'DOC_NOT_FOUND', 'Check resource URI')
    }
  })
}

/**
 * Register CallTool handler for all composite tools
 */
function registerCallTool(server: Server, notionClientFactory: () => Client) {
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

    // Credential guard
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
          if (!VALID_HELP_TOOL_NAMES.has(toolName)) {
            throw new NotionMCPError(
              `Invalid tool name: ${toolName}`,
              'VALIDATION_ERROR',
              `Valid tools: ${VALID_HELP_TOOLS_STRING}`
            )
          }
          const docFile = `${basename(toolName)}.md`
          const fullPath = join(DOCS_DIR, docFile)
          if (!fullPath.startsWith(DOCS_DIR)) {
            throw new NotionMCPError('Path traversal attempt detected', 'SECURITY_ERROR', 'Invalid tool_name')
          }

          try {
            const content = await readFile(fullPath, 'utf-8')
            result = { tool: toolName, documentation: content }
          } catch {
            throw new NotionMCPError(`Documentation not found for: ${toolName}`, 'DOC_NOT_FOUND', 'Check tool_name')
          }
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
  })
}

/**
 * Register all tools with MCP server
 * @param notionClientFactory - Returns a Notion Client.
 *   Called per tool invocation to support both singleton (stdio) and per-request (HTTP) patterns.
 */
export function registerTools(server: Server, notionClientFactory: () => Client) {
  registerListTools(server)
  registerResources(server)
  registerCallTool(server, notionClientFactory)
}
