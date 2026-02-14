import { describe, expect, it } from 'vitest'
import { autoPaginate, batchItems } from './pagination.js'

describe('Pagination Helper', () => {
  describe('batchItems', () => {
    it('should split items into batches', () => {
      const items = [1, 2, 3, 4, 5]
      const batches = batchItems(items, 2)
      expect(batches).toHaveLength(3)
      expect(batches[0]).toEqual([1, 2])
      expect(batches[1]).toEqual([3, 4])
      expect(batches[2]).toEqual([5])
    })

    it('should handle empty array', () => {
      const batches = batchItems([], 2)
      expect(batches).toHaveLength(0)
    })
  })

  describe('autoPaginate', () => {
    it('should fetch all pages', async () => {
      const fetchFn = async (cursor?: string) => {
        if (!cursor) {
          return {
            results: [1, 2],
            next_cursor: 'page2',
            has_more: true
          }
        }
        if (cursor === 'page2') {
          return {
            results: [3, 4],
            next_cursor: null,
            has_more: false
          }
        }
        return { results: [], next_cursor: null, has_more: false }
      }

      const results = await autoPaginate(fetchFn as any)
      expect(results).toHaveLength(4)
      expect(results).toEqual([1, 2, 3, 4])
    })

    it('should respect maxPages', async () => {
      const fetchFn = async (_cursor?: string) => {
        return {
          results: [1, 2],
          next_cursor: 'next',
          has_more: true
        }
      }

      const results = await autoPaginate(fetchFn as any, { maxPages: 1 })
      expect(results).toHaveLength(2)
    })
  })
})
