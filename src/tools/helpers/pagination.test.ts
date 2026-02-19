import { describe, expect, it } from 'vitest'
import { batchItems } from './pagination'

describe('batchItems', () => {
  it('should split an array into chunks of the specified size', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const batchSize = 3
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]])
  })

  it('should handle an empty array', () => {
    const items: number[] = []
    const batchSize = 3
    const result = batchItems(items, batchSize)
    expect(result).toEqual([])
  })

  it('should handle a batch size larger than the array length', () => {
    const items = [1, 2, 3]
    const batchSize = 5
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('should handle a batch size equal to the array length', () => {
    const items = [1, 2, 3]
    const batchSize = 3
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('should handle a batch size of 1', () => {
    const items = [1, 2, 3]
    const batchSize = 1
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1], [2], [3]])
  })
})
