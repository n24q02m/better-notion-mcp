import { beforeEach, describe, expect, it, vi } from 'vitest'
import { users } from './users.js'

vi.mock('../helpers/pagination.js', () => ({
  autoPaginate: vi.fn(async (cb) => {
    const result = await cb(undefined)
    return result.results || []
  })
}))

describe('users tool', () => {
  let mockNotion: any

  beforeEach(() => {
    mockNotion = {
      users: {
        list: vi.fn(),
        retrieve: vi.fn()
      },
      search: vi.fn()
    }
  })

  it('should list users', async () => {
    mockNotion.users.list.mockResolvedValue({
      results: [{ id: 'user-1', name: 'User 1', type: 'person' }]
    })

    const result = await users(mockNotion, {
      action: 'list'
    })

    expect(result.users).toHaveLength(1)
    expect(result.users[0].name).toBe('User 1')
  })

  it('should get a user', async () => {
    mockNotion.users.retrieve.mockResolvedValue({
      id: 'user-1',
      name: 'User 1',
      type: 'person'
    })

    const result = await users(mockNotion, {
      action: 'get',
      user_id: 'user-1'
    })

    expect(result.id).toBe('user-1')
  })

  it('should get current bot info', async () => {
    mockNotion.users.retrieve.mockResolvedValue({
      id: 'bot-1',
      name: 'Bot',
      type: 'bot',
      bot: {}
    })

    const result = await users(mockNotion, {
      action: 'me'
    })

    expect(result.id).toBe('bot-1')
    expect(mockNotion.users.retrieve).toHaveBeenCalledWith({ user_id: 'me' })
  })
})
