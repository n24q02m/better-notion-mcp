import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as pagination from '../helpers/pagination'
import { pages } from './pages'

// Mock dependencies
const mockAppend = vi.fn().mockResolvedValue({})
const mockCreate = vi.fn().mockResolvedValue({ id: 'new-page-id', url: 'http://new-page' })
const mockRetrieve = vi.fn().mockResolvedValue({
  id: 'original-id',
  parent: {},
  properties: {},
  icon: null,
  cover: null
})
const mockList = vi.fn()
const mockUpdate = vi.fn().mockResolvedValue({})

const mockNotion = {
  pages: {
    create: mockCreate,
    retrieve: mockRetrieve,
    update: mockUpdate
  },
  blocks: {
    children: {
      append: mockAppend,
      list: mockList
    },
    delete: vi.fn()
  }
} as any

vi.mock('../helpers/pagination', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    autoPaginate: vi.fn()
  }
})

describe('pages composite tool - duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should batch block appends when duplicating a page with many blocks', async () => {
    // Setup
    const manyBlocks = Array.from({ length: 150 }, (_, i) => ({ id: `block-${i}`, type: 'paragraph' }))

    // Mock autoPaginate to return our many blocks
    vi.mocked(pagination.autoPaginate).mockResolvedValue(manyBlocks as any)

    // Execute
    await pages(mockNotion, {
      action: 'duplicate',
      page_id: 'original-id'
    })

    // Assert
    expect(mockAppend).toHaveBeenCalled()

    const calls = mockAppend.mock.calls
    const totalAppended = calls.reduce((acc, call) => acc + call[0].children.length, 0)

    expect(totalAppended).toBe(150)

    const maxChunkSize = Math.max(...calls.map((call) => call[0].children.length))

    console.log(`Max chunk size: ${maxChunkSize}`)
    console.log(`Total calls: ${calls.length}`)

    expect(maxChunkSize).toBeLessThanOrEqual(100)
    expect(calls.length).toBeGreaterThan(1)
  })
})
