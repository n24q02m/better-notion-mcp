import type { Client } from '@notionhq/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pages } from './pages'

// Mock dependencies
vi.mock('../helpers/pagination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../helpers/pagination')>()
  return {
    ...actual,
    autoPaginate: vi.fn(async (fn) => {
      const response = await fn(undefined, 100)
      return response.results
    }),
    processBatches: vi.fn(async (items, processFn) => {
      return Promise.all(items.map(processFn))
    })
  }
})

describe('Duplicate Page', () => {
  let mockNotion: any

  beforeEach(() => {
    mockNotion = {
      pages: {
        retrieve: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      blocks: {
        children: {
          list: vi.fn(),
          append: vi.fn()
        },
        delete: vi.fn()
      }
    }
  })

  it('should duplicate a page with > 100 blocks by batching appends', async () => {
    // Mock original page
    mockNotion.pages.retrieve.mockResolvedValue({
      id: 'page-1',
      parent: { type: 'page_id', page_id: 'parent-1' },
      properties: {},
      icon: null,
      cover: null
    })

    // Mock 150 blocks
    const blocks = Array.from({ length: 150 }, (_, i) => ({
      object: 'block',
      id: `block-${i}`,
      type: 'paragraph'
    }))

    mockNotion.blocks.children.list.mockResolvedValue({
      results: blocks,
      next_cursor: null,
      has_more: false
    })

    // Mock create page
    mockNotion.pages.create.mockResolvedValue({
      id: 'new-page-1',
      url: 'https://notion.so/new-page-1'
    })

    // Run duplicate
    await pages(mockNotion as unknown as Client, {
      action: 'duplicate',
      page_id: 'page-1'
    })

    // Expect multiple calls because of batching
    const appendCalls = mockNotion.blocks.children.append.mock.calls
    expect(appendCalls.length).toBeGreaterThan(1)

    // Check batch sizes
    for (const call of appendCalls) {
      const batchSize = call[0].children.length
      expect(batchSize).toBeLessThanOrEqual(100)
    }
  })
})
