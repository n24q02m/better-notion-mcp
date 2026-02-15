import { describe, expect, test, vi } from 'vitest'
import { autoPaginate, batchItems } from './pagination.js'

describe('pagination helpers', () => {
  test('should auto paginate results', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ results: [1, 2], next_cursor: 'abc', has_more: true })
      .mockResolvedValueOnce({ results: [3], next_cursor: null, has_more: false })

    const results = await autoPaginate(fetchFn)
    expect(results).toEqual([1, 2, 3])
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  test('should batch items', () => {
    const items = [1, 2, 3, 4, 5]
    const batches = batchItems(items, 2)
    expect(batches).toEqual([[1, 2], [3, 4], [5]])
  })
})
