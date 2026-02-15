import { describe, expect, it, vi } from 'vitest'
import { databases } from './databases.js'

describe('databases composite tool', () => {
  const mockNotion = {
    databases: {
      create: vi.fn(),
      retrieve: vi.fn(),
      query: vi.fn(),
      update: vi.fn()
    }
  } as any

  it('should throw if action is unknown', async () => {
    await expect(databases(mockNotion, { action: 'unknown' as any })).rejects.toThrow('Unknown action')
  })
})
