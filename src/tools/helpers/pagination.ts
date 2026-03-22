/**
 * Pagination Helper
 * Auto-handles paginated Notion API responses
 */

/** Safety limit to prevent infinite loops if API always returns has_more: true */
const MAX_PAGES_SAFETY = 1000

export interface PaginatedResponse<T> {
  results: T[]
  next_cursor: string | null
  has_more: boolean
}

export interface PaginationOptions {
  maxPages?: number // Max pages to fetch (0 = unlimited, capped by MAX_PAGES_SAFETY)
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
  const effectiveMax = maxPages > 0 ? Math.min(maxPages, MAX_PAGES_SAFETY) : MAX_PAGES_SAFETY
  const allResults: T[] = []
  let cursor: string | null = null
  let pageCount = 0

  do {
    const response = await fetchFn(cursor || undefined, pageSize)
    allResults.push(...response.results)
    cursor = response.next_cursor
    pageCount++

    // Stop if max pages reached (user-specified or safety limit)
    if (pageCount >= effectiveMax) {
      break
    }
  } while (cursor !== null)

  return allResults
}

/** Block types that need children fetched for proper markdown rendering */
const BLOCKS_NEEDING_CHILDREN = new Set([
  'table',
  'toggle',
  'column_list',
  'column',
  'callout',
  'quote',
  'bulleted_list_item',
  'numbered_list_item',
  'heading_1',
  'heading_2',
  'heading_3'
])

/** Max recursion depth to prevent runaway API calls (5 covers deeply nested lists/toggles) */
const MAX_DEPTH = 5

/**
 * Recursively fetch children for blocks that need them (tables, toggles, columns, etc.)
 * Mutates blocks in-place by attaching children arrays.
 */
export async function fetchChildrenRecursive(
  blocks: any[],
  fetchChildren: (blockId: string) => Promise<any[]>,
  depth = 0
): Promise<void> {
  if (depth >= MAX_DEPTH) return

  const blocksNeedingChildren = blocks.filter((b) => b.has_children && BLOCKS_NEEDING_CHILDREN.has(b.type))

  if (blocksNeedingChildren.length === 0) return

  const recursivePromises: Promise<void>[] = []

  // Fetch children in parallel (batch of 5 to respect rate limits)
  for (let i = 0; i < blocksNeedingChildren.length; i += 5) {
    const batch = blocksNeedingChildren.slice(i, i + 5)
    const childrenResults = await Promise.all(batch.map((b) => fetchChildren(b.id)))
    for (let j = 0; j < batch.length; j++) {
      const block = batch[j]
      const children = childrenResults[j]
      // Attach children to the correct property based on block type
      if (block[block.type]) {
        block[block.type].children = children
      }
      // Recurse into children
      recursivePromises.push(fetchChildrenRecursive(children, fetchChildren, depth + 1))
    }
  }

  // ⚡ Bolt: Parallelize recursive tree traversal by awaiting all children's
  // recursion after processing all batches at the current depth, rather than
  // sequentially waiting for each batch's deep traversal to finish.
  await Promise.all(recursivePromises)
}

/**
 * Process items in batches with concurrency limit using a rolling window
 */
export async function processBatches<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: { batchSize?: number; concurrency?: number } = {}
): Promise<R[]> {
  const { batchSize = 10, concurrency = 3 } = options
  const itemConcurrency = batchSize * concurrency

  const results: R[] = new Array(items.length)
  let currentIndex = 0

  let hasError = false

  const worker = async () => {
    while (currentIndex < items.length && !hasError) {
      const index = currentIndex++
      try {
        results[index] = await processFn(items[index])
      } catch (error) {
        hasError = true
        throw error
      }
    }
  }

  const workers = Array.from({ length: Math.min(itemConcurrency, items.length) }, () => worker())

  await Promise.all(workers)

  return results
}
