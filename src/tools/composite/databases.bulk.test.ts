import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databases, schemaCache } from './databases.js'

const mockNotion = {
  databases: {
    retrieve: vi.fn(),
    update: vi.fn()
  },
  pages: {
    update: vi.fn()
  },
  dataSources: {
    retrieve: vi.fn(),
    query: vi.fn()
  },
  request: vi.fn()
}

const notion = mockNotion as any

describe('databases bulk update', () => {
  beforeEach(() => {
    schemaCache.clear()
    vi.resetAllMocks()
  })

  it('should fetch schema once and use it for all updates', async () => {
    // Mock resolveDataSourceId via databases.retrieve
    mockNotion.databases.retrieve.mockResolvedValue({
      id: 'db-1',
      data_sources: [{ id: 'ds-1' }]
    })

    // Mock getDataSourceSchema
    mockNotion.dataSources.retrieve.mockResolvedValue({
      id: 'ds-1',
      properties: {
        Status: { type: 'select', select: { options: [] } },
        Name: { type: 'title', title: {} }
      }
    })

    mockNotion.pages.update.mockResolvedValue({ url: 'https://notion.so/page' })

    const result = (await databases(notion, {
      action: 'update_page',
      database_id: 'db-1',
      pages: [
        { page_id: 'p-1', properties: { Status: 'Done' } },
        { page_id: 'p-2', properties: { Status: 'Active' } }
      ]
    })) as any

    expect(result.processed).toBe(2)
    // resolveDataSourceId + getDataSourceSchema = 2 calls
    expect(mockNotion.databases.retrieve).toHaveBeenCalledTimes(1)
    expect(mockNotion.dataSources.retrieve).toHaveBeenCalledTimes(1)

    // Check that pages.update was called with correct properties
    expect(mockNotion.pages.update).toHaveBeenCalledWith(
      expect.objectContaining({
        page_id: 'p-1',
        properties: expect.objectContaining({
          Status: { select: { name: 'Done' } }
        })
      })
    )
  })

  it('should support Query then Update logic', async () => {
    mockNotion.databases.retrieve.mockResolvedValue({
      id: 'db-1',
      data_sources: [{ id: 'ds-1' }]
    })
    mockNotion.dataSources.retrieve.mockResolvedValue({
      id: 'ds-1',
      properties: { Status: { type: 'select' } }
    })

    // Mock query result
    mockNotion.dataSources.query.mockResolvedValue({
      results: [{ id: 'p-1' }, { id: 'p-2' }],
      has_more: false,
      next_cursor: null
    })

    mockNotion.pages.update.mockResolvedValue({ url: 'https://notion.so/page' })

    const result = (await databases(notion, {
      action: 'update_page',
      database_id: 'db-1',
      filters: { property: 'Status', select: { equals: 'Todo' } },
      page_properties: { Status: 'In Progress' }
    })) as any

    expect(result.processed).toBe(2)
    expect(mockNotion.dataSources.query).toHaveBeenCalled()
    expect(mockNotion.pages.update).toHaveBeenCalledTimes(2)
    expect(mockNotion.pages.update).toHaveBeenCalledWith(
      expect.objectContaining({
        page_id: 'p-1',
        properties: { Status: { select: { name: 'In Progress' } } }
      })
    )
  })

  it('should support page_ids + page_properties', async () => {
    mockNotion.pages.update.mockResolvedValue({ url: 'https://notion.so/page' })

    const result = (await databases(notion, {
      action: 'update_page',
      page_ids: ['p-1', 'p-2'],
      page_properties: { Status: 'Done' }
    })) as any

    expect(result.processed).toBe(2)
    expect(mockNotion.pages.update).toHaveBeenCalledTimes(2)
    expect(mockNotion.pages.update).toHaveBeenCalledWith(
      expect.objectContaining({
        page_id: 'p-1',
        properties: expect.any(Object)
      })
    )
  })
})
