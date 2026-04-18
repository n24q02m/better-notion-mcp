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
    const results = response.results
    if (results) {
      const resultsLen = results.length
      for (let i = 0; i < resultsLen; i++) {
        allResults.push(results[i])
      }
    }
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
 * Supports fail-fast (stops starting new tasks if one fails).
 */
export class ConcurrencyQueue {
  private activeCount = 0
  private queue: (() => void)[] = []
  private hasError = false

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.hasError) {
      throw new Error('Queue stopped due to previous error')
    }

    if (this.activeCount >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    if (this.hasError) {
      throw new Error('Queue stopped due to previous error')
    }

    this.activeCount++
    try {
      return await task()
    } catch (error) {
      this.hasError = true
      // Notify all waiting tasks to wake up and see the error
      const waiters = this.queue
      this.queue = []
      const waitersLen = waiters.length
      for (let i = 0; i < waitersLen; i++) {
        waiters[i]()
      }
      throw error
    } finally {
      this.activeCount--
      if (this.queue.length > 0 && !this.hasError) {
        const next = this.queue.shift()
        next?.()
      }
    }
  }
}

/**
 * Recursively fetch children for blocks that need them (tables, toggles, columns, etc.)
 * Mutates blocks in-place by attaching children arrays.
 */
export async function fetchChildrenRecursive(
  blocks: any[],
  fetchChildren: (blockId: string) => Promise<any[]>,
  depth = 0,
  queue?: ConcurrencyQueue
): Promise<void> {
  if (depth >= MAX_DEPTH || !blocks || blocks.length === 0) return

  const fetchAndRecurse = async (block: any) => {
    const children = queue ? await queue.run(() => fetchChildren(block.id)) : await fetchChildren(block.id)

    // Attach children to the correct property based on block type
    const blockType = block.type
    if (blockType && block[blockType]) {
      block[blockType].children = children
    }

    // Recurse into children
    await fetchChildrenRecursive(children, fetchChildren, depth + 1, queue)
  }

  const promises: Promise<void>[] = []
  const blocksLen = blocks.length
  for (let i = 0; i < blocksLen; i++) {
    const block = blocks[i]
    if (block?.has_children && BLOCKS_NEEDING_CHILDREN.has(block.type)) {
      promises.push(fetchAndRecurse(block))
    }
  }

  if (promises.length > 0) {
    const results = await Promise.allSettled(promises)
    let firstError: any = null
    const resultsLen = results.length
    for (let i = 0; i < resultsLen; i++) {
      const res = results[i]
      if (res.status === 'rejected') {
        firstError = firstError || res.reason
      }
    }

    if (firstError) {
      throw firstError
    }
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
  const itemsLen = items.length
  const promises = new Array(itemsLen)
  for (let i = 0; i < itemsLen; i++) {
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
  const queue = new ConcurrencyQueue(5)

  await fetchChildrenRecursive(
    blocks,
    async (blockId) => {
      return autoPaginate((cursor) =>
        notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 })
      ) as any
    },
    0,
    queue
  )
}
