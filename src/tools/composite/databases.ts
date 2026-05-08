/**
 * Databases Tool - Refactored for modularity
 * Updated for Notion API 2025-09-03
 * Supports data_sources architecture
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { createDatabase, getDatabase, updateDatabaseContainer } from './databases/core.js'
import { createDataSource, listDataSourceTemplates, updateDataSource } from './databases/data-sources.js'
import { createDatabasePages, deleteDatabasePages, updateDatabasePages } from './databases/pages.js'
import { queryDatabase } from './databases/query.js'
import type { DatabasesInput, DatabasesResponse } from './databases/types.js'

export * from './databases/helpers.js'
// Re-export types and helpers for backward compatibility
export * from './databases/types.js'

/**
 * Unified databases tool - handles all database operations
 */
export async function databases(notion: Client, input: DatabasesInput): Promise<DatabasesResponse> {
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

      case 'list_templates':
        return await listDataSourceTemplates(notion, input)

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: create, get, query, create_page, update_page, delete_page, create_data_source, update_data_source, update_database, list_templates'
        )
    }
  })()
}
