/**
 * Tool Registry - 7 Mega Tools
 * Consolidated registration for maximum coverage with minimal tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Client } from '@notionhq/client'

// Import mega tools
import { blocks } from './composite/blocks.js'
import { commentsManage } from './composite/comments.js'
import { contentConvert } from './composite/content.js'
import { databases } from './composite/databases.js'
import { pages } from './composite/pages.js'
import { users } from './composite/users.js'
import { workspace } from './composite/workspace.js'
import { NotionMCPError, aiReadableMessage } from './helpers/errors.js'

/**
 * 7 Mega Tools covering 75% of Official Notion API
 */
const TOOLS = [
  {
    name: 'pages',
    description: `Complete page lifecycle management. Handles creation, reading, updating, archiving, and duplication.

**IMPORTANT:** Integration tokens cannot create workspace-level pages. Always provide parent_id (page or database ID).

Actions: create, get, update, archive, restore, duplicate.

Maps to: POST/GET/PATCH /v1/pages + /v1/blocks/{id}/children

Examples:
- Create page: {action: "create", title: "Meeting Notes", parent_id: "xxx", content: "# Agenda\n- Item 1\n- Item 2"}
- Create in database: {action: "create", title: "Task", parent_id: "db-id", properties: {Status: "Todo", Priority: "High"}}
- Get with content: {action: "get", page_id: "xxx"} → Returns markdown content
- Update content: {action: "update", page_id: "xxx", append_content: "\n## New Section"}
- Update metadata: {action: "update", page_id: "xxx", icon: "", cover: "https://..."}
- Archive: {action: "archive", page_ids: ["xxx", "yyy"]}
- Restore: {action: "restore", page_id: "xxx"}
- Duplicate: {action: "duplicate", page_id: "xxx"}`,
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
    description: `Complete database & data source operations (Notion API 2025-09-03).

**ARCHITECTURE NOTE:**
Notion databases now support multiple data sources. A database is a container that holds one or more data sources. Each data source has its own schema (properties) and rows (pages).

**WORKFLOW:**
1. Create database → Creates database container + initial data source
2. Get database → Retrieves data_source_id for querying
3. Query/Create/Update pages → Use data_source_id (auto-fetched from database_id)

Actions: create, get, query, create_page, update_page, delete_page, create_data_source, update_data_source, update_database.

Maps to: /v1/databases + /v1/data_sources + /v1/pages

Examples:
- Create DB+datasource: {action: "create", parent_id: "xxx", title: "Tasks", properties: {Status: {select: {options: [{name: "Todo"}, {name: "Done"}]}}}}
- Get schema: {action: "get", database_id: "xxx"} → Returns data_source info
- Query data: {action: "query", database_id: "xxx", filters: {property: "Status", select: {equals: "Done"}}}
- Smart search: {action: "query", database_id: "xxx", search: "project"}
- Create rows: {action: "create_page", database_id: "xxx", pages: [{properties: {Name: "Task 1", Status: "Todo"}}]}
- Update rows: {action: "update_page", page_id: "yyy", page_properties: {Status: "Done"}}
- Delete rows: {action: "delete_page", page_ids: ["yyy", "zzz"]}
- Add 2nd datasource: {action: "create_data_source", database_id: "xxx", title: "Archive", properties: {...}}
- Update datasource schema: {action: "update_data_source", data_source_id: "yyy", properties: {NewField: {checkbox: {}}}}
- Move database: {action: "update_database", database_id: "xxx", parent_id: "new-page-id"}`,
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
    description: `Fine-grained content manipulation at block level. Use for precise edits within pages.

**When to use:** Editing specific paragraphs, headings, or sections. For full page content, use pages tool.
**Block ID:** Page IDs are also valid block IDs (page is the root block).

Actions: get, children, append, update, delete.

Maps to: GET/PATCH/DELETE /v1/blocks/{id} + /v1/blocks/{id}/children

Examples:
- Get block info: {action: "get", block_id: "xxx"}
- Read content: {action: "children", block_id: "xxx"} → Returns markdown of child blocks
- Add content: {action: "append", block_id: "page-id", content: "## New Section\nParagraph text"}
- Edit paragraph: {action: "update", block_id: "block-id", content: "Updated text"}
- Remove block: {action: "delete", block_id: "block-id"}`,
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
    description: `User information retrieval. Get bot info, list users, or extract users from workspace.

**PERMISSION NOTE:** list action may fail if integration lacks user read permissions. Use from_workspace as fallback - it extracts user IDs from accessible pages' metadata.

Actions: list, get, me, from_workspace.

Maps to: GET /v1/users + GET /v1/users/{id} + GET /v1/users/me

Examples:
- Get bot details: {action: "me"} → Integration info
- List all users: {action: "list"} → Requires user:read permission
- Get specific user: {action: "get", user_id: "xxx"}
- Bypass permissions: {action: "from_workspace"} → Extracts users from page metadata (created_by, last_edited_by)`,
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
    description: `Workspace-level operations: get integration info and search across pages/data sources.

**Search:** Searches page/database titles. In API 2025-09-03, use filter object "data_source" to find databases. Returns only accessible content (shared with integration).

Actions: info, search.

Maps to: GET /v1/users/me + POST /v1/search

Examples:
- Get workspace info: {action: "info"} → Bot owner, workspace details
- Search pages: {action: "search", query: "meeting notes", filter: {object: "page"}, limit: 10}
- Search databases: {action: "search", query: "tasks", filter: {object: "data_source"}}
- Sort results: {action: "search", query: "project", sort: {direction: "ascending", timestamp: "last_edited_time"}}`,
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
    description: `Page discussion management. List comments on pages and add new comments or replies.

**Threading:** Use page_id for new discussion. Use discussion_id (from list response) to reply to existing thread.

Actions: list, create.

Maps to: GET /v1/comments + POST /v1/comments

Examples:
- List page comments: {action: "list", page_id: "xxx"}
- Start discussion: {action: "create", page_id: "xxx", content: "Great work on this page!"}
- Reply to thread: {action: "create", discussion_id: "thread-id", content: "I agree with your points"}`,
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
    description: `Format conversion utility. Convert between human-readable Markdown and Notion's block format.

**Use cases:**
- Preview Notion blocks as Markdown before appending
- Test block structure from Markdown input
- Debug block formatting issues

**Note:** Most operations (pages, blocks) handle Markdown automatically. Use this for advanced preview/validation.

Examples:
- Parse Markdown: {direction: "markdown-to-blocks", content: "# Heading\nParagraph text\n- List item"}
- Read blocks: {direction: "blocks-to-markdown", content: [{"type": "paragraph", "paragraph": {...}}]}`,
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
