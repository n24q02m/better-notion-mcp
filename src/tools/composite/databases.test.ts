import { describe, it, expect, vi, beforeEach } from 'vitest'
import { databases } from './databases.js'

vi.mock('../helpers/pagination.js', () => ({
  autoPaginate: vi.fn(async (cb) => {
    const result = await cb(undefined)
    return result.results || []
  }),
  processBatches: vi.fn(async (items, cb) => {
    return Promise.all(items.map(cb))
  })
}))

describe('databases tool', () => {
  let mockNotion: any

  beforeEach(() => {
    mockNotion = {
      databases: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn()
      },
      dataSources: {
        retrieve: vi.fn(),
        query: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      },
      pages: {
        create: vi.fn(),
        update: vi.fn()
      }
    }
  })

  it('should create a database', async () => {
    mockNotion.databases.create.mockResolvedValue({
      id: 'db-1',
      url: 'https://notion.so/db-1',
      data_sources: [{ id: 'ds-1' }]
    })

    const result = await databases(mockNotion, {
      action: 'create',
      parent_id: 'page-1',
      title: 'New DB',
      properties: { Name: { title: {} } }
    })

    expect(mockNotion.databases.create).toHaveBeenCalled()
    expect(result.database_id).toBe('db-1')
  })

  it('should get a database', async () => {
    mockNotion.databases.retrieve.mockResolvedValue({
      id: 'db-1',
      data_sources: [{ id: 'ds-1' }]
    })
    mockNotion.dataSources.retrieve.mockResolvedValue({
      id: 'ds-1',
      properties: { Name: { type: 'title', id: 'title' } }
    })

    const result = await databases(mockNotion, {
      action: 'get',
      database_id: 'db-1'
    })

    expect(result.database_id).toBe('db-1')
    expect(result.schema.Name).toBeDefined()
  })
})
