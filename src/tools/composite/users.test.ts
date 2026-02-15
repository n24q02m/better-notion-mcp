import { describe, expect, it, vi } from 'vitest'
import { users } from './users.js'

describe('users composite tool', () => {
  const mockNotion = {
    users: {
      list: vi.fn(),
      retrieve: vi.fn(),
      me: vi.fn()
    }
  } as any

  it('should throw if action is unknown', async () => {
    await expect(users(mockNotion, { action: 'unknown' as any })).rejects.toThrow('Unknown action')
  })
})
