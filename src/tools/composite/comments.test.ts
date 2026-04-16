import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blockCache } from './blocks'
import { commentsManage } from './comments'

const mockNotion = {
  comments: {
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn()
  },
  blocks: {
    retrieve: vi.fn()
  }
}

describe('commentsManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    blockCache.clear()
  })

  describe('list', () => {
    it('should list comments for a page', async () => {
      mockNotion.comments.list.mockResolvedValue({
        results: [
          {
            id: 'comment-1',
            created_time: '2024-01-01',
            created_by: { id: 'user-1' },
            discussion_id: 'disc-1',
            rich_text: [{ type: 'text', text: { content: 'Test comment' } }],
            parent: { type: 'page_id', page_id: 'page-1' }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'list',
        page_id: 'page-1'
      })

      expect(result.page_id).toBe('page-1')
      expect(result.total_comments).toBe(1)
      expect(result.results[0].text).toBe('Test comment')
      expect(mockNotion.comments.list).toHaveBeenCalledWith({
        block_id: 'page-1',
        start_cursor: undefined
      })
    })

    it('should handle pagination', async () => {
      mockNotion.comments.list
        .mockResolvedValueOnce({
          results: [{ id: 'c1', rich_text: [] }],
          has_more: true,
          next_cursor: 'next'
        })
        .mockResolvedValueOnce({
          results: [{ id: 'c2', rich_text: [] }],
          has_more: false,
          next_cursor: null
        })

      const result = await commentsManage(mockNotion as any, {
        action: 'list',
        page_id: 'page-1'
      })

      expect(result.total_comments).toBe(2)
      expect(mockNotion.comments.list).toHaveBeenCalledTimes(2)
    })

    it('should return empty list when no comments', async () => {
      mockNotion.comments.list.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'list',
        page_id: 'page-1'
      })

      expect(result.page_id).toBe('page-1')
      expect(result.total_comments).toBe(0)
      expect(result.results).toEqual([])
    })

    it('should throw COMMENTS_LIST_UNAVAILABLE when Notion returns object_not_found but page exists', async () => {
      const notFoundError = new Error('Not found')
      ;(notFoundError as any).code = 'object_not_found'
      mockNotion.comments.list.mockRejectedValue(notFoundError)
      mockNotion.blocks.retrieve.mockResolvedValue({ id: 'page-1' })

      await expect(
        commentsManage(mockNotion as any, {
          action: 'list',
          page_id: 'page-1'
        })
      ).rejects.toMatchObject({
        code: 'COMMENTS_LIST_UNAVAILABLE',
        message: 'Cannot list comments for this page'
      })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledWith({ block_id: 'page-1' })
    })

    it('should use blockCache to avoid blocks.retrieve when handling object_not_found', async () => {
      const notFoundError = new Error('Not found')
      ;(notFoundError as any).code = 'object_not_found'
      mockNotion.comments.list.mockRejectedValue(notFoundError)

      // Populate blockCache
      blockCache.set('page-1', { block: { id: 'page-1' }, expiresAt: Date.now() + 10000 })

      await expect(
        commentsManage(mockNotion as any, {
          action: 'list',
          page_id: 'page-1'
        })
      ).rejects.toMatchObject({
        code: 'COMMENTS_LIST_UNAVAILABLE'
      })

      // Should NOT have called blocks.retrieve because it was in cache
      expect(mockNotion.blocks.retrieve).not.toHaveBeenCalled()
    })

    it('should re-throw object_not_found (wrapped as NOT_FOUND) if page itself does not exist', async () => {
      const notFoundError = new Error('Not found')
      ;(notFoundError as any).code = 'object_not_found'
      mockNotion.comments.list.mockRejectedValue(notFoundError)
      mockNotion.blocks.retrieve.mockRejectedValue(notFoundError)

      await expect(
        commentsManage(mockNotion as any, {
          action: 'list',
          page_id: 'page-1'
        })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND'
      })
    })

    it('should re-throw non-object_not_found errors', async () => {
      const rateLimitError = new Error('Rate limited')
      ;(rateLimitError as any).code = 'rate_limited'
      mockNotion.comments.list.mockRejectedValue(rateLimitError)

      await expect(
        commentsManage(mockNotion as any, {
          action: 'list',
          page_id: 'page-1'
        })
      ).rejects.toThrow()
    })

    it('should include display_name when present', async () => {
      mockNotion.comments.list.mockResolvedValue({
        results: [
          {
            id: 'comment-1',
            created_time: '2024-01-01',
            created_by: { id: 'user-1' },
            discussion_id: 'disc-1',
            rich_text: [{ type: 'text', text: { content: 'Hello' } }],
            display_name: 'John Doe',
            parent: { type: 'page_id', page_id: 'page-1' }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'list',
        page_id: 'page-1'
      })

      expect(result.results[0].display_name).toBe('John Doe')
    })

    it('should throw without page_id', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'page_id required for list action'
      })
    })
  })

  describe('get', () => {
    it('should retrieve a single comment', async () => {
      mockNotion.comments.retrieve.mockResolvedValue({
        id: 'comment-1',
        created_time: '2024-01-01',
        created_by: { id: 'user-1' },
        discussion_id: 'disc-1',
        rich_text: [{ type: 'text', text: { content: 'Test comment' } }],
        parent: { type: 'page_id', page_id: 'page-1' }
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'get',
        comment_id: 'comment-1'
      })

      expect(result.action).toBe('get')
      expect(result.comment_id).toBe('comment-1')
      expect(result.text).toBe('Test comment')
    })

    it('should handle undefined rich_text with _note field', async () => {
      mockNotion.comments.retrieve.mockResolvedValue({
        id: 'comment-1',
        created_time: '2024-01-01',
        created_by: { id: 'user-1' },
        discussion_id: 'disc-1',
        rich_text: undefined,
        parent: { type: 'page_id', page_id: 'page-1' }
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'get',
        comment_id: 'comment-1'
      })

      expect(result.text).toBe('')
      expect(result._note).toContain('rich_text unavailable')
    })

    it('should throw without comment_id', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'get' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR'
      })
    })
  })

  describe('create', () => {
    it('should create a comment with page_id', async () => {
      mockNotion.comments.create.mockResolvedValue({
        id: 'comment-new',
        discussion_id: 'disc-new'
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'create',
        page_id: 'page-1',
        content: 'New comment'
      })

      expect(result.action).toBe('create')
      expect(result.comment_id).toBe('comment-new')
      expect(result.created).toBe(true)
      expect(mockNotion.comments.create).toHaveBeenCalledWith({
        rich_text: [expect.any(Object)],
        parent: { page_id: 'page-1' }
      })
    })

    it('should create a reply with discussion_id', async () => {
      mockNotion.comments.create.mockResolvedValue({
        id: 'comment-reply',
        discussion_id: 'disc-1'
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'create',
        discussion_id: 'disc-1',
        content: 'Reply text'
      })

      expect(result.action).toBe('create')
      expect(result.discussion_id).toBe('disc-1')
      expect(mockNotion.comments.create).toHaveBeenCalledWith({
        rich_text: [expect.any(Object)],
        discussion_id: 'disc-1'
      })
    })

    it('should throw without content', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'create', page_id: 'page-1' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR'
      })
    })

    it('should throw without page_id or discussion_id', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'create', content: 'Hello' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR'
      })
    })
  })

  describe('unknown action', () => {
    it('should throw on unsupported action', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'delete' as any })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR'
      })
    })
  })
})
