import { describe, it, expect, vi, beforeEach } from 'vitest'
import { commentsManage } from './comments.js'

// Mock autoPaginate
vi.mock('../helpers/pagination.js', () => ({
  autoPaginate: vi.fn(async (cb) => {
    // Basic mock implementation that just calls the callback once
    const result = await cb(undefined)
    return result.results || []
  })
}))

describe('comments tool', () => {
  let mockNotion: any

  beforeEach(() => {
    mockNotion = {
      comments: {
        list: vi.fn(),
        create: vi.fn()
      }
    }
  })

  it('should list comments', async () => {
    mockNotion.comments.list.mockResolvedValue({
      results: [
        {
          id: 'comment-1',
          rich_text: [{ type: 'text', text: { content: 'Hello' }, plain_text: 'Hello' }],
          created_time: '2023-01-01',
          created_by: { id: 'user-1' }
        }
      ]
    })

    const result = await commentsManage(mockNotion, {
      action: 'list',
      page_id: 'page-1'
    })

    expect(mockNotion.comments.list).toHaveBeenCalledWith({
      block_id: 'page-1',
      start_cursor: undefined
    })
    expect(result.comments).toHaveLength(1)
    expect(result.comments[0].text).toBe('Hello')
  })

  it('should create a comment', async () => {
    mockNotion.comments.create.mockResolvedValue({
      id: 'comment-2',
      discussion_id: 'disc-1'
    })

    const result = await commentsManage(mockNotion, {
      action: 'create',
      page_id: 'page-1',
      content: 'New comment'
    })

    expect(mockNotion.comments.create).toHaveBeenCalledWith(expect.objectContaining({
      parent: { page_id: 'page-1' },
      rich_text: expect.any(Array)
    }))
    expect(result.created).toBe(true)
  })

  it('should throw error if content missing for create', async () => {
    await expect(commentsManage(mockNotion, {
      action: 'create',
      page_id: 'page-1'
    })).rejects.toThrow('content required')
  })
})
