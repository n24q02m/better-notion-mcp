import { describe, expect, it, vi } from 'vitest'
import { blocks } from './blocks.js'

describe('blocks composite tool', () => {
  const mockNotion = {
    blocks: {
      retrieve: vi.fn(),
      children: {
        list: vi.fn(),
        append: vi.fn()
      },
      update: vi.fn(),
      delete: vi.fn()
    }
  } as any

  it('should throw if action is unknown', async () => {
    await expect(blocks(mockNotion, { action: 'unknown' as any, block_id: '123' })).rejects.toThrow('Unknown action')
  })
})
