import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { blocks, blockCache } from './blocks.js'

describe('blocks cache', () => {
  const mockNotion = {
    blocks: {
      retrieve: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      children: {
        list: vi.fn(),
        append: vi.fn()
      }
    }
  }

  beforeEach(() => {
    blockCache.clear()
    vi.resetAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should use cache for subsequent get calls', async () => {
    const blockResponse = {
      id: 'block-1',
      type: 'paragraph',
      has_children: false,
      archived: false,
      paragraph: { rich_text: [] }
    }
    mockNotion.blocks.retrieve.mockResolvedValue(blockResponse)

    // First call
    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

    // Second call
    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1) // Still 1
  })

  it('should expire cache after TTL', async () => {
    const blockResponse = {
      id: 'block-1',
      type: 'paragraph',
      has_children: false,
      archived: false,
      paragraph: { rich_text: [] }
    }
    mockNotion.blocks.retrieve.mockResolvedValue(blockResponse)

    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

    // Fast-forward 6 minutes (TTL is 5 mins)
    vi.advanceTimersByTime(6 * 60 * 1000)

    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(2)
  })

  it('should invalidate cache on update', async () => {
    const blockResponse = {
      id: 'block-1',
      type: 'paragraph',
      has_children: false,
      archived: false,
      paragraph: { rich_text: [] }
    }
    mockNotion.blocks.retrieve.mockResolvedValue(blockResponse)
    mockNotion.blocks.update.mockResolvedValue({})

    // Populate cache
    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

    // Update
    await blocks(mockNotion as any, {
      action: 'update',
      block_id: 'block-1',
      content: 'New content'
    })

    // The update calls retrieve once (via getCachedBlock) but it should have been cached
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

    // Next get should call retrieve again because cache was invalidated
    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(2)
  })

  it('should invalidate cache on delete', async () => {
    const blockResponse = {
      id: 'block-1',
      type: 'paragraph',
      has_children: false,
      archived: false,
      paragraph: { rich_text: [] }
    }
    mockNotion.blocks.retrieve.mockResolvedValue(blockResponse)
    mockNotion.blocks.delete.mockResolvedValue({})

    // Populate cache
    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

    // Delete
    await blocks(mockNotion as any, { action: 'delete', block_id: 'block-1' })

    // Next get should call retrieve again
    await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
    expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(2)
  })
})
