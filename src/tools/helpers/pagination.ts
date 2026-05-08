import type { Client } from '@notionhq/client'

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
 * Simple concurrency queue to manage parallel tasks with a limit.
 * Supports optional fail-fast (stops starting new tasks if one fails).
 */
export class ConcurrencyQueue {
  private activeCount = 0
  private queue: (() => void)[] = []
  private hasError = false

  constructor(
    private readonly limit: number,
    private readonly failFast = true
  ) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.failFast && this.hasError) {
      throw new Error('Queue stopped due to previous error')
    }

    if (this.activeCount >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    if (this.failFast && this.hasError) {
      throw new Error('Queue stopped due to previous error')
    }

    this.activeCount++
    try {
      return await task()
    } catch (error) {
      if (this.failFast) {
        this.hasError = true
        // Notify all waiting tasks to wake up and see the error
        const waiters = this.queue
        this.queue = []
        for (const resolve of waiters) {
          resolve()
        }
      }
      throw error
    } finally {
      this.activeCount--
      if (this.queue.length > 0 && (!this.failFast || !this.hasError)) {
        const next = this.queue.shift()
        next?.()
      }
    }
  }
}

/**
 * Recursively fetch children for blocks that need them (tables, toggles, columns, etc.)
 * Mutates blocks in-place by attaching children arrays.
 *
 * Optimized with:
 * 1. Breadth-first parallel fetching (minimizes N+1 impact)
 * 2. Promise.allSettled for resilience (one sibling failing doesn't stop others)
 * 3. Session-scoped cache for in-flight deduplication (avoids multi-tenant data leaks)
 */
export async function fetchChildrenRecursive(
  blocks: any[],
  fetchChildren: (blockId: string) => Promise<any[]>,
  depth = 0,
  queue?: ConcurrencyQueue,
  sessionCache?: Map<string, any[]>
): Promise<void> {
  if (depth >= MAX_DEPTH || !blocks.length) return

  // 1. Identify blocks at current level that need children
  const targetBlocks = blocks.filter((block) => block.has_children && BLOCKS_NEEDING_CHILDREN.has(block.type))

  if (targetBlocks.length === 0) return

  // 2. Fetch children in parallel for unique IDs at this level
  const uniqueIds = Array.from(new Set(targetBlocks.map((b) => b.id)))
  const resultsMap = new Map<string, any[]>()

  const fetchResults = await Promise.allSettled(
    uniqueIds.map(async (id) => {
      // Check session cache for in-flight deduplication (e.g. from higher levels)
      const cached = sessionCache?.get(id)
      if (cached) return { id, children: cached }

      // Fetch fresh data
      const children = queue ? await queue.run(() => fetchChildren(id)) : await fetchChildren(id)

      // Update session cache
      sessionCache?.set(id, children)
      return { id, children }
    })
  )

  // 3. Attach results and collect all discovered children for recursion
  const allDiscoveredChildren: any[] = []

  // Populate resultsMap for quick lookup
  for (const result of fetchResults) {
    if (result.status === 'fulfilled') {
      resultsMap.set(result.value.id, result.value.children)
    } else {
      // Error handling is done per-block below
    }
  }

  for (const block of targetBlocks) {
    const children = resultsMap.get(block.id)
    if (children) {
      // Attach children to the correct property based on block type
      if (block[block.type]) {
        block[block.type].children = children
      }
      allDiscoveredChildren.push(...children)
    } else {
      // Look for the specific error in fetchResults if it failed for this ID
      const resultIdx = uniqueIds.indexOf(block.id)
      const result = fetchResults[resultIdx]
      if (result && result.status === 'rejected') {
        console.error(`Failed to fetch children for block ${block.id}:`, result.reason)
      }
    }
  }

  // 4. Recurse into the next level (breadth-first)
  if (allDiscoveredChildren.length > 0) {
    await fetchChildrenRecursive(allDiscoveredChildren, fetchChildren, depth + 1, queue, sessionCache)
  }
}

/**
 * Process items in batches with concurrency limit using ConcurrencyQueue
 */
export async function processBatches<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: { batchSize?: number; concurrency?: number } = {}
): Promise<R[]> {
  const { batchSize = 10, concurrency = 3 } = options
  const totalConcurrency = batchSize * concurrency

  const queue = new ConcurrencyQueue(totalConcurrency)
  const promises = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    promises[i] = queue.run(() => processFn(item))
  }
  return Promise.all(promises)
}

/**
 * Recursively fetch and populate children for blocks using auto-pagination
 */
export async function populateDeepChildren(notion: Client, blocks: any[]): Promise<void> {
  // Use a shared queue to cap total concurrent Notion API calls at 5 across the whole tree
  // Set failFast to false to allow parallel sibling fetches even if one fails
  const queue = new ConcurrencyQueue(5, false)

  // Use a local Map for deduplication within this tool call.
  // This avoids multi-tenant data leaks inherent in module-level caching.
  const sessionCache = new Map<string, any[]>()

  await fetchChildrenRecursive(
    blocks,
    async (blockId) => {
      return autoPaginate((cursor) =>
        notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 })
      ) as any
    },
    0,
    queue,
    sessionCache
  )
}
