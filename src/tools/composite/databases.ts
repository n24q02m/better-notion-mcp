/**
 * Databases Mega Tool - Updated for Notion API 2025-09-03
 * Supports data_sources architecture
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { autoPaginate, processBatches } from '../helpers/pagination.js'
import { convertToNotionProperties } from '../helpers/properties.js'
import * as RichText from '../helpers/richtext.js'

export interface DatabasesInput {
  action:
    | 'create'
    | 'get'
    | 'query'
    | 'create_page'
    | 'update_page'
    | 'delete_page'
    | 'create_data_source'
    | 'update_data_source'
    | 'update_database'

  // Common params
  database_id?: string
  data_source_id?: string

  // Create database params
  parent_id?: string
  title?: string
  description?: string
  properties?: Record<string, any>
  is_inline?: boolean
  icon?: string
  cover?: string

  // Query params
  filters?: any
  sorts?: any[]
  limit?: number
  search?: string

  // Page operations params (create/update/delete database items)
  page_id?: string
  page_ids?: string[]
  page_properties?: Record<string, any>

  // Bulk operations
  pages?: Array<{
    page_id?: string
    properties: Record<string, any>
  }>
}

/**
 * Unified databases tool - handles all database operations
 */
export async function databases(notion: Client, input: DatabasesInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'create':
        return await createDatabase(notion, input)

      case 'get':
        return await getDatabase(notion, input)

      case 'query':
        return await queryDatabase(notion, input)

      case 'create_page':
        return await createDatabasePages(notion, input)

      case 'update_page':
        return await updateDatabasePages(notion, input)

      case 'delete_page':
        return await deleteDatabasePages(notion, input)

      case 'create_data_source':
        return await createDataSource(notion, input)

      case 'update_data_source':
        return await updateDataSource(notion, input)

      case 'update_database':
        return await updateDatabaseContainer(notion, input)

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: create, get, query, create_page, update_page, delete_page, create_data_source, update_data_source, update_database'
        )
    }
  })()
}

/**
 * Create database with initial data source
 * Maps to: POST /v1/databases (API 2025-09-03)
 */
async function createDatabase(notion: Client, input: DatabasesInput): Promise<any> {
  if (!input.parent_id || !input.title || !input.properties) {
    throw new NotionMCPError(
      'parent_id, title, and properties required for create action',
      'VALIDATION_ERROR',
      'Provide parent_id, title, and properties'
    )
  }

  // API 2025-09-03: properties go under initial_data_source
  const dbData: any = {
    parent: { type: 'page_id', page_id: input.parent_id },
    title: [RichText.text(input.title)],
    initial_data_source: {
      properties: input.properties
    }
  }

  if (input.description) {
    dbData.description = [RichText.text(input.description)]
  }

  if (input.is_inline !== undefined) {
    dbData.is_inline = input.is_inline
  }

  const database: any = await notion.databases.create(dbData)

  return {
    action: 'create',
    database_id: database.id,
    data_source_id: database.data_sources?.[0]?.id,
    url: database.url,
    created: true
  }
}

/**
 * Get database info including all data sources
 * Maps to: GET /v1/databases/{id} (API 2025-09-03)
 */
async function getDatabase(notion: Client, input: DatabasesInput): Promise<any> {
  if (!input.database_id) {
    throw new NotionMCPError('database_id required for get action', 'VALIDATION_ERROR', 'Provide database_id')
  }

  // Get database (contains list of data_sources)
  const database: any = await notion.databases.retrieve({
    database_id: input.database_id
  })

  // Get detailed schema from first data source
  const schema: any = {}
  let dataSourceInfo: any = null

  if (database.data_sources && database.data_sources.length > 0) {
    const dataSource: any = await (notion as any).dataSources.retrieve({
      data_source_id: database.data_sources[0].id
    })

    dataSourceInfo = {
      id: dataSource.id,
      name: dataSource.title?.[0]?.plain_text || database.data_sources[0].name
    }

    // Format properties for AI-friendly output
    if (dataSource.properties) {
      for (const [name, prop] of Object.entries(dataSource.properties)) {
        const p = prop as any
        schema[name] = {
          type: p.type,
          id: p.id
        }

        if (p.type === 'select' && p.select?.options) {
          schema[name].options = p.select.options.map((o: any) => o.name)
        } else if (p.type === 'multi_select' && p.multi_select?.options) {
          schema[name].options = p.multi_select.options.map((o: any) => o.name)
        } else if (p.type === 'formula' && p.formula) {
          schema[name].expression = p.formula.expression
        }
      }
    }
  }

  return {
    action: 'get',
    database_id: database.id,
    title: database.title?.[0]?.plain_text || 'Untitled',
    description: database.description?.[0]?.plain_text || '',
    url: database.url,
    is_inline: database.is_inline,
    created_time: database.created_time,
    last_edited_time: database.last_edited_time,
    data_source: dataSourceInfo,
    schema
  }
}

/**
 * Query database (via data source)
 * Maps to: POST /v1/data_sources/{id}/query (API 2025-09-03)
 */
async function queryDatabase(notion: Client, input: DatabasesInput): Promise<any> {
  if (!input.database_id) {
    throw new NotionMCPError('database_id required for query action', 'VALIDATION_ERROR', 'Provide database_id')
  }

  // First, get data source ID from database
  const database: any = await notion.databases.retrieve({
    database_id: input.database_id
  })

  if (!database.data_sources || database.data_sources.length === 0) {
    throw new NotionMCPError('No data sources found in database', 'VALIDATION_ERROR', 'Database has no data sources')
  }

  const dataSourceId = database.data_sources[0].id

  let filter = input.filters

  // Smart search across text properties
  if (input.search && !filter) {
    const dataSource: any = await (notion as any).dataSources.retrieve({
      data_source_id: dataSourceId
    })

    const textProps = Object.entries(dataSource.properties || {})
      .filter(([_, prop]: [string, any]) => ['title', 'rich_text'].includes(prop.type))
      .map(([name]) => name)

    if (textProps.length > 0) {
      filter = {
        or: textProps.map((propName) => ({
          property: propName,
          rich_text: { contains: input.search }
        }))
      }
    }
  }

  const queryParams: any = { data_source_id: dataSourceId }
  if (filter) queryParams.filter = filter
  if (input.sorts) queryParams.sorts = input.sorts

  // Fetch with pagination
  const allResults = await autoPaginate(async (cursor) => {
    const response: any = await (notion as any).dataSources.query({
      ...queryParams,
      start_cursor: cursor,
      page_size: 100
    })
    return {
      results: response.results,
      next_cursor: response.next_cursor,
      has_more: response.has_more
    }
  })

  // Limit results if specified
  const results = input.limit ? allResults.slice(0, input.limit) : allResults

  // Format results
  const formattedResults = results.map((page: any) => {
    const props: any = { page_id: page.id, url: page.url }

    for (const [key, prop] of Object.entries(page.properties)) {
      const p = prop as any
      if (p.type === 'title' && p.title) {
        props[key] = p.title.map((t: any) => t.plain_text).join('')
      } else if (p.type === 'rich_text' && p.rich_text) {
        props[key] = p.rich_text.map((t: any) => t.plain_text).join('')
      } else if (p.type === 'select' && p.select) {
        props[key] = p.select.name
      } else if (p.type === 'multi_select' && p.multi_select) {
        props[key] = p.multi_select.map((s: any) => s.name)
      } else if (p.type === 'number') {
        props[key] = p.number
      } else if (p.type === 'checkbox') {
        props[key] = p.checkbox
      } else if (p.type === 'url') {
        props[key] = p.url
      } else if (p.type === 'email') {
        props[key] = p.email
      } else if (p.type === 'phone_number') {
        props[key] = p.phone_number
      } else if (p.type === 'date' && p.date) {
        props[key] = p.date.start + (p.date.end ? ` to ${p.date.end}` : '')
      }
    }

    return props
  })

  return {
    action: 'query',
    database_id: input.database_id,
    data_source_id: dataSourceId,
    total: formattedResults.length,
    results: formattedResults
  }
}

/**
 * Create pages in database (via data source)
 * Maps to: Multiple POST /v1/pages with data_source_id parent (API 2025-09-03)
 */
async function createDatabasePages(notion: Client, input: DatabasesInput): Promise<any> {
  if (!input.database_id) {
    throw new NotionMCPError('database_id required', 'VALIDATION_ERROR', 'Provide database_id')
  }

  // Get data source ID from database
  const database: any = await notion.databases.retrieve({
    database_id: input.database_id
  })

  if (!database.data_sources || database.data_sources.length === 0) {
    throw new NotionMCPError('No data sources found in database', 'VALIDATION_ERROR', 'Database has no data sources')
  }

  const dataSourceId = database.data_sources[0].id

  const items = input.pages || (input.page_properties ? [{ properties: input.page_properties }] : [])

  if (items.length === 0) {
    throw new NotionMCPError('pages or page_properties required', 'VALIDATION_ERROR', 'Provide items to create')
  }

  const results = await processBatches(items, async (item) => {
    const properties = convertToNotionProperties(item.properties)

    const page = await notion.pages.create({
      parent: { type: 'data_source_id', data_source_id: dataSourceId },
      properties
    } as any)

    return {
      page_id: page.id,
      url: (page as any).url,
      created: true
    }
  })

  return {
    action: 'create_page',
    database_id: input.database_id,
    data_source_id: dataSourceId,
    processed: results.length,
    results
  }
}

/**
 * Update pages in database (bulk)
 * Maps to: Multiple PATCH /v1/pages/{id}
 */
async function updateDatabasePages(notion: Client, input: DatabasesInput): Promise<any> {
  const items =
    input.pages ||
    (input.page_id && input.page_properties ? [{ page_id: input.page_id, properties: input.page_properties }] : [])

  if (items.length === 0) {
    throw new NotionMCPError('pages or page_id+page_properties required', 'VALIDATION_ERROR', 'Provide items to update')
  }

  const results = await processBatches(items, async (item) => {
    if (!item.page_id) {
      throw new NotionMCPError('page_id required for each item', 'VALIDATION_ERROR', 'Provide page_id')
    }

    const properties = convertToNotionProperties(item.properties)

    await notion.pages.update({
      page_id: item.page_id,
      properties
    })

    return {
      page_id: item.page_id,
      updated: true
    }
  })

  return {
    action: 'update_page',
    processed: results.length,
    results
  }
}

/**
 * Delete pages in database (bulk archive)
 * Maps to: Multiple PATCH /v1/pages/{id} with archived: true
 */
async function deleteDatabasePages(notion: Client, input: DatabasesInput): Promise<any> {
  const pageIds =
    input.page_ids ||
    (input.page_id ? [input.page_id] : []) ||
    (input.pages ? input.pages.map((p) => p.page_id!).filter(Boolean) : [])

  if (pageIds.length === 0) {
    throw new NotionMCPError('page_id or page_ids required', 'VALIDATION_ERROR', 'Provide page IDs to delete')
  }

  const results = await processBatches(
    pageIds,
    async (pageId) => {
      await notion.pages.update({
        page_id: pageId,
        archived: true
      })

      return {
        page_id: pageId,
        deleted: true
      }
    },
    { batchSize: 5, concurrency: 3 }
  )

  return {
    action: 'delete_page',
    processed: results.length,
    results
  }
}

/**
 * Create additional data source for existing database
 * Maps to: POST /v1/data_sources (API 2025-09-03)
 */
async function createDataSource(notion: Client, input: DatabasesInput): Promise<any> {
  if (!input.database_id || !input.title || !input.properties) {
    throw new NotionMCPError(
      'database_id, title, and properties required',
      'VALIDATION_ERROR',
      'Provide database_id, title, and properties for new data source'
    )
  }

  const dataSourceData: any = {
    parent: { type: 'database_id', database_id: input.database_id },
    title: [RichText.text(input.title)],
    properties: input.properties
  }

  if (input.description) {
    dataSourceData.description = [RichText.text(input.description)]
  }

  const dataSource: any = await (notion as any).dataSources.create(dataSourceData)

  return {
    action: 'create_data_source',
    data_source_id: dataSource.id,
    database_id: input.database_id,
    created: true
  }
}

/**
 * Update data source (title, description, properties/schema)
 * Maps to: PATCH /v1/data_sources/{id} (API 2025-09-03)
 */
async function updateDataSource(notion: Client, input: DatabasesInput): Promise<any> {
  if (!input.data_source_id) {
    throw new NotionMCPError('data_source_id required', 'VALIDATION_ERROR', 'Provide data_source_id')
  }

  const updates: any = {}

  if (input.title) {
    updates.title = [RichText.text(input.title)]
  }

  if (input.description) {
    updates.description = [RichText.text(input.description)]
  }

  if (input.properties) {
    updates.properties = input.properties
  }

  if (Object.keys(updates).length === 0) {
    throw new NotionMCPError(
      'No updates provided',
      'VALIDATION_ERROR',
      'Provide title, description, or properties to update'
    )
  }

  await (notion as any).dataSources.update({
    data_source_id: input.data_source_id,
    ...updates
  })

  return {
    action: 'update_data_source',
    data_source_id: input.data_source_id,
    updated: true
  }
}

/**
 * Update database container (parent, title, is_inline, icon, cover)
 * Maps to: PATCH /v1/databases/{id} (API 2025-09-03)
 */
async function updateDatabaseContainer(notion: Client, input: DatabasesInput): Promise<any> {
  if (!input.database_id) {
    throw new NotionMCPError('database_id required', 'VALIDATION_ERROR', 'Provide database_id')
  }

  const updates: any = {}

  if (input.parent_id) {
    updates.parent = { type: 'page_id', page_id: input.parent_id }
  }

  if (input.title) {
    updates.title = [RichText.text(input.title)]
  }

  if (input.description) {
    updates.description = [RichText.text(input.description)]
  }

  if (input.is_inline !== undefined) {
    updates.is_inline = input.is_inline
  }

  if (input.icon) {
    updates.icon = { type: 'emoji', emoji: input.icon }
  }

  if (input.cover) {
    updates.cover = { type: 'external', external: { url: input.cover } }
  }

  if (Object.keys(updates).length === 0) {
    throw new NotionMCPError(
      'No updates provided',
      'VALIDATION_ERROR',
      'Provide parent_id, title, description, is_inline, icon, or cover'
    )
  }

  await notion.databases.update({
    database_id: input.database_id,
    ...updates
  })

  return {
    action: 'update_database',
    database_id: input.database_id,
    updated: true
  }
}
