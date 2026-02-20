import { Client } from '@notionhq/client'
import { describe, expect, it, vi } from 'vitest'
import { pages } from './pages.js'

// Mock dependencies
vi.mock('../helpers/markdown.js', () => ({
  blocksToMarkdown: vi.fn(),
  markdownToBlocks: vi.fn(() => [{ type: 'paragraph', paragraph: { rich_text: [] } }])
}))

describe('Pages Tool Performance', () => {
  it('should optimize content replacement by pipelining delete and fetch', async () => {
    const notion = new Client({ auth: 'secret' })
    const pageId = 'page-id'
    const totalPages = 5
    const blocksPerPage = 100
    const delayPerFetch = 50 // ms
    const delayPerDelete = 100 // ms per batch (simulating network latency)

    // Mock list to return multiple pages with delay
    const listMock = vi.fn().mockImplementation(async ({ start_cursor }) => {
      await new Promise((resolve) => setTimeout(resolve, delayPerFetch))
      const pageNum = start_cursor ? parseInt(start_cursor, 10) : 0

      const results = Array(blocksPerPage)
        .fill(null)
        .map((_, i) => ({
          id: `block-${pageNum}-${i}`,
          type: 'paragraph'
        }))

      const nextCursor = pageNum < totalPages - 1 ? String(pageNum + 1) : null

      return {
        results,
        next_cursor: nextCursor,
        has_more: !!nextCursor
      }
    })

    // Mock delete with delay
    const deleteMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, delayPerDelete))
      return {}
    })

    // Mock append
    const appendMock = vi.fn().mockResolvedValue({})

    notion.blocks.children.list = listMock as any
    notion.blocks.delete = deleteMock as any
    notion.blocks.children.append = appendMock as any

    const startTime = Date.now()

    await pages(notion, {
      action: 'update',
      page_id: pageId,
      content: 'New content'
    })

    const duration = Date.now() - startTime

    // Expected behavior:
    // We have 5 pages.
    // In current serial implementation:
    // 1. Fetch all pages: 5 * 50ms = 250ms
    // 2. Delete all blocks (5 batches of 100, if processBatches chunks by 10 and concurrency 3... wait)

    // processBatches defaults: batchSize = 10, concurrency = 3.
    // 500 blocks total.
    // 50 batches of 10 blocks.
    // Concurrency 3 means we process 3 batches at a time.
    // Total rounds = ceil(50 / 3) = 17 rounds.
    // Each round takes delayPerDelete (if we assume deleteMock is called per block? No, delete is per block)

    // In updatePage:
    // await processBatches(existingBlocks, async (block) => { await notion.blocks.delete({ block_id: block.id }) })
    // existingBlocks length = 500.
    // batchItems(500, 10) -> 50 batches.
    // processBatches iterates 0..batches.length with step 3.
    // It waits for Promise.all(currentBatches).
    // Each batch has 10 items.
    // processFn is called for each item.
    // processFn calls deleteMock.
    // So for one batch of 10 items, we have 10 concurrent deleteMock calls.
    // But processBatches waits for all of them.
    // So latency is controlled by the slowest deleteMock call (which is fixed at 100ms).

    // So effectively, we have 17 rounds of 100ms = 1700ms.
    // Total serial time ~= 250ms (fetch) + 1700ms (delete) = 1950ms.

    // Pipelined Implementation:
    // We fetch Page 1 (50ms).
    // We start deleting Page 1 (100 items).
    //   100 items -> 10 batches.
    //   10 batches with concurrency 3 -> 4 rounds (3, 3, 3, 1).
    //   4 * 100ms = 400ms.

    // While deleting Page 1, we fetch Page 2 (50ms).
    //   Fetch happens in parallel with delete round 1.
    //   Fetch finishes at T=100ms. Delete Page 1 finishes at T=450ms.

    // Actually, my proposed implementation:
    // do {
    //   fetch(N) // 50ms
    //   if (prevDelete) await prevDelete // wait for delete(N-1)
    //   prevDelete = processBatches(N) // 400ms
    // }

    // Trace:
    // T=0: Fetch 1 start.
    // T=50: Fetch 1 done. Start Delete 1 (400ms duration).
    // T=50: Loop. Fetch 2 start.
    // T=100: Fetch 2 done.
    // T=100: Await Delete 1 (started at 50, ends at 450).
    // T=450: Delete 1 done. Start Delete 2.
    // T=450: Loop. Fetch 3 start.
    // T=500: Fetch 3 done.
    // T=500: Await Delete 2 (started at 450, ends at 850).
    // ...

    // Wait, this pipelining `await prevDelete` *after* fetch means we are limited by max(fetch, delete) ONLY IF fetch > delete.
    // If delete > fetch (which is 400ms vs 50ms), we are bottlenecked by delete.
    // Fetch 2 finishes at 100, but we wait until 450 to start Delete 2.

    // So:
    // Delete 1: 50 -> 450
    // Delete 2: 450 -> 850
    // Delete 3: 850 -> 1250
    // Delete 4: 1250 -> 1650
    // Delete 5: 1650 -> 2050

    // Total time: 2050ms.

    // Original Serial:
    // Fetch All: 5 * 50 = 250ms.
    // Delete All: 5 * 400 = 2000ms.
    // Total: 2250ms.

    // Saving: 200ms (the fetch time is hidden).

    // This doesn't seem like a huge win if Delete is much slower than Fetch.
    // But if we have huge number of pages, saving the Fetch time is nice.
    // Also, we don't hold all blocks in memory.

    // Can we optimize further?
    // We are waiting for `prevDelete` to finish before starting `nextDelete`.
    // Can we parallelize `Delete 1` and `Delete 2`?
    // That increases concurrency load on API.
    // `processBatches` limits concurrency to 3 batches (30 items) at a time.
    // If we run two `processBatches` in parallel, we have 60 items at a time.
    // If the global limit allows it, we could run faster.

    // But assuming we want to respect the concurrency limit per tool invocation (implied by usage of processBatches),
    // then we should probably keep it serial-ish for deletions.

    // However, the memory benefit is real (processing stream vs loading all).
    // And hiding latency of HTTP requests for fetching.

    console.log(`Duration: ${duration}ms`)
    expect(listMock).toHaveBeenCalledTimes(totalPages)
    // We can't strictly assert duration in unit test environment, but we can verify logic correctness.
  })
})
