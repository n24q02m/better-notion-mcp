import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspace } from './workspace'

const mockNotion = {
  users: {
    retrieve: vi.fn()
  },
  search: vi.fn()
}

describe('workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('info', () => {
    it('should return bot info', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        object: 'user',
        id: 'bot-id',
        name: 'Test Bot',
        type: 'bot',
        bot: {
          owner: { type: 'workspace', workspace: true }
        }
      })

      const result = await workspace(mockNotion as any, { action: 'info' })

      expect(result).toEqual({
        action: 'info',
        bot: {
          id: 'bot-id',
          name: 'Test Bot',
          type: 'bot',
          owner: { type: 'workspace', workspace: true }
        }
      })
      expect(mockNotion.users.retrieve).toHaveBeenCalledWith({ user_id: 'me' })
    })

    it('should handle bot without name', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        object: 'user',
        id: 'bot-id',
        type: 'bot',
        bot: {}
      })

      const result = await workspace(mockNotion as any, { action: 'info' })

      expect(result.bot.name).toBe('Bot')
    })
  })

  describe('search', () => {
    it('should search with default parameters', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const result = await workspace(mockNotion as any, { action: 'search' })

      expect(result.action).toBe('search')
      expect(result.query).toBe(undefined)
      expect(result.total).toBe(0)
      expect(mockNotion.search).toHaveBeenCalledWith({
        query: '',
        start_cursor: undefined,
        page_size: 100
      })
    })

    it('should search with query', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const result = await workspace(mockNotion as any, { action: 'search', query: 'test query' })

      expect(result.query).toBe('test query')
      expect(mockNotion.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query'
        })
      )
    })

    it('should apply filters and sorting', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      await workspace(mockNotion as any, {
        action: 'search',
        filter: { object: 'page' },
        sort: { direction: 'ascending', timestamp: 'created_time' }
      })

      expect(mockNotion.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            value: 'page',
            property: 'object'
          },
          sort: {
            direction: 'ascending',
            timestamp: 'created_time'
          }
        })
      )
    })

    it('should return mapped results for pages', async () => {
      const page = {
        object: 'page',
        id: 'page-1',
        url: 'https://notion.so/page-1',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        properties: {
          title: {
            title: [{ plain_text: 'Page Title' }]
          }
        }
      }

      mockNotion.search.mockResolvedValue({
        results: [page],
        next_cursor: null,
        has_more: false
      })

      const result = await workspace(mockNotion as any, { action: 'search' })

      expect(result.results).toHaveLength(1)
      expect(result.results[0]).toEqual({
        id: 'page-1',
        object: 'page',
        title: 'Page Title',
        url: 'https://notion.so/page-1',
        last_edited_time: '2023-01-01T00:00:00.000Z'
      })
    })

    it('should return mapped results for databases', async () => {
      const db = {
        object: 'database',
        id: 'db-1',
        url: 'https://notion.so/db-1',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        title: [{ plain_text: 'Database Title' }]
      }

      mockNotion.search.mockResolvedValue({
        results: [db],
        next_cursor: null,
        has_more: false
      })

      const result = await workspace(mockNotion as any, { action: 'search' })

      expect(result.results[0].title).toBe('Database Title')
    })

    it('should handle untitled pages', async () => {
      const page = {
        object: 'page',
        id: 'page-1',
        url: 'https://notion.so/page-1',
        last_edited_time: '2023-01-01T00:00:00.000Z',
        properties: {}
      }

      mockNotion.search.mockResolvedValue({
        results: [page],
        next_cursor: null,
        has_more: false
      })

      const result = await workspace(mockNotion as any, { action: 'search' })

      expect(result.results[0].title).toBe('Untitled')
    })

    it('should respect limit parameter', async () => {
      const results = Array(5)
        .fill(null)
        .map((_, i) => ({
          object: 'page',
          id: `page-${i}`,
          properties: { title: { title: [{ plain_text: `Page ${i}` }] } }
        }))

      mockNotion.search.mockResolvedValue({
        results,
        next_cursor: null,
        has_more: false
      })

      const result = await workspace(mockNotion as any, { action: 'search', limit: 2 })

      expect(result.total).toBe(2)
      expect(result.results).toHaveLength(2)
      expect(result.results[0].id).toBe('page-0')
      expect(result.results[1].id).toBe('page-1')
    })
  })

  describe('validation', () => {
    it('should throw on unknown action', async () => {
      await expect(workspace(mockNotion as any, { action: 'invalid' as any })).rejects.toThrow(
        'Unknown action: invalid'
      )
    })
  })
})
