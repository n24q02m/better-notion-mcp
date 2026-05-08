import type { Client } from '@notionhq/client'
import { NotionMCPError } from '../../helpers/errors.js'
import { processBatches } from '../../helpers/pagination.js'
import { convertToNotionProperties } from '../../helpers/properties.js'
import { getDataSourceSchema, resolveDataSourceId } from './helpers.js'
import type {
  CreateDatabasePageResponse,
  DatabasesInput,
  DeleteDatabasePageResponse,
  UpdateDatabasePageResponse
} from './types.js'

/**
 * Create pages in database (via data source)
 * Maps to: Multiple POST /v1/pages with data_source_id parent (API 2025-09-03)
 */
export async function createDatabasePages(notion: Client, input: DatabasesInput): Promise<CreateDatabasePageResponse> {
  if (!input.database_id) {
    throw new NotionMCPError(
      'database_id required',
      'VALIDATION_ERROR',
      'Provide database_id (from Notion URL) or data_source_id (from workspace search). Both formats are accepted.'
    )
  }

  // Smart resolve: accepts both database_id and data_source_id
  const { databaseId, dataSourceId } = await resolveDataSourceId(notion, input.database_id)

  // Fetch schema for property type mapping
  const properties = await getDataSourceSchema(notion, dataSourceId)
  const schema: Record<string, string> = {}
  if (properties) {
    for (const [name, prop] of Object.entries(properties)) {
      schema[name] = (prop as any).type
    }
  }

  const items = input.pages || (input.page_properties ? [{ properties: input.page_properties }] : [])

  if (items.length === 0) {
    throw new NotionMCPError('pages or page_properties required', 'VALIDATION_ERROR', 'Provide items to create')
  }

  // Validate all items before processing to avoid partial writes on malformed input
  for (let i = 0; i < items.length; i++) {
    if (!items[i] || items[i].properties === undefined || items[i].properties === null) {
      throw new NotionMCPError(
        `Item at index ${i} in the pages array is missing the "properties" key`,
        'VALIDATION_ERROR',
        'Use format: pages: [{ "properties": { "FieldName": "value" } }] - not flat objects like [{ "FieldName": "value" }]'
      )
    }
  }

  const results = await processBatches(items, async (item: any) => {
    const properties = convertToNotionProperties(item.properties, schema)

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
    database_id: databaseId,
    data_source_id: dataSourceId,
    processed: results.length,
    results
  }
}

/**
 * Update pages in database (bulk)
 * Maps to: Multiple PATCH /v1/pages/{id}
 */
export async function updateDatabasePages(notion: Client, input: DatabasesInput): Promise<UpdateDatabasePageResponse> {
  const items =
    input.pages ||
    (input.page_id && input.page_properties ? [{ page_id: input.page_id, properties: input.page_properties }] : [])

  if (items.length === 0) {
    throw new NotionMCPError('pages or page_id+page_properties required', 'VALIDATION_ERROR', 'Provide items to update')
  }

  // Validate all items before processing to avoid partial writes on malformed input
  for (let i = 0; i < items.length; i++) {
    if (!items[i] || items[i].properties === undefined || items[i].properties === null) {
      throw new NotionMCPError(
        `Item at index ${i} in the pages array is missing the "properties" key`,
        'VALIDATION_ERROR',
        'Use format: pages: [{ "page_id": "...", "properties": { "FieldName": "value" } }]'
      )
    }
  }

  const results = await processBatches(items, async (item: any) => {
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
export async function deleteDatabasePages(notion: Client, input: DatabasesInput): Promise<DeleteDatabasePageResponse> {
  let pageIds = input.page_ids || (input.page_id ? [input.page_id] : [])
  if (!pageIds || pageIds.length === 0) {
    if (input.pages) {
      pageIds = []
      for (const p of input.pages) {
        if (p.page_id) {
          pageIds.push(p.page_id)
        }
      }
    } else {
      pageIds = []
    }
  }

  if (pageIds.length === 0) {
    throw new NotionMCPError('page_id or page_ids required', 'VALIDATION_ERROR', 'Provide page IDs to delete')
  }

  const results = await processBatches(
    pageIds,
    async (pageId: string) => {
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
