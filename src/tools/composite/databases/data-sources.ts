import type { Client } from '@notionhq/client'
import { NotionMCPError } from '../../helpers/errors.js'
import { autoPaginate } from '../../helpers/pagination.js'
import * as RichText from '../../helpers/richtext.js'
import { resolveDataSourceId } from './helpers.js'
import type {
  CreateDataSourceResponse,
  DatabasesInput,
  ListDataSourceTemplatesResponse,
  UpdateDataSourceResponse
} from './types.js'

/**
 * Create additional data source for existing database
 * Maps to: POST /v1/data_sources (API 2025-09-03)
 */
export async function createDataSource(notion: Client, input: DatabasesInput): Promise<CreateDataSourceResponse> {
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
export async function updateDataSource(notion: Client, input: DatabasesInput): Promise<UpdateDataSourceResponse> {
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
 * List data source templates
 * Maps to: GET /v1/data_sources/{id}/templates (API 2025-09-03)
 */
export async function listDataSourceTemplates(
  notion: Client,
  input: DatabasesInput
): Promise<ListDataSourceTemplatesResponse> {
  if (!input.database_id) {
    throw new NotionMCPError(
      'database_id required for list_templates action',
      'VALIDATION_ERROR',
      'Provide database_id (from Notion URL) or data_source_id. Both formats are accepted.'
    )
  }

  // Smart resolve: accepts both database_id and data_source_id
  const { databaseId, dataSourceId: resolvedDsId } = await resolveDataSourceId(notion, input.database_id)
  const dataSourceId = input.data_source_id || resolvedDsId

  const templates = await autoPaginate(async (cursor?: string) => {
    const response: any = await (notion as any).dataSources.listTemplates({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100
    })
    return {
      results: response.templates || response.results,
      next_cursor: response.next_cursor,
      has_more: response.has_more
    }
  })

  return {
    action: 'list_templates',
    database_id: databaseId,
    data_source_id: dataSourceId,
    total: templates.length,
    templates: templates.map((t: any) => ({
      template_id: t.id,
      title: t.properties?.title?.title?.[0]?.plain_text || t.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
      properties: t.properties
    }))
  }
}
