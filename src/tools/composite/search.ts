/**
 * Search Composite Tool
 * Smart context-aware search across workspace
 */

import type { Client } from '@notionhq/client'
import { withErrorHandling } from '../helpers/errors.js'
import * as RichText from '../helpers/richtext.js'

export interface SearchSmartInput {
  query: string
  filter?: {
    object?: 'page' | 'database'
    property?: string
    value?: any
  }
  sort?: {
    direction: 'ascending' | 'descending'
    timestamp: 'last_edited_time' | 'created_time'
  }
  limit?: number
}

/**
 * Smart search with context-aware ranking
 */
export async function searchSmart(notion: Client, input: SearchSmartInput): Promise<any> {
  return withErrorHandling(async () => {
    const searchParams: any = {
      query: input.query,
      page_size: Math.min(input.limit || 100, 100)
    }

    if (input.filter) {
      searchParams.filter = input.filter
    }

    if (input.sort) {
      searchParams.sort = input.sort
    }

    const response = await notion.search(searchParams)

    const results = response.results.map((item: any) => {
      if (item.object === 'page') {
        return {
          type: 'page',
          id: item.id,
          url: item.url,
          title: extractTitle(item),
          created_time: item.created_time,
          last_edited_time: item.last_edited_time,
          archived: item.archived,
          parent: formatParent(item.parent)
        }
      } else if (item.object === 'database') {
        return {
          type: 'database',
          id: item.id,
          url: item.url,
          title: extractDatabaseTitle(item),
          created_time: item.created_time,
          last_edited_time: item.last_edited_time,
          archived: item.archived,
          description: item.description
        }
      }
      return item
    })

    return {
      query: input.query,
      total_results: results.length,
      has_more: response.has_more,
      results
    }
  })()
}

/**
 * Extract title from page
 */
function extractTitle(page: any): string {
  if (!page.properties) return 'Untitled'

  const titleProp = Object.values(page.properties).find((prop: any) => prop.type === 'title') as any

  if (titleProp?.title && titleProp.title.length > 0) {
    return RichText.extractPlainText(titleProp.title)
  }

  return 'Untitled'
}

/**
 * Extract database title
 */
function extractDatabaseTitle(database: any): string {
  if (database.title && database.title.length > 0) {
    return RichText.extractPlainText(database.title)
  }
  return 'Untitled Database'
}

/**
 * Format parent information
 */
function formatParent(parent: any): any {
  if (parent.type === 'workspace') {
    return { type: 'workspace' }
  } else if (parent.type === 'page_id') {
    return { type: 'page', id: parent.page_id }
  } else if (parent.type === 'database_id') {
    return { type: 'database', id: parent.database_id }
  }
  return parent
}
