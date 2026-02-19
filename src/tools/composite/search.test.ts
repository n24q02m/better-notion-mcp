import { Client } from '@notionhq/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotionMCPError } from '../helpers/errors.js'
import { searchSmart } from './search.js'

// Mock the Notion Client
vi.mock('@notionhq/client', () => {
  const MockClient = vi.fn()
  MockClient.prototype.search = vi.fn()
  return { Client: MockClient }
})

describe('searchSmart', () => {
  let notion: Client

  beforeEach(() => {
    vi.clearAllMocks()
    notion = new Client({ auth: 'secret' })
  })

  it('should perform a basic search with query', async () => {
    const mockResults = [
      {
        id: 'page-1',
        object: 'page',
        url: 'https://notion.so/page-1',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        properties: {
          title: {
            title: [{ plain_text: 'Test Page' }]
          }
        }
      }
    ]

    vi.mocked(notion.search).mockResolvedValue({
      results: mockResults,
      next_cursor: null,
      has_more: false,
      type: 'page_or_database',
      page_or_database: {}
    } as any)

    const result = await searchSmart(notion, { query: 'test' })

    expect(notion.search).toHaveBeenCalledWith({
      query: 'test',
      start_cursor: undefined,
      page_size: 100
    })

    expect(result).toEqual({
      query: 'test',
      total: 1,
      results: [
        {
          id: 'page-1',
          object: 'page',
          title: 'Test Page',
          url: 'https://notion.so/page-1',
          last_edited_time: '2023-01-01T00:00:00.000Z'
        }
      ]
    })
  })

  it('should handle filters correctly', async () => {
    vi.mocked(notion.search).mockResolvedValue({
      results: [],
      next_cursor: null,
      has_more: false,
      type: 'page_or_database',
      page_or_database: {}
    } as any)

    await searchSmart(notion, {
      query: 'test',
      filter: { object: 'database' }
    })

    expect(notion.search).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          value: 'database',
          property: 'object'
        }
      })
    )
  })

  it('should handle sorting correctly', async () => {
    vi.mocked(notion.search).mockResolvedValue({
      results: [],
      next_cursor: null,
      has_more: false,
      type: 'page_or_database',
      page_or_database: {}
    } as any)

    await searchSmart(notion, {
      query: 'test',
      sort: {
        direction: 'ascending',
        timestamp: 'created_time'
      }
    })

    expect(notion.search).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: {
          direction: 'ascending',
          timestamp: 'created_time'
        }
      })
    )
  })

  it('should apply limit to results', async () => {
    const mockResults = Array(5)
      .fill(null)
      .map((_, i) => ({
        id: `page-${i}`,
        object: 'page',
        url: `https://notion.so/page-${i}`,
        last_edited_time: '2023-01-01T00:00:00.000Z',
        properties: {
          title: {
            title: [{ plain_text: `Page ${i}` }]
          }
        }
      }))

    vi.mocked(notion.search).mockResolvedValue({
      results: mockResults,
      next_cursor: null,
      has_more: false,
      type: 'page_or_database',
      page_or_database: {}
    } as any)

    const result = await searchSmart(notion, {
      query: 'test',
      limit: 2
    })

    expect(result.results).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.results[0].id).toBe('page-0')
    expect(result.results[1].id).toBe('page-1')
  })

  it('should default empty query to empty string', async () => {
    vi.mocked(notion.search).mockResolvedValue({
      results: [],
      next_cursor: null,
      has_more: false,
      type: 'page_or_database',
      page_or_database: {}
    } as any)

    await searchSmart(notion, {})

    expect(notion.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: ''
      })
    )
  })

  it('should handle API errors', async () => {
    const error = new Error('API Error')
    vi.mocked(notion.search).mockRejectedValue(error)

    await expect(searchSmart(notion, { query: 'test' })).rejects.toThrow(NotionMCPError)
  })

  it('should correctly map database titles', async () => {
    const mockResults = [
      {
        id: 'db-1',
        object: 'database',
        url: 'https://notion.so/db-1',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        title: [{ plain_text: 'Test Database' }]
      }
    ]

    vi.mocked(notion.search).mockResolvedValue({
      results: mockResults,
      next_cursor: null,
      has_more: false,
      type: 'page_or_database',
      page_or_database: {}
    } as any)

    const result = await searchSmart(notion, { query: 'db' })

    expect(result.results[0].title).toBe('Test Database')
  })
})
