import { describe, expect, it } from 'vitest'
import { processBatches } from './pagination.js'

describe('pagination helper', () => {
  describe('processBatches', () => {
    it('should process all items', async () => {
      const items = [1, 2, 3, 4, 5]
      const results = await processBatches(items, async (item) => item * 2)
      expect(results).toEqual([2, 4, 6, 8, 10])
    })

    it('should respect default concurrency (3)', async () => {
      let active = 0
      let maxActive = 0
      const items = Array.from({ length: 10 }, (_, i) => i)

      await processBatches(items, async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 10))
        active--
        return true
      })

      // Default batchSize=1, concurrency=3 -> limit=3
      expect(maxActive).toBeLessThanOrEqual(3)
    })

    it('should respect explicit concurrency', async () => {
      let active = 0
      let maxActive = 0
      const items = Array.from({ length: 20 }, (_, i) => i)

      await processBatches(
        items,
        async () => {
          active++
          maxActive = Math.max(maxActive, active)
          await new Promise((resolve) => setTimeout(resolve, 10))
          active--
          return true
        },
        { batchSize: 2, concurrency: 5 } // 2 * 5 = 10
      )

      expect(maxActive).toBeLessThanOrEqual(10)
      // It should reach reasonably high concurrency if items are processed fast enough,
      // but strictly <= 10.
    })

    it('should handle errors correctly (fail fast)', async () => {
      const items = [1, 2, 3]
      const error = new Error('Test Error')

      await expect(
        processBatches(items, async (item) => {
          if (item === 2) throw error
          return item
        })
      ).rejects.toThrow(error)
    })

    it('should handle empty items', async () => {
      const results = await processBatches([], async (item) => item)
      expect(results).toEqual([])
    })
  })
})
