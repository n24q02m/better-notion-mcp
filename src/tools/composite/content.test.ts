import { describe, expect, it } from 'vitest'
import { contentConvert } from './content.js'

describe('content composite tool', () => {
  it('should throw if direction is unknown', async () => {
    await expect(contentConvert({ direction: 'unknown' as any, content: '' })).rejects.toThrow('Unsupported direction')
  })
})
