import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type WorkspaceResult, workspace } from './workspace.js'

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
        id: 'bot-1',
        type: 'bot',
        name: 'My Integration',
        bot: { owner: { type: 'workspace', workspace: true } }
      })

      const result = (await workspace(mockNotion as any, { action: 'info' })) as Extract<
        WorkspaceResult,
        { action: 'info' }
      >

      expect(result.action).toBe('info')
      expect(result.bot).toEqual({
        id: 'bot-1',
        name: 'My Integration',
        type: 'bot',
        owner: { type: 'workspace', workspace: true }
      })
      expect(mockNotion.users.retrieve).toHaveBeenCalledWith({ user_id: 'me' })
    })

    it('should default name to Bot when missing', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'bot-1',
        type: 'bot',
        bot: {}
      })

      const result = (await workspace(mockNotion as any, { action: 'info' })) as Extract<
        WorkspaceResult,
        { action: 'info' }
      >

      expect(result.bot.name).toBe('Bot')
    })
  })

  describe('search', () => {
    it('should search with query', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            object: 'page',
            properties: { title: { title: [{ plain_text: 'My Page' }] } },
            url: 'https://notion.so/page-1',
            last_edited_time: '2024-01-01'
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = (await workspace(mockNotion as any, { action: 'search', query: 'My Page' })) as Extract<
        WorkspaceResult,
        { action: 'search' }
      >

      expect(result.action).toBe('search')
      expect(result.query).toBe('My Page')
      expect(result.total).toBe(1)
      expect(result.results[0]).toEqual({
        id: 'page-1',
        object: 'page',
        title: 'My Page',
        url: 'https://notion.so/page-1',
        last_edited_time: '2024-01-01'
      })
    })

    it('should search without query (empty string)', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const result = (await workspace(mockNotion as any, { action: 'search' })) as Extract<
        WorkspaceResult,
        { action: 'search' }
      >

      expect(result.action).toBe('search')
      expect(result.query).toBeUndefined()
      expect(result.total).toBe(0)
      expect(result.results).toEqual([])
      expect(mockNotion.search).toHaveBeenCalledWith(expect.objectContaining({ query: '' }))
    })

    it('should apply filter by object type', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      await workspace(mockNotion as any, {
        action: 'search',
        filter: { object: 'page' }
      })

      expect(mockNotion.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { value: 'page', property: 'object' }
        })
      )
    })

    it('should apply sort options', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      await workspace(mockNotion as any, {
        action: 'search',
        sort: { direction: 'ascending', timestamp: 'created_time' }
      })

      expect(mockNotion.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: { direction: 'ascending', timestamp: 'created_time' }
        })
      )
    })

    it('should default sort direction and timestamp', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      await workspace(mockNotion as any, {
        action: 'search',
        sort: {}
      })

      expect(mockNotion.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: { direction: 'descending', timestamp: 'last_edited_time' }
        })
      )
    })

    it('should respect limit parameter', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          { id: 'p1', object: 'page', properties: {}, url: '', last_edited_time: '' },
          { id: 'p2', object: 'page', properties: {}, url: '', last_edited_time: '' },
          { id: 'p3', object: 'page', properties: {}, url: '', last_edited_time: '' }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = (await workspace(mockNotion as any, {
        action: 'search',
        limit: 2
      })) as Extract<WorkspaceResult, { action: 'search' }>

      expect(result.total).toBe(2)
      expect(result.results).toHaveLength(2)
    })

    it('should extract title from Name property for pages', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            object: 'page',
            properties: { Name: { title: [{ plain_text: 'Named Page' }] } },
            url: '',
            last_edited_time: ''
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = (await workspace(mockNotion as any, { action: 'search' })) as Extract<
        WorkspaceResult,
        { action: 'search' }
      >

      expect(result.results[0].title).toBe('Named Page')
    })

    it('should extract title for databases', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          {
            id: 'db-1',
            object: 'database',
            title: [{ plain_text: 'My Database' }],
            url: '',
            last_edited_time: ''
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = (await workspace(mockNotion as any, { action: 'search' })) as Extract<
        WorkspaceResult,
        { action: 'search' }
      >

      expect(result.results[0].title).toBe('My Database')
    })

    it('should default to Untitled when no title found', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            object: 'page',
            properties: {},
            url: '',
            last_edited_time: ''
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = (await workspace(mockNotion as any, { action: 'search' })) as Extract<
        WorkspaceResult,
        { action: 'search' }
      >

      expect(result.results[0].title).toBe('Untitled')
    })
  })

  describe('unknown action', () => {
    it('should throw on unsupported action', async () => {
      await expect(workspace(mockNotion as any, { action: 'delete' as any })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR'
      })
    })
  })
})
