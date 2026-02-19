/**
 * Pagination Helper
 * Auto-handles paginated Notion API responses
 */

export interface PaginatedResponse<T> {
  results: T[]
  next_cursor: string | null
  has_more: boolean
}

export interface PaginationOptions {
  maxPages?: number // Max pages to fetch (0 = unlimited)
  pageSize?: number // Items per page (default: 100)
  limit?: number // Max items to fetch (0 = unlimited)
}

/**
 * Fetch all pages automatically
 */
export async function autoPaginate<T>(
  fetchFn: (cursor?: string, pageSize?: number) => Promise<PaginatedResponse<T>>,
  options: PaginationOptions = {}
): Promise<T[]> {
  const { maxPages = 0, pageSize = 100, limit = 0 } = options
  const allResults: T[] = []
  let cursor: string | null = null
  let pageCount = 0

  do {
    const response = await fetchFn(cursor || undefined, pageSize)
    allResults.push(...response.results)
    cursor = response.next_cursor
    pageCount++

    // Stop if max pages reached
    if (maxPages > 0 && pageCount >= maxPages) {
      break
    }

    // Stop if limit reached
    if (limit > 0 && allResults.length >= limit) {
      break
    }
  } while (cursor !== null)

  return limit > 0 ? allResults.slice(0, limit) : allResults
}

/**
 * Fetch single page with cursor
 */
export async function fetchPage<T>(
  fetchFn: (cursor?: string, pageSize?: number) => Promise<PaginatedResponse<T>>,
  cursor?: string,
  pageSize: number = 100
): Promise<PaginatedResponse<T>> {
  return await fetchFn(cursor, pageSize)
}

/**
 * Create cursor handler for manual pagination
 */
export function createCursorHandler() {
  let currentCursor: string | null = null

  return {
    getCursor: () => currentCursor,
    setCursor: (cursor: string | null) => {
      currentCursor = cursor
    },
    reset: () => {
      currentCursor = null
    },
    hasMore: () => currentCursor !== null
  }
}

/**
 * Batch items into chunks
 */
export function batchItems<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}

/**
 * Process items in batches with concurrency limit
 */
export async function processBatches<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: { batchSize?: number; concurrency?: number } = {}
): Promise<R[]> {
  const { batchSize = 10, concurrency = 3 } = options
  const batches = batchItems(items, batchSize)
  const results: R[] = []

  for (let i = 0; i < batches.length; i += concurrency) {
    const currentBatches = batches.slice(i, i + concurrency)
    const batchPromises = currentBatches.map((batch) => Promise.all(batch.map(processFn)))
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults.flat())
  }

  return results
}
