import { describe, expect, it, vi } from 'vitest'
import { workspace } from './workspace.js'

describe('workspace composite tool', () => {
  const mockNotion = {
    search: vi.fn()
  } as any

  it('should throw if action is unknown', async () => {
    await expect(workspace(mockNotion, { action: 'unknown' as any })).rejects.toThrow('Unknown action')
  })
})
