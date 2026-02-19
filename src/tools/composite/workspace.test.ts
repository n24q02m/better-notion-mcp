import { describe, it, expect, vi } from 'vitest'
import { workspace } from './workspace.js'
import { Client } from '@notionhq/client'

// Mock the Client
vi.mock('@notionhq/client', () => {
  return {
    Client: vi.fn(() => ({
      users: {
        retrieve: vi.fn()
      },
      search: vi.fn()
    }))
  }
})

describe('workspace tool performance', () => {
  it('should respect limit and stop fetching early', async () => {
    const searchMock = vi.fn()
    // Create a mock client instance
    const notion = {
        search: searchMock,
        users: { retrieve: vi.fn() }
    } as unknown as Client

    // Setup mock response to return many pages
    // Each page has 100 items
    const totalPages = 5

    searchMock.mockImplementation(async ({ start_cursor, page_size }) => {
      const pageIndex = start_cursor ? parseInt(start_cursor) : 0

      const results = Array(page_size || 100).fill(0).map((_, i) => ({
        id: `page-${pageIndex}-${i}`,
        object: 'page',
        properties: {
            title: { title: [{ plain_text: `Page ${pageIndex}-${i}` }] }
        },
        url: `https://notion.so/page-${pageIndex}-${i}`,
        last_edited_time: '2023-01-01T00:00:00.000Z'
      }))

      const nextIndex = pageIndex + 1
      return {
        results,
        next_cursor: nextIndex < totalPages ? String(nextIndex) : null,
        has_more: nextIndex < totalPages
      }
    })

    const limit = 50

    // This calls the workspace function which uses autoPaginate
    const result = await workspace(notion, {
      action: 'search',
      query: 'test',
      limit
    })

    expect(result.results).toHaveLength(limit)

    // Without optimization, autoPaginate fetches all pages.
    // With optimization, it should fetch only what is needed.
    // For limit=50 and pageSize=100 (default), it should be 1 call.
    expect(searchMock).toHaveBeenCalledTimes(1)
  })
})
