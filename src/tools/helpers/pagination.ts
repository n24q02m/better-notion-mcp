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
}

/**
 * Fetch all pages automatically
 */
export async function autoPaginate<T>(
  fetchFn: (cursor?: string, pageSize?: number) => Promise<PaginatedResponse<T>>,
  options: PaginationOptions = {}
): Promise<T[]> {
  const { maxPages = 0, pageSize = 100 } = options
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
  } while (cursor !== null)

  return allResults
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
 * Uses a sliding window to process items efficiently while respecting rate limits.
 * Default concurrency is 3 requests at a time (safe for Notion API).
 */
export async function processBatches<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: { batchSize?: number; concurrency?: number } = {}
): Promise<R[]> {
  // Default batchSize changed from 10 to 1 to prevent accidental high concurrency
  // Default concurrency kept at 3
  // Total concurrency = batchSize * concurrency
  const batchSize = options.batchSize ?? 1
  const concurrency = options.concurrency ?? 3
  const limit = batchSize * concurrency

  const results: Promise<R>[] = []
  const executing: Set<Promise<any>> = new Set()

  for (const item of items) {
    const p = processFn(item)
    results.push(p)

    // Track execution for concurrency control
    // Use finally to ensure we clean up even if the promise rejects
    const e = p.finally(() => {
      executing.delete(e)
    })
    executing.add(e)

    if (executing.size >= limit) {
      // Wait for at least one promise to finish
      // If a promise rejects, Promise.race rejects, stopping the loop (fail-fast)
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}
