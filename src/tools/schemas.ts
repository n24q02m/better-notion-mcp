import { z } from 'zod'

export const pagesSchema = z.object({
  action: z.enum(['create', 'get', 'update', 'archive', 'restore', 'duplicate']),
  page_id: z.string().optional(),
  page_ids: z.array(z.string()).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  append_content: z.string().optional(),
  prepend_content: z.string().optional(),
  parent_id: z.string().optional(),
  properties: z.record(z.string(), z.any()).optional(),
  icon: z.string().optional(),
  cover: z.string().optional(),
  archived: z.boolean().optional()
})

export const databasesSchema = z.object({
  action: z.enum([
    'create',
    'get',
    'query',
    'create_page',
    'update_page',
    'delete_page',
    'create_data_source',
    'update_data_source',
    'update_database'
  ]),
  database_id: z.string().optional(),
  data_source_id: z.string().optional(),
  parent_id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  properties: z.record(z.string(), z.any()).optional(),
  is_inline: z.boolean().optional(),
  icon: z.string().optional(),
  cover: z.string().optional(),
  filters: z.record(z.string(), z.any()).optional(),
  sorts: z.array(z.record(z.string(), z.any())).optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  page_id: z.string().optional(),
  page_ids: z.array(z.string()).optional(),
  page_properties: z.record(z.string(), z.any()).optional(),
  pages: z.array(z.record(z.string(), z.any())).optional()
})

export const blocksSchema = z.object({
  action: z.enum(['get', 'children', 'append', 'update', 'delete']),
  block_id: z.string(),
  content: z.string().optional()
})

export const usersSchema = z.object({
  action: z.enum(['list', 'get', 'me', 'from_workspace']),
  user_id: z.string().optional()
})

export const workspaceSchema = z.object({
  action: z.enum(['info', 'search']),
  query: z.string().optional(),
  filter: z
    .object({
      object: z.enum(['page', 'database']).optional()
    })
    .optional(),
  sort: z
    .object({
      direction: z.enum(['ascending', 'descending']).optional(),
      timestamp: z.enum(['last_edited_time', 'created_time']).optional()
    })
    .optional(),
  limit: z.number().optional()
})

export const commentsSchema = z.object({
  action: z.enum(['list', 'create']),
  page_id: z.string().optional(),
  discussion_id: z.string().optional(),
  content: z.string().optional()
})

export const contentConvertSchema = z.object({
  direction: z.enum(['markdown-to-blocks', 'blocks-to-markdown']),
  content: z.union([z.string(), z.array(z.any())])
})

export const helpSchema = z.object({
  tool_name: z.enum(['pages', 'databases', 'blocks', 'users', 'workspace', 'comments', 'content_convert'])
})

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  pages: pagesSchema,
  databases: databasesSchema,
  blocks: blocksSchema,
  users: usersSchema,
  workspace: workspaceSchema,
  comments: commentsSchema,
  content_convert: contentConvertSchema,
  help: helpSchema
}
