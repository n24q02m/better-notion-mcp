import { describe, expect, it } from 'vitest'
import { processBatches } from './pagination.js'

describe('processBatches', () => {
  it('should process items in order', async () => {
    const items = [1, 2, 3, 4, 5]
    const result = await processBatches(items, async (x) => x * 2)
    expect(result).toEqual([2, 4, 6, 8, 10])
  })

  it('should respect concurrency limits', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    let maxConcurrency = 0
    let currentConcurrency = 0

    const processFn = async (item: number) => {
      currentConcurrency++
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency)
      await new Promise((resolve) => setTimeout(resolve, 50))
      currentConcurrency--
      return item
    }

    // Default: batchSize=10, concurrency=3 -> 30 concurrent before fix
    // After fix: batchSize=1, concurrency=3 -> 3 concurrent
    await processBatches(items, processFn)

    // Check for "safe" concurrency
    // Since we expect the fix to make it safe, we assert <= 5
    // But currently (before fix), it will be 10 because items.length=10 and batchSize=10
    // So this test will fail initially if run against current code.
    expect(maxConcurrency).toBeLessThanOrEqual(5)
  })

  it('should respect explicit concurrency settings', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    let maxConcurrency = 0
    let currentConcurrency = 0

    const processFn = async (item: number) => {
      currentConcurrency++
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency)
      await new Promise((resolve) => setTimeout(resolve, 50))
      currentConcurrency--
      return item
    }

    // Explicit: batchSize=2, concurrency=3 -> 6 concurrent
    await processBatches(items, processFn, { batchSize: 2, concurrency: 3 })

    expect(maxConcurrency).toBeLessThanOrEqual(6)
    // It might be slightly less due to timing, but shouldn't exceed 6
    // And should be reasonably close to 6 if we force it (but hard to guarantee "at least")
  })
})
