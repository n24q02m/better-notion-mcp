import { beforeEach, describe, expect, it, vi } from 'vitest'
import { users } from './users'

function createMockNotion() {
  return {
    users: {
      list: vi.fn(),
      retrieve: vi.fn(),
      me: vi.fn()
    },
    search: vi.fn()
  }
}

let mockNotion: ReturnType<typeof createMockNotion>

describe('users', () => {
  beforeEach(() => {
    mockNotion = createMockNotion()
  })

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  describe('list', () => {
    it('lists all users with pagination', async () => {
      mockNotion.users.list
        .mockResolvedValueOnce({
          results: [
            { id: 'u1', type: 'person', name: 'Alice', avatar_url: 'url1', person: { email: 'alice@example.com' } }
          ],
          next_cursor: 'cursor-1',
          has_more: true
        })
        .mockResolvedValueOnce({
          results: [{ id: 'u2', type: 'bot', name: 'Bot', avatar_url: 'url2', bot: {} }],
          next_cursor: null,
          has_more: false
        })

      const result = await users(mockNotion as any, { action: 'list' })

      expect(result.total).toBe(2)
      expect(result.users).toHaveLength(2)
      expect(result.users[0]).toEqual({
        id: 'u1',
        type: 'person',
        name: 'Alice',
        avatar_url: 'url1',
        email: 'alice@example.com'
      })
      expect(result.users[1]).toEqual({
        id: 'u2',
        type: 'bot',
        name: 'Bot',
        avatar_url: 'url2',
        email: undefined
      })
      expect(mockNotion.users.list).toHaveBeenCalledTimes(2)
    })
  })

  // ---------------------------------------------------------------------------
  // get
  // ---------------------------------------------------------------------------
  describe('get', () => {
    it('retrieves a user by id', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'u1',
        type: 'person',
        name: 'Alice',
        avatar_url: 'url1',
        person: { email: 'alice@example.com' }
      })

      const result = await users(mockNotion as any, { action: 'get', user_id: 'u1' })

      expect(result).toEqual({
        action: 'get',
        id: 'u1',
        type: 'person',
        name: 'Alice',
        avatar_url: 'url1',
        email: 'alice@example.com'
      })
      expect(mockNotion.users.retrieve).toHaveBeenCalledWith({ user_id: 'u1' })
    })

    it('throws if user_id is missing', async () => {
      await expect(users(mockNotion as any, { action: 'get' })).rejects.toThrow('user_id required')
    })
  })

  // ---------------------------------------------------------------------------
  // me
  // ---------------------------------------------------------------------------
  describe('me', () => {
    it('retrieves bot info', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'bot-1',
        type: 'bot',
        name: 'MyBot',
        bot: { owner: { type: 'workspace', workspace: true } }
      })

      const result = await users(mockNotion as any, { action: 'me' })

      expect(result).toEqual({
        action: 'me',
        id: 'bot-1',
        type: 'bot',
        name: 'MyBot',
        bot: { owner: { type: 'workspace', workspace: true } }
      })
      expect(mockNotion.users.retrieve).toHaveBeenCalledWith({ user_id: 'me' })
    })
  })

  // ---------------------------------------------------------------------------
  // from_workspace
  // ---------------------------------------------------------------------------
  describe('from_workspace', () => {
    it('extracts users from page metadata', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          {
            created_by: { id: 'u1', object: 'user' },
            last_edited_by: { id: 'u2', object: 'user' }
          },
          {
            created_by: { id: 'u1', object: 'user' }, // Duplicate
            last_edited_by: { id: 'u3', object: 'user' }
          }
        ]
      })

      const result = await users(mockNotion as any, { action: 'from_workspace' })

      expect(result.total).toBe(3)
      // The implementation uses a Map, so check content regardless of order (though map preserves insertion order)
      const userIds = result.users.map((u: any) => u.id).sort()
      expect(userIds).toEqual(['u1', 'u2', 'u3'])
      expect(result.users[0].source).toBe('page_metadata')
      expect(mockNotion.search).toHaveBeenCalledWith({
        filter: { property: 'object', value: 'page' },
        page_size: 100
      })
    })
  })

  // ---------------------------------------------------------------------------
  // unknown action
  // ---------------------------------------------------------------------------
  describe('unknown action', () => {
    it('throws error', async () => {
      await expect(users(mockNotion as any, { action: 'invalid' as any })).rejects.toThrow('Unknown action: invalid')
    })
  })
})
