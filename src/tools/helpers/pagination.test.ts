import { describe, expect, it, vi } from 'vitest'
import { autoPaginate, fetchChildrenRecursive, processBatches } from './pagination'

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

describe('fetchChildrenRecursive', () => {
  it('should fetch children for table blocks', async () => {
    const blocks: any[] = [
      { id: 'table-1', type: 'table', has_children: true, table: { table_width: 2 } },
      { id: 'para-1', type: 'paragraph', has_children: false, paragraph: {} }
    ]
    const tableRows = [
      { id: 'row-1', type: 'table_row', has_children: false, table_row: { cells: [] } },
      { id: 'row-2', type: 'table_row', has_children: false, table_row: { cells: [] } }
    ]
    const fetchChildren = vi.fn().mockResolvedValue(tableRows)

    await fetchChildrenRecursive(blocks, fetchChildren)

    expect(fetchChildren).toHaveBeenCalledTimes(1)
    expect(fetchChildren).toHaveBeenCalledWith('table-1')
    expect(blocks[0].table.children).toEqual(tableRows)
  })

  it('should fetch children for toggle and column_list blocks', async () => {
    const blocks: any[] = [
      { id: 'toggle-1', type: 'toggle', has_children: true, toggle: {} },
      {
        id: 'col-list-1',
        type: 'column_list',
        has_children: true,
        column_list: {}
      }
    ]
    const toggleChildren = [{ id: 'p-1', type: 'paragraph', has_children: false, paragraph: {} }]
    const columns: any[] = [
      { id: 'col-1', type: 'column', has_children: true, column: {} },
      { id: 'col-2', type: 'column', has_children: true, column: {} }
    ]
    const colContent = [{ id: 'p-2', type: 'paragraph', has_children: false, paragraph: {} }]
    const fetchChildren = vi
      .fn()
      .mockResolvedValueOnce(toggleChildren)
      .mockResolvedValueOnce(columns)
      .mockResolvedValueOnce(colContent)
      .mockResolvedValueOnce(colContent)

    await fetchChildrenRecursive(blocks, fetchChildren)

    expect(blocks[0].toggle.children).toEqual(toggleChildren)
    expect(blocks[1].column_list.children).toEqual(columns)
    // Columns themselves should have children fetched recursively
    expect(columns[0].column.children).toEqual(colContent)
    expect(columns[1].column.children).toEqual(colContent)
  })

  it('should skip blocks without has_children', async () => {
    const blocks: any[] = [{ id: 'para-1', type: 'paragraph', has_children: false, paragraph: {} }]
    const fetchChildren = vi.fn()

    await fetchChildrenRecursive(blocks, fetchChildren)

    expect(fetchChildren).not.toHaveBeenCalled()
  })

  it('should skip unsupported block types', async () => {
    const blocks: any[] = [{ id: 'img-1', type: 'image', has_children: true, image: {} }]
    const fetchChildren = vi.fn()

    await fetchChildrenRecursive(blocks, fetchChildren)

    expect(fetchChildren).not.toHaveBeenCalled()
  })

  it('should respect max depth limit', async () => {
    const blocks: any[] = [{ id: 'toggle-1', type: 'toggle', has_children: true, toggle: {} }]
    const fetchChildren = vi.fn().mockResolvedValue([])

    // depth=5 should be at MAX_DEPTH and return immediately
    await fetchChildrenRecursive(blocks, fetchChildren, 5)

    expect(fetchChildren).not.toHaveBeenCalled()
  })

  it('should handle empty blocks array', async () => {
    const fetchChildren = vi.fn()
    await fetchChildrenRecursive([], fetchChildren)
    expect(fetchChildren).not.toHaveBeenCalled()
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
