/**
 * Tool Definitions
 * Contains all tool schemas and related constants
 */

// Tools that work without a Notion token
export const TOKEN_FREE_TOOLS = new Set(['help', 'content_convert', 'config', 'config__open_relay'])

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
export const TOOLS = [
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
        properties: {
          type: 'object',
          description:
            'Page properties (for database pages). Use simple values -- auto-converted to Notion format. String: title/rich_text/select/status. Number: number. Boolean: checkbox. String[]: multi_select. ISO date string: date. Object with Notion structure: pass through as-is.'
        },
        property_id: { type: 'string', description: 'Property ID (for get_property action)' },
        icon: {
          type: 'string',
          description:
            'Icon: emoji (e.g. "(icon)"), external URL (https://...), or built-in shorthand (name:color, e.g. "document:gray")'
        },
        cover: {
          type: 'string',
          description:
            'Cover image: URL or built-in shorthand (gradient_1..11, solid_red/yellow/blue/beige, nasa_*, met_*, rijksmuseum_*, woodcuts_*)'
        },
        archived: { type: 'boolean', description: 'Archive status' }
      },
      required: ['action']
    }
  },
  {
    name: 'databases',
    description:
      'Database schema, query, and bulk row operations.\n\nActions (required params -> optional):\n- create (parent_id -> title, properties, is_inline, icon, cover)\n- get (database_id)\n- query (database_id -> filters, sorts, limit, search)\n- create_page (database_id, pages[{properties}])\n- update_page (database_id, page_id, page_properties)\n- delete_page (database_id, page_ids)\n- create_data_source / update_data_source / update_database / list_templates\n\nUse `pages` instead for single page CRUD. Accepts both database_id (from URL) and data_source_id (from workspace search) -- auto-resolved.',
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
            'create_page',
            'update_page',
            'delete_page',
            'create_data_source',
            'update_data_source',
            'update_database',
            'list_templates'
          ],
          description: 'Action to perform'
        },
        database_id: {
          type: 'string',
          description:
            'Database ID (from Notion URL) or data_source_id (from workspace search). Auto-resolved for query/create_page/list_templates.'
        },
        data_source_id: { type: 'string', description: 'Data source ID (for update_data_source action)' },
        parent_id: { type: 'string', description: 'Parent page ID (for create/update_database)' },
        title: { type: 'string', description: 'Title (for database or data source)' },
        description: { type: 'string', description: 'Description' },
        properties: { type: 'object', description: 'Schema properties (for create/update data source)' },
        is_inline: { type: 'boolean', description: 'Display as inline (for create/update_database)' },
        icon: {
          type: 'string',
          description:
            'Icon (for update_database): emoji (e.g. "(icon)"), external URL (https://...), or built-in shorthand (name:color, e.g. "document:gray")'
        },
        cover: {
          type: 'string',
          description:
            'Cover image (for update_database): URL or built-in shorthand (gradient_1..11, solid_red/yellow/blue/beige, nasa_*, met_*, rijksmuseum_*, woodcuts_*)'
        },
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
      'Read and modify block-level content within pages.\n\nActions (required params -> optional):\n- get (block_id): retrieve single block\n- children (block_id): list child blocks\n- append (block_id, content -> position, after_block_id): add markdown content at position\n- update (block_id, content): replace text block content\n- delete (block_id): remove block\n\nUse `pages` for page metadata/properties. Page IDs are valid block IDs. update only works on text blocks (paragraph, headings, lists, quote, to_do, code). Image/file blocks contain signed URLs (1h expiry). append supports position: "start" (prepend), "end" (default), "after_block" (requires after_block_id).',
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
          enum: ['get', 'children', 'append', 'update', 'delete'],
          description: 'Action to perform'
        },
        block_id: { type: 'string', description: 'Block ID' },
        content: { type: 'string', description: 'Markdown content (for append/update)' },
        position: {
          type: 'string',
          enum: ['start', 'end', 'after_block'],
          description:
            'Insert position for append: start (prepend), end (default), after_block (requires after_block_id)'
        },
        after_block_id: { type: 'string', description: 'Block ID to insert after (when position is after_block)' }
      },
      required: ['action', 'block_id']
    }
  },
  {
    name: 'users',
    description:
      'Get user information.\n\nActions (required params):\n- list: all workspace users (requires admin permissions)\n- get (user_id): single user info\n- me: current bot/integration user\n- from_workspace: extract users from accessible pages (use if list fails)',
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
      'Search workspace and get workspace info.\n\nActions (required params -> optional):\n- info: workspace name, plan, and bot user\n- search (-> query, filter.object="page"|"data_source", sort, limit): find pages/databases shared with integration',
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
          enum: ['info', 'search'],
          description: 'Action to perform'
        },
        query: { type: 'string', description: 'Search query' },
        filter: {
          type: 'object',
          properties: {
            object: {
              type: 'string',
              enum: ['page', 'data_source'],
              description: 'Filter by type: page or data_source (database)'
            }
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
    description:
      'Manage page comments.\n\nActions (required params -> optional):\n- list (page_id): all comments on a page\n- get (comment_id): single comment\n- create (content -> page_id for new discussion, discussion_id for reply)',
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
        action: { type: 'string', enum: ['list', 'get', 'create'], description: 'Action to perform' },
        page_id: { type: 'string', description: 'Page ID' },
        comment_id: { type: 'string', description: 'Comment ID (for get action)' },
        discussion_id: { type: 'string', description: 'Discussion ID (for replies)' },
        content: { type: 'string', description: 'Comment content (for create)' }
      },
      required: ['action']
    }
  },
  {
    name: 'content_convert',
    description:
      'Convert between markdown and Notion block JSON. Directions: markdown-to-blocks (input: markdown string), blocks-to-markdown (input: JSON array of Notion blocks or JSON string). Most tools (pages, blocks) handle markdown automatically -- use this only for preview/validation. Supported markdown: headings, lists, to-do, code blocks, blockquotes, dividers, callouts (> [!NOTE]), toggles (<details>), tables, images, bookmarks, embeds, equations ($$), columns (:::columns), [toc], [breadcrumb]. Inline: **bold**, *italic*, `code`, ~~strike~~, [link](url).',
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
        content: { type: 'string', description: 'Content to convert (string or array/JSON string)' }
      },
      required: ['direction', 'content']
    }
  },
  {
    name: 'file_uploads',
    description:
      'Upload files to Notion.\n\nActions (required params -> optional):\n- create (filename -> content_type, mode="single"|"multi_part", number_of_parts)\n- send (file_upload_id, file_content -> part_number): base64-encoded content\n- complete (file_upload_id)\n- retrieve (file_upload_id)\n- list (-> limit)\n\nMax 20MB direct, multi-part for larger files.',
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
export const VALID_HELP_TOOL_NAMES = new Set(TOOLS.map((t) => t.name).filter((name) => name !== 'help'))
export const VALID_HELP_TOOLS_STRING = Array.from(VALID_HELP_TOOL_NAMES).join(', ')
