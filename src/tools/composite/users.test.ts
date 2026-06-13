import { beforeEach, describe, expect, it, vi } from 'vitest'
import { users } from './users.js'

const mockNotion = {
  users: {
    list: vi.fn(),
    retrieve: vi.fn()
  },
  search: vi.fn()
}

describe('users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('should list all users', async () => {
      mockNotion.users.list.mockResolvedValue({
        results: [
          {
            id: 'user-1',
            type: 'person',
            name: 'Alice',
            avatar_url: 'https://example.com/alice.png',
            person: { email: 'alice@example.com' }
          },
          {
            id: 'bot-1',
            type: 'bot',
            name: 'My Bot',
            avatar_url: null
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await users(mockNotion as any, { action: 'list' })

      expect(result.action).toBe('list')
      expect(result.total).toBe(2)
      expect(result.users).toHaveLength(2)
      expect(result.users[0]).toEqual({
        id: 'user-1',
        type: 'person',
        name: 'Alice',
        avatar_url: 'https://example.com/alice.png',
        email: 'alice@example.com'
      })
      expect(result.users[1]).toEqual({
        id: 'bot-1',
        type: 'bot',
        name: 'My Bot',
        avatar_url: null,
        email: undefined
      })
    })

    it('should handle empty user list', async () => {
      mockNotion.users.list.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const result = await users(mockNotion as any, { action: 'list' })

      expect(result.action).toBe('list')
      expect(result.total).toBe(0)
      expect(result.users).toEqual([])
    })

    it('should suggest from_workspace when restricted_resource error', async () => {
      mockNotion.users.list.mockRejectedValue({ code: 'restricted_resource' })

      await expect(users(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'RESTRICTED_RESOURCE',
        message: expect.stringContaining('does not have permission'),
        suggestion: expect.stringContaining('Use action "from_workspace"')
      })
    })

    it('should suggest from_workspace when RESTRICTED_RESOURCE error', async () => {
      mockNotion.users.list.mockRejectedValue({ code: 'RESTRICTED_RESOURCE' })

      await expect(users(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'RESTRICTED_RESOURCE',
        suggestion: expect.stringContaining('Use action "from_workspace"')
      })
    })

    it('should handle rate_limited error', async () => {
      mockNotion.users.list.mockRejectedValue({ code: 'rate_limited', message: 'Too many requests' })

      await expect(users(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        message: 'Too many requests to Notion API'
      })
    })

    it('should handle unknown Notion error code', async () => {
      mockNotion.users.list.mockRejectedValue({ code: 'internal_server_error', message: 'Something went wrong' })

      await expect(users(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong'
      })
    })

    it('should handle generic network errors', async () => {
      mockNotion.users.list.mockRejectedValue(new Error('network error'))

      await expect(users(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
        message: 'network error'
      })
    })

    it('should default name to Unknown when missing', async () => {
      mockNotion.users.list.mockResolvedValue({
        results: [{ id: 'user-1', type: 'person', avatar_url: null, person: {} }],
        next_cursor: null,
        has_more: false
      })

      const result = await users(mockNotion as any, { action: 'list' })

      expect(result.users[0].name).toBe('Unknown')
    })
    it('should handle null errors in list action', async () => {
      mockNotion.users.list.mockRejectedValue(null)

      await expect(users(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred'
      })
    })

    it('should handle string errors in list action', async () => {
      mockNotion.users.list.mockRejectedValue('something went wrong')

      await expect(users(mockNotion as any, { action: 'list' })).rejects.toMatchObject({
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred'
      })
    })
  })

  describe('get', () => {
    it('should retrieve a single user by id', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'user-1',
        type: 'person',
        name: 'Alice',
        avatar_url: 'https://example.com/alice.png',
        person: { email: 'alice@example.com' }
      })

      const result = await users(mockNotion as any, { action: 'get', user_id: 'user-1' })

      expect(result.action).toBe('get')
      expect(result.id).toBe('user-1')
      expect(result.type).toBe('person')
      expect(result.name).toBe('Alice')
      expect(result.email).toBe('alice@example.com')
      expect(mockNotion.users.retrieve).toHaveBeenCalledWith({ user_id: 'user-1' })
    })

    it('should return undefined email for bot users', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'bot-1',
        type: 'bot',
        name: 'Bot',
        avatar_url: null
      })

      const result = await users(mockNotion as any, { action: 'get', user_id: 'bot-1' })

      expect(result.email).toBeUndefined()
    })

    it('should default name to Unknown when missing', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'user-1',
        type: 'person',
        avatar_url: null,
        person: {}
      })

      const result = await users(mockNotion as any, { action: 'get', user_id: 'user-1' })

      expect(result.name).toBe('Unknown')
    })

    it('should throw without user_id', async () => {
      await expect(users(mockNotion as any, { action: 'get' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'user_id required for get action'
      })
    })

    it('should handle Notion API errors', async () => {
      mockNotion.users.retrieve.mockRejectedValue({ code: 'object_not_found' })

      await expect(users(mockNotion as any, { action: 'get', user_id: 'missing' })).rejects.toMatchObject({
        code: 'NOT_FOUND'
      })
    })
  })

  describe('me', () => {
    it('should retrieve the bot user', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'bot-1',
        type: 'bot',
        name: 'My Integration',
        bot: { owner: { type: 'workspace', workspace: true } }
      })

      const result = await users(mockNotion as any, { action: 'me' })

      expect(result.action).toBe('me')
      expect(result.id).toBe('bot-1')
      expect(result.type).toBe('bot')
      expect(result.name).toBe('My Integration')
      expect(result.bot).toEqual({ owner: { type: 'workspace', workspace: true } })
      expect(mockNotion.users.retrieve).toHaveBeenCalledWith({ user_id: 'me' })
    })

    it('should default name to Bot when missing', async () => {
      mockNotion.users.retrieve.mockResolvedValue({
        id: 'bot-1',
        type: 'bot',
        bot: {}
      })

      const result = await users(mockNotion as any, { action: 'me' })

      expect(result.name).toBe('Bot')
    })

    it('should handle Notion API errors', async () => {
      mockNotion.users.retrieve.mockRejectedValue({ code: 'unauthorized' })

      await expect(users(mockNotion as any, { action: 'me' })).rejects.toMatchObject({
        code: 'UNAUTHORIZED'
      })
    })
  })

  describe('from_workspace', () => {
    it('should extract users from page metadata', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          {
            created_by: { id: 'user-1', object: 'user' },
            last_edited_by: { id: 'user-2', object: 'user' }
          },
          {
            created_by: { id: 'user-1', object: 'user' },
            last_edited_by: { id: 'user-3', object: 'user' }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await users(mockNotion as any, { action: 'from_workspace' })

      expect(result.action).toBe('from_workspace')
      expect(result.total).toBe(3)
      expect(result.users).toHaveLength(3)
      expect(result.note).toContain('extracted from accessible pages')
    })

    it('should deduplicate users by id', async () => {
      mockNotion.search.mockResolvedValue({
        results: [
          {
            created_by: { id: 'user-1', object: 'user' },
            last_edited_by: { id: 'user-1', object: 'user' }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await users(mockNotion as any, { action: 'from_workspace' })

      expect(result.total).toBe(1)
    })

    it('should handle pages without created_by or last_edited_by', async () => {
      mockNotion.search.mockResolvedValue({
        results: [{ created_by: { id: 'user-1', object: 'user' } }],
        next_cursor: null,
        has_more: false
      })

      const result = await users(mockNotion as any, { action: 'from_workspace' })

      expect(result.total).toBe(1)
    })

    it('should handle empty search results', async () => {
      mockNotion.search.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const result = await users(mockNotion as any, { action: 'from_workspace' })

      expect(result.total).toBe(0)
      expect(result.users).toEqual([])
    })

    it('should handle Notion API errors', async () => {
      mockNotion.search.mockRejectedValue({ code: 'rate_limited' })

      await expect(users(mockNotion as any, { action: 'from_workspace' })).rejects.toMatchObject({
        code: 'RATE_LIMITED'
      })
    })
  })

  describe('unknown action', () => {
    it('should throw on unsupported action', async () => {
      await expect(users(mockNotion as any, { action: 'delete' as any })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR'
      })
    })
  })
})

describe('from_workspace with pagination', () => {
  it('should scan multiple pages of search results', async () => {
    mockNotion.search
      .mockResolvedValueOnce({
        results: [{ created_by: { id: 'user-1', object: 'user' } }],
        next_cursor: 'c1',
        has_more: true
      })
      .mockResolvedValueOnce({
        results: [{ created_by: { id: 'user-2', object: 'user' } }],
        next_cursor: null,
        has_more: false
      })

    const result = await users(mockNotion as any, { action: 'from_workspace', limit: 2 })

    expect(result.total).toBe(2)
    expect(result.users).toContainEqual(expect.objectContaining({ id: 'user-1' }))
    expect(result.users).toContainEqual(expect.objectContaining({ id: 'user-2' }))
    expect(mockNotion.search).toHaveBeenCalledTimes(2)
  })

  it('should respect custom limit', async () => {
    mockNotion.search.mockResolvedValue({
      results: Array(10).fill({ created_by: { id: 'user-1', object: 'user' } }),
      next_cursor: null,
      has_more: false
    })

    await users(mockNotion as any, { action: 'from_workspace', limit: 5 })

    // autoPaginate should be called with limit 5
    expect(mockNotion.search).toHaveBeenCalledWith(
      expect.objectContaining({
        page_size: 5
      })
    )
  })
})

describe('list with pagination', () => {
  it('should respect custom limit', async () => {
    mockNotion.users.list.mockResolvedValue({
      results: [],
      next_cursor: null,
      has_more: false
    })

    await users(mockNotion as any, { action: 'list', limit: 10 })

    expect(mockNotion.users.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page_size: 10
      })
    )
  })
})
