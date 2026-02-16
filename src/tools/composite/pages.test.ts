import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pages } from './pages.js'

vi.mock('../helpers/pagination.js', () => ({
  autoPaginate: vi.fn(async (cb) => {
    const result = await cb(undefined)
    return result.results || []
  }),
  processBatches: vi.fn(async (items, cb) => {
    return Promise.all(items.map(cb))
  })
}))

describe('pages tool', () => {
  let mockNotion: any

  beforeEach(() => {
    mockNotion = {
      pages: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn()
      },
      blocks: {
        children: {
          list: vi.fn(),
          append: vi.fn()
        },
        delete: vi.fn()
      }
    }
  })

  it('should create a page', async () => {
    mockNotion.pages.create.mockResolvedValue({
      id: 'page-1',
      url: 'https://notion.so/page-1'
    })

    const result = await pages(mockNotion, {
      action: 'create',
      parent_id: 'page-parent',
      title: 'New Page'
    })

    expect(mockNotion.pages.create).toHaveBeenCalled()
    expect(result.page_id).toBe('page-1')
  })

  it('should get a page', async () => {
    mockNotion.pages.retrieve.mockResolvedValue({
      id: 'page-1',
      properties: {
        title: { type: 'title', title: [{ plain_text: 'Title' }] }
      }
    })
    mockNotion.blocks.children.list.mockResolvedValue({ results: [] })

    const result = await pages(mockNotion, {
      action: 'get',
      page_id: 'page-1'
    })

    expect(result.page_id).toBe('page-1')
    expect(result.properties.title).toBe('Title')
  })
})
