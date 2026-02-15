import { describe, expect, it, vi } from 'vitest'
import { commentsManage } from './comments.js'

describe('comments composite tool', () => {
  const mockNotion = {
    comments: {
      list: vi.fn(),
      create: vi.fn()
    }
  } as any

  it('should throw if action is unknown', async () => {
    await expect(commentsManage(mockNotion, { action: 'unknown' as any })).rejects.toThrow('Unsupported action')
  })
})
