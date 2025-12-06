/**
 * Workspace Mega Tool
 * Workspace exploration and info
 */

import { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { autoPaginate } from '../helpers/pagination.js'

export interface WorkspaceInput {
  action: 'info' | 'search'

  // Search params
  query?: string
  filter?: {
    object?: 'page' | 'data_source'
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
 * Unified workspace tool
 * Maps to: GET /v1/users/me and POST /v1/search
 */
export async function workspace(notion: Client, input: WorkspaceInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'info': {
        const botUser = await notion.users.retrieve({ user_id: 'me' })

        return {
          action: 'info',
          bot: {
            id: (botUser as any).id,
            name: (botUser as any).name || 'Bot',
            type: (botUser as any).type,
            owner: (botUser as any).bot?.owner
          }
        }
      }

      case 'search': {
        // Query is optional - empty query returns all accessible pages
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
          action: 'search',
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
      }

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: info, search'
        )
    }
  })()
}
