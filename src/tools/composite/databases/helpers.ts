import type { Client } from '@notionhq/client'
import { NotionMCPError } from '../../helpers/errors.js'
import { normalizeId } from '../../helpers/id.js'
import { extractPageProperties } from '../../helpers/properties.js'

// Cache for data source schema (properties)
export const schemaCache = new Map<string, { properties: any; expiresAt: number }>()
const SCHEMA_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get data source properties with caching
 */
export async function getDataSourceSchema(notion: Client, dataSourceId: string): Promise<any> {
  const cached = schemaCache.get(dataSourceId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.properties
  }

  const dataSource: any = await (notion as any).dataSources.retrieve({
    data_source_id: dataSourceId
  })
  const properties = dataSource.properties

  if (properties) {
    schemaCache.set(dataSourceId, {
      properties,
      expiresAt: Date.now() + SCHEMA_CACHE_TTL
    })
  }

  return properties
}

/**
 * Build a filter that searches across all title and rich_text properties
 */
export function buildSearchFilter(properties: any, search: string): any | null {
  const textProps = []
  if (properties) {
    for (const name of Object.keys(properties)) {
      const prop = properties[name]
      if (['title', 'rich_text'].includes(prop.type)) {
        textProps.push(name)
      }
    }
  }

  if (textProps.length > 0) {
    return {
      or: textProps.map((propName) => ({
        property: propName,
        rich_text: { contains: search }
      }))
    }
  }

  return null
}

/**
 * Get search filter for text properties
 */
export async function getSmartSearchFilter(notion: Client, dataSourceId: string, search: string): Promise<any | null> {
  const properties = await getDataSourceSchema(notion, dataSourceId)
  return buildSearchFilter(properties, search)
}

/**
 * Format raw Notion page results into AI-friendly property objects
 */
export function formatDatabaseResults(results: any[]): Record<string, any>[] {
  const formattedResults = new Array(results.length)
  for (let i = 0; i < results.length; i++) {
    const page: any = results[i]
    const props = extractPageProperties(page.properties)
    props.page_id = page.id
    props.url = page.url

    formattedResults[i] = props
  }
  return formattedResults
}

/**
 * Smart ID resolution: accepts both database container ID and data_source ID
 * Tries database_id first; if NOT_FOUND, tries as data_source_id
 * Returns both IDs for downstream operations
 */
export async function resolveDataSourceId(
  notion: Client,
  id: string
): Promise<{ databaseId: string; dataSourceId: string }> {
  const normalized = normalizeId(id)

  // Try as database container first
  try {
    const database: any = await notion.databases.retrieve({ database_id: normalized })
    if (database.data_sources?.length > 0) {
      return { databaseId: database.id, dataSourceId: database.data_sources[0].id }
    }
    throw new NotionMCPError(
      'Database has no data sources',
      'VALIDATION_ERROR',
      'This database container has no data sources yet. Use create_data_source to add one.'
    )
  } catch (error: any) {
    if (error instanceof NotionMCPError) throw error

    // If NOT_FOUND, try interpreting as data_source_id
    if (error.code === 'object_not_found') {
      try {
        const ds: any = await (notion as any).dataSources.retrieve({ data_source_id: normalized })
        return {
          databaseId: ds.parent?.database_id || normalized,
          dataSourceId: ds.id
        }
      } catch {
        throw new NotionMCPError(
          `ID "${id}" is not a valid database or data source`,
          'NOT_FOUND',
          'Use the database ID from the Notion URL (e.g., notion.so/<database_id>?...), or a data_source_id from workspace search. Try workspace/search with filter.object="data_source" to find available databases.'
        )
      }
    }
    throw error
  }
}
