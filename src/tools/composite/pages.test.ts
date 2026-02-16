import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pages } from './pages.js'

// Mock the Client class
vi.mock('@notionhq/client', () => {
  return {
    Client: vi.fn()
  }
})

describe('pages tool', () => {
  let mockNotion: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create a mock instance
    mockNotion = {
      pages: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'page-1',
          parent: { type: 'workspace', workspace: true },
          properties: {},
          icon: null,
          cover: null,
          url: 'https://notion.so/page-1'
        }),
        create: vi.fn().mockResolvedValue({
          id: 'new-page-1',
          url: 'https://notion.so/new-page-1'
        }),
        update: vi.fn()
      },
      blocks: {
        children: {
          list: vi.fn(),
          append: vi.fn().mockResolvedValue({ results: [] })
        },
        delete: vi.fn()
      }
    }
  })

  it('duplicatePage should stream blocks for large pages (avoiding API limits)', async () => {
    // Setup mock responses for blocks.children.list
    // Simulate 150 blocks total: 100 in first page, 50 in second page
    const page1Blocks = Array(100)
      .fill(null)
      .map((_, i) => ({ object: 'block', id: `b1-${i}`, type: 'paragraph' }))
    const page2Blocks = Array(50)
      .fill(null)
      .map((_, i) => ({ object: 'block', id: `b2-${i}`, type: 'paragraph' }))

    mockNotion.blocks.children.list
      .mockResolvedValueOnce({
        results: page1Blocks,
        next_cursor: 'cursor-1',
        has_more: true
      })
      .mockResolvedValueOnce({
        results: page2Blocks,
        next_cursor: null,
        has_more: false
      })

    // Run duplicatePage
    await pages(mockNotion, { action: 'duplicate', page_id: 'page-1' })

    // Verification
    // 1. blocks.children.list should be called twice (to fetch all blocks)
    // Wait, autoPaginate calls list until done. So yes, twice.
    expect(mockNotion.blocks.children.list).toHaveBeenCalledTimes(2)

    // 2. blocks.children.append should be called TWICE (once for each batch of 100 max)
    // The current implementation calls append ONCE with ALL blocks (150 blocks), which is wrong.
    // The optimization will make it call append TWICE (100 blocks, then 50 blocks).

    // We expect the current implementation to FAIL this assertion if it works as analyzed.
    // If it currently calls append once with 150 blocks, verify that.

    // Check if append was called multiple times
    // We want to assert that it IS called multiple times in the optimized version.
    // So for now, let's just log what happened or expect 2 calls and see it fail.
    expect(mockNotion.blocks.children.append).toHaveBeenCalledTimes(2)

    // Check arguments
    if (mockNotion.blocks.children.append.mock.calls.length >= 1) {
      expect(mockNotion.blocks.children.append.mock.calls[0][0].children).toHaveLength(100)
    }
    if (mockNotion.blocks.children.append.mock.calls.length >= 2) {
      expect(mockNotion.blocks.children.append.mock.calls[1][0].children).toHaveLength(50)
    }
  })
})
