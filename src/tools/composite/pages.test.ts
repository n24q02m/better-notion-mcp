import { describe, expect, it, vi } from 'vitest'
import { pages } from './pages'

// Mock dependencies
vi.mock('../helpers/pagination', () => ({
  autoPaginate: vi.fn(),
  processBatches: vi.fn()
}))

vi.mock('../helpers/markdown', () => ({
  blocksToMarkdown: vi.fn().mockReturnValue('mock markdown'),
  markdownToBlocks: vi.fn().mockReturnValue([])
}))

describe('Pages Tool', () => {
  const mockNotion = {
    pages: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn()
    },
    blocks: {
      children: {
        append: vi.fn(),
        list: vi.fn()
      },
      delete: vi.fn()
    }
  }

  it('should create a page successfully', async () => {
    mockNotion.pages.create.mockResolvedValue({
      id: 'page-123',
      url: 'https://notion.so/page-123',
      object: 'page'
    })

    const input = {
      action: 'create' as const,
      title: 'New Page',
      parent_id: 'parent-123',
      content: 'Hello World'
    }

    const result = await pages(mockNotion as any, input)

    // Verify Notion API call
    expect(mockNotion.pages.create).toHaveBeenCalledWith(expect.objectContaining({
      parent: { type: 'page_id', page_id: 'parent123' },
      properties: {
        title: {
          title: [
            expect.objectContaining({
              text: expect.objectContaining({
                content: 'New Page'
              })
            })
          ]
        }
      }
    }))

    // Verify result
    expect(result).toEqual({
      action: 'create',
      page_id: 'page-123',
      url: 'https://notion.so/page-123',
      created: true
    })
  })

  it('should throw error if title is missing for create', async () => {
    const input = {
      action: 'create' as const,
      parent_id: 'parent-123'
    }

    await expect(pages(mockNotion as any, input)).rejects.toThrow('title is required')
  })
})
