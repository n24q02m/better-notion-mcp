import { describe, expect, it, vi } from 'vitest'
import { autoPaginate, batchItems, createCursorHandler, fetchPage, processBatches } from './pagination'

describe('autoPaginate', () => {
  it('should return results from a single page', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      results: [1, 2, 3],
      next_cursor: null,
      has_more: false
    })

    const results = await autoPaginate(fetchFn)

    expect(results).toEqual([1, 2, 3])
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith(undefined, 100)
  })

  it('should collect results across multiple pages', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        results: ['a', 'b'],
        next_cursor: 'cursor-1',
        has_more: true
      })
      .mockResolvedValueOnce({
        results: ['c', 'd'],
        next_cursor: 'cursor-2',
        has_more: true
      })
      .mockResolvedValueOnce({
        results: ['e'],
        next_cursor: null,
        has_more: false
      })

    const results = await autoPaginate(fetchFn)

    expect(results).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(fetchFn).toHaveBeenNthCalledWith(1, undefined, 100)
    expect(fetchFn).toHaveBeenNthCalledWith(2, 'cursor-1', 100)
    expect(fetchFn).toHaveBeenNthCalledWith(3, 'cursor-2', 100)
  })

  it('should stop after maxPages even if has_more is true', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        results: [1, 2],
        next_cursor: 'cursor-1',
        has_more: true
      })
      .mockResolvedValueOnce({
        results: [3, 4],
        next_cursor: 'cursor-2',
        has_more: true
      })

    const results = await autoPaginate(fetchFn, { maxPages: 2 })

    expect(results).toEqual([1, 2, 3, 4])
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('should return empty array when results are empty', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      results: [],
      next_cursor: null,
      has_more: false
    })

    const results = await autoPaginate(fetchFn)

    expect(results).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('should respect custom pageSize', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      results: [1],
      next_cursor: null,
      has_more: false
    })

    await autoPaginate(fetchFn, { pageSize: 50 })

    expect(fetchFn).toHaveBeenCalledWith(undefined, 50)
  })
})

describe('fetchPage', () => {
  it('should delegate to fetchFn and return the response', async () => {
    const response = { results: [1, 2], next_cursor: 'abc', has_more: true }
    const fetchFn = vi.fn().mockResolvedValueOnce(response)

    const result = await fetchPage(fetchFn)

    expect(result).toEqual(response)
    expect(fetchFn).toHaveBeenCalledWith(undefined, 100)
  })

  it('should pass cursor and pageSize to fetchFn', async () => {
    const response = { results: [3], next_cursor: null, has_more: false }
    const fetchFn = vi.fn().mockResolvedValueOnce(response)

    const result = await fetchPage(fetchFn, 'my-cursor', 25)

    expect(result).toEqual(response)
    expect(fetchFn).toHaveBeenCalledWith('my-cursor', 25)
  })
})

describe('createCursorHandler', () => {
  it('should have null cursor and hasMore false initially', () => {
    const handler = createCursorHandler()

    expect(handler.getCursor()).toBeNull()
    expect(handler.hasMore()).toBe(false)
  })

  it('should return the cursor after setCursor', () => {
    const handler = createCursorHandler()

    handler.setCursor('page-2')

    expect(handler.getCursor()).toBe('page-2')
  })

  it('should return hasMore true when cursor is set', () => {
    const handler = createCursorHandler()

    handler.setCursor('next')

    expect(handler.hasMore()).toBe(true)
  })

  it('should clear cursor on reset', () => {
    const handler = createCursorHandler()
    handler.setCursor('some-cursor')

    handler.reset()

    expect(handler.getCursor()).toBeNull()
    expect(handler.hasMore()).toBe(false)
  })
})

describe('batchItems', () => {
  it('should split items evenly into batches', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9]

    const batches = batchItems(items, 3)

    expect(batches).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ])
  })

  it('should handle uneven splits with a smaller last batch', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const batches = batchItems(items, 3)

    expect(batches).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]])
  })

  it('should return empty array for empty input', () => {
    const batches = batchItems([], 3)

    expect(batches).toEqual([])
  })

  it('should handle a single item', () => {
    const batches = batchItems(['only'], 3)

    expect(batches).toEqual([['only']])
  })

  it('should put all items in one batch when batchSize exceeds length', () => {
    const items = [1, 2, 3]

    const batches = batchItems(items, 100)

    expect(batches).toEqual([[1, 2, 3]])
  })
})

describe('processBatches', () => {
  it('should process all items and return results', async () => {
    const items = [1, 2, 3, 4, 5]
    const processFn = vi.fn((x: number) => Promise.resolve(x * 2))

    const results = await processBatches(items, processFn)

    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  it('should call processFn for each item', async () => {
    const items = ['a', 'b', 'c']
    const processFn = vi.fn((x: string) => Promise.resolve(x.toUpperCase()))

    await processBatches(items, processFn)

    expect(processFn).toHaveBeenCalledTimes(3)
    expect(processFn.mock.calls.map((args) => args[0])).toEqual(['a', 'b', 'c'])
  })

  it('should respect batchSize option', async () => {
    const items = [1, 2, 3, 4, 5]
    const processFn = vi.fn((x: number) => Promise.resolve(x))

    const results = await processBatches(items, processFn, { batchSize: 2 })

    expect(results).toEqual([1, 2, 3, 4, 5])
    expect(processFn).toHaveBeenCalledTimes(5)
  })

  it('should work with default options', async () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    const processFn = vi.fn((x: number) => Promise.resolve(x + 1))

    const results = await processBatches(items, processFn)

    expect(results).toHaveLength(25)
    expect(results[0]).toBe(1)
    expect(results[24]).toBe(25)
    expect(processFn).toHaveBeenCalledTimes(25)
  })

  it('should return empty array for empty input', async () => {
    const processFn = vi.fn((x: number) => Promise.resolve(x))

    const results = await processBatches([], processFn)

    expect(results).toEqual([])
    expect(processFn).not.toHaveBeenCalled()
  })
})
