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
 */
export async function processBatches<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: { batchSize?: number; concurrency?: number } = {}
): Promise<R[]> {
  const { batchSize = 1, concurrency = 3 } = options
  const limit = Math.max(1, batchSize * concurrency)

  if (items.length === 0) {
    return []
  }

  // Use sliding window concurrency
  return new Promise<R[]>((resolve, reject) => {
    const results = new Array<R>(items.length)
    let currentIndex = 0
    let activeCount = 0
    let rejected = false
    let completedCount = 0

    const next = () => {
      if (rejected) return

      // Check completion
      if (completedCount === items.length) {
        resolve(results)
        return
      }

      // Start new tasks
      while (currentIndex < items.length && activeCount < limit) {
        if (rejected) break

        const index = currentIndex
        currentIndex++
        activeCount++

        processFn(items[index])
          .then((res) => {
            if (rejected) return
            results[index] = res
            activeCount--
            completedCount++
            next()
          })
          .catch((err) => {
            rejected = true
            reject(err)
          })
      }
    }

    next()
  })
}
