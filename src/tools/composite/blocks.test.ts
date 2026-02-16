import { describe, it, expect, vi, beforeEach } from 'vitest'
import { blocks } from './blocks.js'

// Mock autoPaginate since it's used in 'children' action
vi.mock('../helpers/pagination.js', () => ({
  autoPaginate: vi.fn(async (cb) => {
    // Basic mock implementation that just calls the callback once
    const result = await cb(undefined)
    return result.results || []
  })
}))

describe('blocks tool', () => {
  let mockNotion: any

  beforeEach(() => {
    mockNotion = {
      blocks: {
        retrieve: vi.fn(),
        children: {
          list: vi.fn(),
          append: vi.fn()
        },
        update: vi.fn(),
        delete: vi.fn()
      }
    }
  })

  it('should get a block', async () => {
    mockNotion.blocks.retrieve.mockResolvedValue({
      id: 'block-123',
      type: 'paragraph',
      has_children: false,
      archived: false
    })

    const result = await blocks(mockNotion, {
      action: 'get',
      block_id: 'block-123'
    })

    expect(mockNotion.blocks.retrieve).toHaveBeenCalledWith({ block_id: 'block-123' })
    expect(result).toEqual({
      action: 'get',
      block_id: 'block-123',
      type: 'paragraph',
      has_children: false,
      archived: false,
      block: expect.any(Object)
    })
  })

  it('should throw error if block_id is missing', async () => {
    await expect(blocks(mockNotion, { action: 'get' } as any)).rejects.toThrow('block_id required')
  })

  it('should delete a block', async () => {
    mockNotion.blocks.delete.mockResolvedValue({})

    const result = await blocks(mockNotion, {
      action: 'delete',
      block_id: 'block-123'
    })

    expect(mockNotion.blocks.delete).toHaveBeenCalledWith({ block_id: 'block-123' })
    expect(result).toEqual({
      action: 'delete',
      block_id: 'block-123',
      deleted: true
    })
  })

  it('should append content to a block', async () => {
    mockNotion.blocks.children.append.mockResolvedValue({ results: [] })

    const result = await blocks(mockNotion, {
      action: 'append',
      block_id: 'block-123',
      content: 'Hello World'
    })

    expect(mockNotion.blocks.children.append).toHaveBeenCalledWith({
      block_id: 'block-123',
      children: expect.any(Array)
    })
    expect(result.action).toBe('append')
  })
})
