import { describe, expect, it, vi } from 'vitest'
import { pages } from './pages.js'

describe('pages composite tool', () => {
  const mockNotion = {
    pages: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn()
    },
    blocks: {
      children: {
        append: vi.fn(),
        list: vi.fn()
      },
      delete: vi.fn()
    }
  } as any

  it('should throw if action is unknown', async () => {
    await expect(pages(mockNotion, { action: 'unknown' as any })).rejects.toThrow('Unknown action')
  })

  it('should create a page', async () => {
    mockNotion.pages.create.mockResolvedValue({ id: 'page-id', url: 'http://url' })
    const result = await pages(mockNotion, {
      action: 'create',
      title: 'New Page',
      parent_id: 'parent-id'
    })
    expect(result.created).toBe(true)
    expect(mockNotion.pages.create).toHaveBeenCalled()
  })
})
