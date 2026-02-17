import { describe, expect, it, vi } from 'vitest'
import { pages } from './pages.js'

describe('pages tool - duplicate', () => {
  it('should duplicate a page with many blocks in batches', async () => {
    // Mock blocks: 150 blocks (limit is 100)
    const blocks = Array.from({ length: 150 }, (_, i) => ({
      object: 'block',
      id: `block-${i}`,
      type: 'paragraph',
      paragraph: { rich_text: [] }
    }))

    const client = {
      pages: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'page-1',
          parent: { type: 'workspace' },
          properties: {},
          url: 'https://notion.so/page-1'
        }),
        create: vi.fn().mockResolvedValue({
          id: 'page-2',
          url: 'https://notion.so/page-2'
        })
      },
      blocks: {
        children: {
          list: vi
            .fn()
            .mockResolvedValueOnce({
              results: blocks.slice(0, 100),
              next_cursor: 'cursor-1',
              has_more: true
            })
            .mockResolvedValueOnce({
              results: blocks.slice(100),
              next_cursor: null,
              has_more: false
            }),
          append: vi.fn().mockResolvedValue({})
        }
      }
    } as any

    await pages(client, {
      action: 'duplicate',
      page_id: 'page-1'
    })

    // Assert create page called once
    expect(client.pages.create).toHaveBeenCalledTimes(1)

    // Assert append blocks called TWICE (100 + 50)
    // The current implementation will fail here (called once with 150)
    expect(client.blocks.children.append).toHaveBeenCalledTimes(2)

    const calls = client.blocks.children.append.mock.calls
    expect(calls[0][0].children).toHaveLength(100)
    expect(calls[1][0].children).toHaveLength(50)
  })
})
