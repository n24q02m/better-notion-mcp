import type { Client } from '@notionhq/client'
import { formatCover } from '../../helpers/covers.js'
import { NotionMCPError } from '../../helpers/errors.js'
import { formatIcon } from '../../helpers/icons.js'
import { normalizeId } from '../../helpers/id.js'
import * as RichText from '../../helpers/richtext.js'
import { getDataSourceSchema } from './helpers.js'
import type { CreateDatabaseResponse, DatabasesInput, GetDatabaseResponse, UpdateDatabaseResponse } from './types.js'

/**
 * Create database with initial data source
 * Maps to: POST /v1/databases (API 2025-09-03)
 */
export async function createDatabase(notion: Client, input: DatabasesInput): Promise<CreateDatabaseResponse> {
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

  if (input.icon) {
    dbData.icon = formatIcon(input.icon)
  }

  if (input.cover) {
    dbData.cover = formatCover(input.cover)
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
export async function getDatabase(notion: Client, input: DatabasesInput): Promise<GetDatabaseResponse> {
  if (!input.database_id) {
    throw new NotionMCPError('database_id required for get action', 'VALIDATION_ERROR', 'Provide database_id')
  }

  // Get database (contains list of data_sources)
  const database: any = await notion.databases.retrieve({
    database_id: normalizeId(input.database_id)
  })

  // Get detailed schema from first data source
  const schema: any = {}
  let dataSourceInfo: any = null

  if (database.data_sources && database.data_sources.length > 0) {
    const dataSourceId = database.data_sources[0].id
    const properties = await getDataSourceSchema(notion, dataSourceId)

    dataSourceInfo = {
      id: dataSourceId,
      name: database.data_sources[0].name
    }

    // Format properties for AI-friendly output
    if (properties) {
      for (const [name, prop] of Object.entries(properties)) {
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
 * Update database container (parent, title, is_inline, icon, cover)
 * Maps to: PATCH /v1/databases/{id} (API 2025-09-03)
 */
export async function updateDatabaseContainer(notion: Client, input: DatabasesInput): Promise<UpdateDatabaseResponse> {
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
    updates.icon = formatIcon(input.icon)
  }

  if (input.cover) updates.cover = formatCover(input.cover)

  if (Object.keys(updates).length === 0) {
    throw new NotionMCPError(
      'No updates provided',
      'VALIDATION_ERROR',
      'Provide parent_id, title, description, is_inline, icon, or cover'
    )
  }

  await notion.databases.update({
    database_id: normalizeId(input.database_id),
    ...updates
  })

  return {
    action: 'update_database',
    database_id: input.database_id,
    updated: true
  }
}
