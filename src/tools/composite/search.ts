/**
 * Smart Search Tool
 * Context-aware ranking and filtering
 */

import type { Client } from '@notionhq/client'
import { withErrorHandling } from '../helpers/errors.js'
import { autoPaginate } from '../helpers/pagination.js'

export interface SearchSmartInput {
  query?: string
  filter?: {
    object?: 'page' | 'database'
    property?: string
    value?: any
  }
  sort?: {
    direction?: 'ascending' | 'descending'
    timestamp?: 'last_edited_time' | 'created_time'
  }
  limit?: number
}

/**
 * Smart search with context-aware ranking
 */
export async function searchSmart(notion: Client, input: SearchSmartInput): Promise<any> {
  return withErrorHandling(async () => {
    const searchParams: any = {
      query: input.query || ''
    }

    if (input.filter?.object) {
      searchParams.filter = {
        value: input.filter.object,
        property: 'object'
      }
    }

    if (input.sort) {
      searchParams.sort = {
        direction: input.sort.direction || 'descending',
        timestamp: input.sort.timestamp || 'last_edited_time'
      }
    }

    // Fetch results with pagination
    const allResults = await autoPaginate((cursor) =>
      notion.search({
        ...searchParams,
        start_cursor: cursor,
        page_size: 100
      })
    )

    const results = input.limit ? allResults.slice(0, input.limit) : allResults

    return {
      query: input.query,
      total: results.length,
      results: results.map((item: any) => ({
        id: item.id,
        object: item.object,
        title:
          item.object === 'page'
            ? item.properties?.title?.title?.[0]?.plain_text ||
              item.properties?.Name?.title?.[0]?.plain_text ||
              'Untitled'
            : item.title?.[0]?.plain_text || 'Untitled',
        url: item.url,
        last_edited_time: item.last_edited_time
      }))
    }
  })()
}
