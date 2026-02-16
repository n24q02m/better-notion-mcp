import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspace } from './workspace.js'

vi.mock('../helpers/pagination.js', () => ({
  autoPaginate: vi.fn(async (cb) => {
    const result = await cb(undefined)
    return result.results || []
  })
}))

describe('workspace tool', () => {
  let mockNotion: any

  beforeEach(() => {
    mockNotion = {
      users: {
        retrieve: vi.fn()
      },
      search: vi.fn()
    }
  })

  it('should get info', async () => {
    mockNotion.users.retrieve.mockResolvedValue({
      id: 'bot-1',
      name: 'Bot',
      type: 'bot',
      bot: { owner: { type: 'workspace', workspace: true } }
    })

    const result = await workspace(mockNotion, {
      action: 'info'
    })

    expect(result.bot.name).toBe('Bot')
  })

  it('should search workspace', async () => {
    mockNotion.search.mockResolvedValue({
      results: [
        {
          id: 'page-1',
          object: 'page',
          url: 'https://notion.so/page-1',
          last_edited_time: '2023-01-01',
          properties: {
            title: { title: [{ plain_text: 'Page Title' }] }
          }
        }
      ]
    })

    const result = await workspace(mockNotion, {
      action: 'search',
      query: 'test'
    })

    expect(mockNotion.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'test'
      })
    )
    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Page Title')
  })
})
