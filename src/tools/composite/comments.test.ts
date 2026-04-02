import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commentsManage } from './comments'

const mockNotion = {
  comments: {
    list: vi.fn(),
    retrieve: vi.fn(),
    create: vi.fn()
  }
}

describe('commentsManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
            rich_text: [{ type: 'text', text: { content: 'Hello' } }],
            parent: { type: 'page_id', page_id: 'page-1' }
          },
          {
            id: 'comment-2',
            created_time: '2024-01-02',
            created_by: { id: 'user-2' },
            discussion_id: 'disc-1',
            rich_text: [
              { type: 'text', text: { content: 'World' } },
              { type: 'text', text: { content: '!' } }
            ],
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
      expect(result.total_comments).toBe(2)
      expect(result.comments).toHaveLength(2)
      expect(result.comments[0]).toEqual({
        id: 'comment-1',
        created_time: '2024-01-01',
        created_by: { id: 'user-1' },
        discussion_id: 'disc-1',
        text: 'Hello',
        parent: { type: 'page_id', page_id: 'page-1' }
      })
      expect(result.comments[1]).toEqual({
        id: 'comment-2',
        created_time: '2024-01-02',
        created_by: { id: 'user-2' },
        discussion_id: 'disc-1',
        text: 'World!',
        parent: { type: 'page_id', page_id: 'page-1' }
      })
      expect(mockNotion.comments.list).toHaveBeenCalledWith({
        block_id: 'page-1',
        start_cursor: undefined
      })
    })

    it('should handle empty results', async () => {
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
      expect(result.comments).toEqual([])
    })

    it('should throw COMMENTS_LIST_UNAVAILABLE when Notion returns object_not_found', async () => {
      const notFoundError = new Error('Not found')
      ;(notFoundError as any).code = 'object_not_found'
      mockNotion.comments.list.mockRejectedValue(notFoundError)

      await expect(
        commentsManage(mockNotion as any, {
          action: 'list',
          page_id: 'page-1'
        })
      ).rejects.toMatchObject({
        code: 'COMMENTS_LIST_UNAVAILABLE',
        message: 'Cannot list comments for this page'
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

      // Should NOT be caught as COMMENTS_LIST_UNAVAILABLE
      await expect(
        commentsManage(mockNotion as any, {
          action: 'list',
          page_id: 'page-1'
        })
      ).rejects.not.toMatchObject({
        code: 'COMMENTS_LIST_UNAVAILABLE'
      })
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

      expect(result.comments[0].display_name).toBe('John Doe')
    })

    it('should throw without page_id', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'page_id required for list action',
        suggestion: 'Provide page_id'
      })
    })

    it('should handle errors during pagination', async () => {
      mockNotion.comments.list
        .mockResolvedValueOnce({
          results: [
            {
              id: 'c1',
              created_time: '2024-01-01',
              created_by: { id: 'u1' },
              discussion_id: 'd1',
              rich_text: [],
              parent: { type: 'page_id', page_id: 'p1' }
            }
          ],
          has_more: true,
          next_cursor: 'next'
        })
        .mockRejectedValueOnce(new Error('Pagination failed'))

      await expect(
        commentsManage(mockNotion as any, {
          action: 'list',
          page_id: 'page-1'
        })
      ).rejects.toThrow('Pagination failed')
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
      expect(result.created_time).toBe('2024-01-01')
      expect(result.created_by).toEqual({ id: 'user-1' })
      expect(result.discussion_id).toBe('disc-1')
      expect(result.text).toBe('Test comment')
      expect(result.rich_text).toEqual([{ type: 'text', text: { content: 'Test comment' } }])
      expect(result.parent).toEqual({ type: 'page_id', page_id: 'page-1' })
      expect(mockNotion.comments.retrieve).toHaveBeenCalledWith({
        comment_id: 'comment-1'
      })
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
      expect(result.rich_text).toBeUndefined()
      expect(result._note).toContain('rich_text unavailable')
    })

    it('should include display_name when present', async () => {
      mockNotion.comments.retrieve.mockResolvedValue({
        id: 'comment-1',
        created_time: '2024-01-01',
        created_by: { id: 'user-1' },
        discussion_id: 'disc-1',
        rich_text: [{ type: 'text', text: { content: 'Hello' } }],
        display_name: 'Jane Doe',
        parent: { type: 'page_id', page_id: 'page-1' }
      })

      const result = await commentsManage(mockNotion as any, {
        action: 'get',
        comment_id: 'comment-1'
      })

      expect(result.display_name).toBe('Jane Doe')
    })

    it('should throw without comment_id', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'get' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'comment_id required for get action',
        suggestion: 'Provide comment_id'
      })
    })

    it('should throw when Notion API returns an error', async () => {
      mockNotion.comments.retrieve.mockRejectedValue(new Error('Retrieve failed'))

      await expect(
        commentsManage(mockNotion as any, {
          action: 'get',
          comment_id: 'comment-1'
        })
      ).rejects.toThrow('Retrieve failed')
    })
  })

  describe('create (new discussion)', () => {
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
      expect(result.discussion_id).toBe('disc-new')
      expect(result.created).toBe(true)
      expect(mockNotion.comments.create).toHaveBeenCalledWith({
        rich_text: [
          expect.objectContaining({
            type: 'text',
            text: { content: 'New comment', link: null }
          })
        ],
        parent: { page_id: 'page-1' }
      })
    })

    it('should throw without content', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'create', page_id: 'page-1' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'content required for create action',
        suggestion: 'Provide comment content'
      })
    })

    it('should throw without page_id or discussion_id', async () => {
      await expect(commentsManage(mockNotion as any, { action: 'create', content: 'Hello' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Either page_id or discussion_id is required for create action'
      })
    })

    it('should throw when Notion API returns an error', async () => {
      mockNotion.comments.create.mockRejectedValue(new Error('Create failed'))

      await expect(
        commentsManage(mockNotion as any, {
          action: 'create',
          page_id: 'page-1',
          content: 'Hello'
        })
      ).rejects.toThrow('Create failed')
    })
  })

  describe('create (reply)', () => {
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
      expect(result.comment_id).toBe('comment-reply')
      expect(result.discussion_id).toBe('disc-1')
      expect(result.created).toBe(true)
      expect(mockNotion.comments.create).toHaveBeenCalledWith({
        rich_text: [
          expect.objectContaining({
            type: 'text',
            text: { content: 'Reply text', link: null }
          })
        ],
        discussion_id: 'disc-1'
      })
      expect(mockNotion.comments.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ parent: expect.anything() })
      )
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
