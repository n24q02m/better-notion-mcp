import type { Client } from '@notionhq/client'
import { NotionMCPError } from '../../helpers/errors.js'
import { autoPaginate } from '../../helpers/pagination.js'
import { formatDatabaseResults, getSmartSearchFilter, resolveDataSourceId } from './helpers.js'
import type { DatabasesInput, QueryDatabaseResponse } from './types.js'

/**
 * Query database (via data source)
 * Maps to: POST /v1/data_sources/{id}/query (API 2025-09-03)
 */
export async function queryDatabase(notion: Client, input: DatabasesInput): Promise<QueryDatabaseResponse> {
  if (!input.database_id) {
    throw new NotionMCPError(
      'database_id required for query action',
      'VALIDATION_ERROR',
      'Provide database_id (from Notion URL) or data_source_id (from workspace search). Both formats are accepted.'
    )
  }

  // Smart resolve: accepts both database_id and data_source_id
  const { databaseId, dataSourceId } = await resolveDataSourceId(notion, input.database_id)

  const queryParams: any = {
    data_source_id: dataSourceId
  }

  if (input.filters || input.search) {
    let filter = input.filters
    if (input.search) {
      const searchFilter = await getSmartSearchFilter(notion, dataSourceId, input.search)
      if (searchFilter) {
        if (filter) {
          // Combine explicit filters with smart search filter
          filter = { and: [filter, searchFilter] }
        } else {
          filter = searchFilter
        }
      }
    }
    if (filter) queryParams.filter = filter
  }

  if (input.sorts) {
    queryParams.sorts = input.sorts
  }

  // Handle pagination and limit
  const allResults = await autoPaginate(async (cursor?: string) => {
    const response: any = await (notion as any).dataSources.query({
      ...queryParams,
      start_cursor: cursor,
      page_size: input.limit ? Math.min(input.limit, 100) : 100
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
  const formattedResults = formatDatabaseResults(results)

  return {
    action: 'query',
    database_id: databaseId,
    data_source_id: dataSourceId,
    total: formattedResults.length,
    results: formattedResults
  }
}
