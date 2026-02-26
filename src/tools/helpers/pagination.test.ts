import { describe, expect, it, vi } from 'vitest'
import { autoPaginate } from './pagination.js'

describe('Pagination Helper Security', () => {
  it('should stop at safety limit to prevent infinite loops', async () => {
    let calls = 0
    const fetchFn = vi.fn().mockImplementation(async () => {
      calls++
      if (calls > 1010) {
        throw new Error('Test: Infinite loop detected')
      }
      return {
        results: ['item'],
        next_cursor: 'next_cursor',
        has_more: true
      }
    })

    // This should resolve successfully if the safety limit works.
    // Without the limit, it will loop until the mock throws, causing rejection.
    await expect(autoPaginate(fetchFn)).resolves.toBeDefined()

    // Confirm it stopped at the safety limit (assuming 1000)
    expect(calls).toBeLessThanOrEqual(1001)
  })

  it('should correctly fetch multiple pages', async () => {
    const pages = [
      { results: ['a'], next_cursor: 'c1', has_more: true },
      { results: ['b'], next_cursor: 'c2', has_more: true },
      { results: ['c'], next_cursor: null, has_more: false }
    ]
    let index = 0
    const fetchFn = vi.fn().mockImplementation(async (_cursor) => {
      const page = pages[index]
      index++
      return page
    })

    const results = await autoPaginate(fetchFn)

    expect(results).toEqual(['a', 'b', 'c'])
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })
})
