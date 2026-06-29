/**
 * Tool Registry - 8 composite Notion tools + 3 infra tools (config, config__open_relay, help)
 * Consolidated registration for maximum coverage with minimal tools
 */

import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
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
import { aiReadableMessage, findClosestMatch, NotionMCPError } from './helpers/errors.js'
import { wrapToolResult } from './helpers/security.js'
import { DOCS_DIR, registerResourceHandlers } from './resources.js'

// Tools that work without a Notion token
const TOKEN_FREE_TOOLS = new Set(['help', 'content_convert', 'config', 'config__open_relay'])

// publicUrl is null in stdio mode (no relay form to open). HTTP mode
// substitutes it with PUBLIC_URL so the tool returns a valid /authorize URL.
const openRelayHandler = buildOpenRelayHandler({
  serverName: 'better-notion-mcp',
  publicUrl: process.env.PUBLIC_URL ?? null
})

/**
 * 11 registered tools (8 composite Notion tools + config + config__open_relay + help)
 * covering ~95% of the official Notion API.
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
        page_id: { type: 'string', description: 'Target Page or Row ID' },
        property_id: { type: 'string', description: 'Property ID (for get_property)' },
        parent_id: {
          type: 'string',
          description: 'Parent Page or Database ID (for create, move, duplicate)'
        },
        title: { type: 'string', description: 'Page title' },
        content: {
          type: 'string',
          description: 'Page content in Markdown (overwrite)'
        },
        append_content: {
          type: 'string',
          description: 'Page content in Markdown (append)'
        },
        properties: {
          type: 'object',
          description: 'Page properties (simple key-value)'
        },
        icon: { type: 'string', description: 'Emoji or URL for page icon' },
        cover: { type: 'string', description: 'URL for page cover image' },
        archived: { type: 'boolean', description: 'Whether the page is archived' }
      },
      required: ['action']
    }
  },
  {
    name: 'databases',
    description:
      'Database schema and querying.\n\nActions:\n- create (parent_id, title -> properties)\n- get (database_id)\n- query (database_id -> filter, sorts, limit): returns rows as list\n- update (database_id -> title, properties)\n- update_page / delete_page (page_id): shorthand for individual rows\n- bulk_update_pages / bulk_delete_pages (page_ids): process multiple rows\n\nUse `pages` for individual row content or property details. Filter format: {"property": "Status", "select": {"equals": "Done"}}. Sort format: [{"property": "Name", "direction": "ascending"}].',
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
          enum: [
            'create',
            'get',
            'query',
            'update',
            'update_page',
            'delete_page',
            'bulk_update_pages',
            'bulk_delete_pages'
          ],
          description: 'Action to perform'
        },
        database_id: { type: 'string', description: 'Database ID' },
        page_id: { type: 'string', description: 'Page ID' },
        page_ids: { type: 'array', items: { type: 'string' }, description: 'Page IDs' },
        parent_id: { type: 'string', description: 'Parent Page ID' },
        title: { type: 'string', description: 'Database title' },
        properties: { type: 'object', description: 'Database schema properties' },
        filter: { type: 'object', description: 'Query filter' },
        sorts: { type: 'array', items: { type: 'object' }, description: 'Query sorts' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['action']
    }
  },
  {
    name: 'blocks',
    description:
      'Manage content blocks within a page.\n\nActions:\n- get (block_id): single block info\n- get_children (block_id): returns list of nested blocks\n- append (block_id, content): add new blocks (Markdown supported)\n- update (block_id -> content, archived): modify existing block\n- delete (block_id): archive a block',
    annotations: {
      title: 'Blocks',
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
          enum: ['get', 'get_children', 'append', 'update', 'delete'],
          description: 'Action to perform'
        },
        block_id: { type: 'string', description: 'Block ID' },
        content: { type: 'string', description: 'Markdown content' },
        archived: { type: 'boolean', description: 'Whether the block is archived' }
      },
      required: ['action']
    }
  },
  {
    name: 'users',
    description:
      'User and bot information.\n\nActions:\n- list: all users in workspace\n- get (user_id): specific user details\n- me: info about the current integration bot',
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
        user_id: { type: 'string', description: 'User ID' }
      },
      required: ['action']
    }
  },
  {
    name: 'workspace',
    description:
      'Search and global workspace operations.\n\nActions:\n- search (query -> filter, sorts, limit): find pages/databases by title\n- get_bot_info: current bot/integration details',
    annotations: {
      title: 'Workspace',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'get_bot_info'],
          description: 'Action to perform'
        },
        query: { type: 'string', description: 'Search query' },
        filter: { type: 'object', description: 'Search filter' },
        sort: { type: 'object', description: 'Search sort' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['action']
    }
  },
  {
    name: 'comments',
    description:
      'Manage page discussions.\n\nActions:\n- list (block_id): comments on a page/block\n- create (parent_id, content): add new comment\n\nNote: comments cannot be updated or deleted via API.',
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
        block_id: { type: 'string', description: 'Block/Page ID to list from' },
        parent_id: { type: 'string', description: 'Block/Page ID to comment on' },
        content: { type: 'string', description: 'Comment text' }
      },
      required: ['action']
    }
  },
  {
    name: 'content_convert',
    description:
      'Offline utility to convert between Markdown and Notion Block formats.\n\nActions:\n- to_notion (markdown): returns Block JSON\n- to_markdown (blocks_json): returns Markdown string',
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
        action: {
          type: 'string',
          enum: ['to_notion', 'to_markdown'],
          description: 'Action to perform'
        },
        markdown: { type: 'string', description: 'Markdown string' },
        blocks_json: { type: 'string', description: 'JSON string of blocks' }
      },
      required: ['action']
    }
  },
  {
    name: 'file_uploads',
    description:
      'Manage file uploads to Notion (via AWS S3). Supports single-file and multi-part uploads.\n\nActions:\n- list: list recent uploads\n- create (name, content_type -> mode, number_of_parts): initialize upload\n- send (upload_id, file_content -> part_number): upload data\n- complete (upload_id): finalize multi-part upload',
    annotations: {
      title: 'File Uploads',
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
          enum: ['list', 'create', 'send', 'complete'],
          description: 'Action to perform'
        },
        upload_id: { type: 'string', description: 'Upload ID' },
        name: { type: 'string', description: 'File name' },
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
      'Open the relay configuration form for better-notion-mcp in the user browser. Returns the relay URL, whether the browser launched, and the current credential state.',
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

// Pre-compute all tool names for error messages
// BOLT OPTIMIZATION: Avoid O(N) array mapping on every invalid tool call
const ALL_TOOL_NAMES = TOOLS.map((t) => t.name)
const ALL_TOOL_NAMES_STRING = ALL_TOOL_NAMES.join(', ')

/**
 * Register all tools with MCP server
 * @param notionClientFactory - Returns a Notion Client.
 *   Called per tool invocation to support both singleton (stdio) and per-request (HTTP) patterns.
 */
export function registerTools(server: Server, notionClientFactory: () => Client) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
  }))

  // Resources handlers for full documentation
  registerResourceHandlers(server)

  server.setRequestHandler(CallToolRequestSchema, (request) => handleCallTool(request, notionClientFactory))
}

/**
 * Handles tool calls by dispatching to the appropriate composite tool
 */
async function handleCallTool(request: any, notionClientFactory: () => Client) {
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
        // Security: Use basename() to ensure we only look for files directly inside DOCS_DIR,
        // preventing path traversal even if the allowlist validation is bypassed or modified.
        const docFile = `${basename(toolName)}.md`
        const fullPath = join(DOCS_DIR, docFile)
        const rel = relative(DOCS_DIR, fullPath)
        if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
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
        const closest = findClosestMatch(name, ALL_TOOL_NAMES)
        const suggestion = closest ? ` Did you mean '${closest}'?` : ''
        throw new NotionMCPError(
          `Unknown tool: ${name}.${suggestion}`,
          'UNKNOWN_TOOL',
          `Available tools: ${ALL_TOOL_NAMES_STRING}`
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
