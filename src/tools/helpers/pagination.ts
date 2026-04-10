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

export interface PaginationOptions<T = any> {
  maxPages?: number // Max pages to fetch (0 = unlimited, capped by MAX_PAGES_SAFETY)
  pageSize?: number // Items per page (default: 100)
  onPage?: (results: T[]) => Promise<void> | void // Callback for each page (enables streaming)
}

/**
 * Fetch all pages automatically
 */
export async function autoPaginate<T>(
  fetchFn: (cursor?: string, pageSize?: number) => Promise<PaginatedResponse<T>>,
  options: PaginationOptions<T> = {}
): Promise<T[]> {
  const { maxPages = 0, pageSize = 100, onPage } = options
  const effectiveMax = maxPages > 0 ? Math.min(maxPages, MAX_PAGES_SAFETY) : MAX_PAGES_SAFETY
  const allResults: T[] = []
  let cursor: string | null = null
  let pageCount = 0

  do {
    const response = await fetchFn(cursor || undefined, pageSize)
    allResults.push(...response.results)

    if (onPage) {
      await onPage(response.results)
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
      for (const resolve of waiters) {
        resolve()
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
  notion: Client,
  blocks: any[],
  depth = 0,
  queue?: ConcurrencyQueue
): Promise<void> {
  if (depth >= MAX_DEPTH) return

  const fetchAndRecurse = async (block: any) => {
    const children: any[] = []

    await autoPaginate(
      (cursor) => {
        const task = () =>
          notion.blocks.children.list({
            block_id: block.id,
            start_cursor: cursor,
            page_size: 100
          })
        return (queue ? queue.run(task) : task()) as Promise<PaginatedResponse<any>>
      },
      {
        onPage: async (pageResults) => {
          children.push(...pageResults)
          // Recurse into this page's children immediately! (Streaming Recursion)
          await fetchChildrenRecursive(notion, pageResults, depth + 1, queue)
        }
      }
    )

    // Attach all collected children to the correct property based on block type
    if (block[block.type]) {
      block[block.type].children = children
    }
  }

  const promises: Promise<void>[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.has_children && BLOCKS_NEEDING_CHILDREN.has(block.type)) {
      promises.push(fetchAndRecurse(block))
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises)
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
  const queue = new ConcurrencyQueue(5)
  await fetchChildrenRecursive(notion, blocks, 0, queue)
}
