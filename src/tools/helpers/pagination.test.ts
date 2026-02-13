import { describe, expect, it } from 'vitest'
import { batchItems } from './pagination'

describe('batchItems', () => {
  it('should batch items correctly when length is a multiple of batch size', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const batchSize = 2
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1, 2], [3, 4], [5, 6]])
  })

  it('should batch items correctly when length is NOT a multiple of batch size', () => {
    const items = [1, 2, 3, 4, 5, 6, 7]
    const batchSize = 3
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })

  it('should handle empty array', () => {
    const items: number[] = []
    const batchSize = 3
    const result = batchItems(items, batchSize)
    expect(result).toEqual([])
  })

  it('should handle batch size larger than array length', () => {
    const items = [1, 2, 3]
    const batchSize = 5
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('should handle batch size equal to array length', () => {
    const items = [1, 2, 3]
    const batchSize = 3
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1, 2, 3]])
  })

  it('should handle batch size of 1', () => {
    const items = [1, 2, 3]
    const batchSize = 1
    const result = batchItems(items, batchSize)
    expect(result).toEqual([[1], [2], [3]])
  })
})
