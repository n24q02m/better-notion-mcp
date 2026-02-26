import type { Client } from '@notionhq/client'
import { describe, expect, it, vi } from 'vitest'
import { type PagesInput, pages } from './pages.js'

describe('pages performance', () => {
  it('measures replacement of 500 blocks', async () => {
    // Setup Mock Client
    const mockDelete = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50)) // 50ms per delete
      return {}
    })

    const mockList = vi.fn().mockImplementation(async ({ start_cursor }: { start_cursor?: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms per list fetch

      const cursor = start_cursor ? parseInt(start_cursor, 10) : 0
      const PAGE_SIZE = 100
      const TOTAL_PAGES = 5 // 500 blocks total

      if (cursor >= TOTAL_PAGES) {
        return {
          results: [],
          next_cursor: null,
          has_more: false
        }
      }

      // Generate 100 blocks
      const results = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `block-${cursor * 100 + i}`,
        type: 'paragraph'
      }))

      const next = cursor + 1
      return {
        results,
        next_cursor: next < TOTAL_PAGES ? next.toString() : null,
        has_more: next < TOTAL_PAGES
      }
    })

    const mockAppend = vi.fn().mockResolvedValue({})
    const mockUpdate = vi.fn().mockResolvedValue({})

    const mockNotion = {
      blocks: {
        children: {
          list: mockList,
          append: mockAppend
        },
        delete: mockDelete
      },
      pages: {
        update: mockUpdate
      }
    } as unknown as Client

    const input: PagesInput = {
      action: 'update',
      page_id: 'page-123',
      content: 'New content' // Triggers delete-all logic
    }

    console.time('Delete 500 blocks')
    const start = performance.now()
    await pages(mockNotion, input)
    const end = performance.now()
    console.timeEnd('Delete 500 blocks')

    const duration = end - start
    console.log(`Duration: ${duration.toFixed(2)}ms`)

    // Sanity check
    // Depending on logic, list might be called 5 times (pages 0-4) + 1 (null check) = 6
    // Or 5 times if logic is smart. autoPaginate calls until next_cursor is null.
    expect(mockList).toHaveBeenCalled()
    expect(mockDelete).toHaveBeenCalledTimes(500)
  })
})
