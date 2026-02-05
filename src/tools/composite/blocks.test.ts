import type { Client } from '@notionhq/client'
import { describe, expect, it, vi } from 'vitest'
import { blocks } from './blocks'

describe('blocks tool', () => {
  it('should fetch all children by default', async () => {
    const mockList = vi.fn()
    const mockNotion = {
      blocks: {
        children: {
          list: mockList
        },
        retrieve: vi.fn()
      }
    } as unknown as Client

    // Setup mock to return 10 pages of 100 items
    mockList.mockImplementation(async ({ start_cursor }) => {
      const cursor = start_cursor ? parseInt(start_cursor, 10) : 0
      const nextCursor = cursor + 1
      const hasMore = nextCursor < 10

      return {
        results: Array(100).fill({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } }),
        next_cursor: hasMore ? String(nextCursor) : null,
        has_more: hasMore
      }
    })

    const result = await blocks(mockNotion, {
      action: 'children',
      block_id: 'test-block'
    })

    expect(result.total_children).toBe(1000)
    expect(mockList).toHaveBeenCalledTimes(10)
  })

  it('should fetch limited children when limit is provided', async () => {
    const mockList = vi.fn()
    const mockNotion = {
      blocks: {
        children: {
          list: mockList
        },
        retrieve: vi.fn()
      }
    } as unknown as Client

    mockList.mockImplementation(async ({ start_cursor }) => {
      const cursor = start_cursor ? parseInt(start_cursor, 10) : 0
      const nextCursor = cursor + 1
      const hasMore = nextCursor < 10

      return {
        results: Array(100).fill({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } }),
        next_cursor: hasMore ? String(nextCursor) : null,
        has_more: hasMore
      }
    })

    const result = await blocks(mockNotion, {
      action: 'children',
      block_id: 'test-block',
      limit: 150
    })

    // limit 150 -> maxPages = 2. So 2 API calls.
    expect(mockList).toHaveBeenCalledTimes(2)
    expect(result.total_children).toBe(150)
  })
})
