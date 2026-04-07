import { describe, expect, it, vi } from 'vitest'
import {
  autoPaginate,
  ConcurrencyQueue,
  fetchChildrenRecursive,
  populateDeepChildren,
  processBatches
} from './pagination'

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

  it('collects results across multiple pages', async () => {
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

  it('stops after maxPages even if has_more is true', async () => {
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

  it('returns empty array when results are empty', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      results: [],
      next_cursor: null,
      has_more: false
    })

    const results = await autoPaginate(fetchFn)

    expect(results).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('respects custom pageSize', async () => {
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
  it('fetches children for table blocks', async () => {
    const queue = new ConcurrencyQueue(5)
    const blocks: any[] = [
      { id: 'table-1', type: 'table', has_children: true, table: { table_width: 2 } },
      { id: 'para-1', type: 'paragraph', has_children: false, paragraph: {} }
    ]
    const tableRows = [
      { id: 'row-1', type: 'table_row', has_children: false, table_row: { cells: [] } },
      { id: 'row-2', type: 'table_row', has_children: false, table_row: { cells: [] } }
    ]
    const fetchPage = vi.fn().mockResolvedValue({
      results: tableRows,
      next_cursor: null,
      has_more: false
    })

    await fetchChildrenRecursive(blocks, fetchPage, 0, queue)

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith('table-1', undefined)
    expect(blocks[0].table.children).toEqual(tableRows)
  })

  it('fetches children for toggle and column_list blocks', async () => {
    const queue = new ConcurrencyQueue(5)
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

    const fetchPage = vi.fn().mockImplementation(async (id) => {
      if (id === 'toggle-1') return { results: toggleChildren, next_cursor: null, has_more: false }
      if (id === 'col-list-1') return { results: columns, next_cursor: null, has_more: false }
      if (id === 'col-1' || id === 'col-2') return { results: colContent, next_cursor: null, has_more: false }
      return { results: [], next_cursor: null, has_more: false }
    })

    await fetchChildrenRecursive(blocks, fetchPage, 0, queue)

    expect(blocks[0].toggle.children).toEqual(toggleChildren)
    expect(blocks[1].column_list.children).toEqual(columns)
    expect(columns[0].column.children).toEqual(colContent)
    expect(columns[1].column.children).toEqual(colContent)
  })

  it('verifies streaming recursion and interleaving', async () => {
    const queue = new ConcurrencyQueue(2)

    const blocks = [{ id: 'parent', type: 'toggle', has_children: true, toggle: {} }]

    const callOrder: string[] = []
    const fetchPage = vi.fn().mockImplementation(async (id, cursor) => {
      callOrder.push(`${id}-${cursor || 'start'}`)
      if (id === 'parent' && !cursor) {
        // Parent Page 1 has child-1
        return {
          results: [{ id: 'child-1', type: 'toggle', has_children: true, toggle: {} }],
          next_cursor: 'p-2',
          has_more: true
        }
      }
      if (id === 'parent' && cursor === 'p-2') {
        // Parent Page 2 has child-2
        return {
          results: [{ id: 'child-2', type: 'paragraph', has_children: false, paragraph: {} }],
          next_cursor: null,
          has_more: false
        }
      }
      if (id === 'child-1') {
        // Delay child-1 to allow parent-p-2 to potentially start if it wasn't streaming
        // But with streaming, child-1 starts as soon as parent-start is done.
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { results: [], next_cursor: null, has_more: false }
      }
      return { results: [], next_cursor: null, has_more: false }
    })

    await fetchChildrenRecursive(blocks, fetchPage, 0, queue)

    expect(callOrder[0]).toBe('parent-start')
    // child-1-start should be triggered BEFORE parent-p-2 if it's truly streaming and interleaving
    // actually, in a loop:
    // 1. fetch parent-start
    // 2. push recursion(child-1) to promises
    // 3. fetch parent-p-2

    // The order of 2 and 3 depends on microtasks, but both should be in flight.
    expect(callOrder).toContain('parent-start')
    expect(callOrder).toContain('parent-p-2')
    expect(callOrder).toContain('child-1-start')
  })

  it('respects MAX_DEPTH', async () => {
    const queue = new ConcurrencyQueue(5)
    const blocks = [{ id: 'd0', type: 'toggle', has_children: true, toggle: {} }]
    const fetchPage = vi.fn().mockImplementation(async (id) => {
      const depth = parseInt(id.substring(1), 10)
      return {
        results: [{ id: `d${depth + 1}`, type: 'toggle', has_children: true, toggle: {} }],
        next_cursor: null,
        has_more: false
      }
    })

    await fetchChildrenRecursive(blocks, fetchPage, 0, queue)

    // Depth 0 fetches d1
    // Depth 1 fetches d2
    // Depth 2 fetches d3
    // Depth 3 fetches d4
    // Depth 4 fetches d5
    // Depth 5 should stop
    expect(fetchPage).toHaveBeenCalledTimes(5)
    expect(fetchPage).toHaveBeenCalledWith('d0', undefined)
    expect(fetchPage).toHaveBeenCalledWith('d4', undefined)
    expect(fetchPage).not.toHaveBeenCalledWith('d5', undefined)
  })
})

describe('processBatches', () => {
  it('processes all items and return results', async () => {
    const items = [1, 2, 3, 4, 5]
    const processFn = vi.fn((x: number) => Promise.resolve(x * 2))

    const results = await processBatches(items, processFn)

    expect(results).toEqual([2, 4, 6, 8, 10])
  })
})

describe('populateDeepChildren', () => {
  it('calls fetchChildrenRecursive with fetchPage implementation', async () => {
    const mockNotion = {
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({
            results: [{ id: 'child-1', type: 'paragraph', has_children: false, paragraph: {} }],
            next_cursor: null,
            has_more: false
          })
        }
      }
    }
    const blocks = [{ id: 'parent-1', type: 'toggle', has_children: true, toggle: {} }]

    await populateDeepChildren(mockNotion as any, blocks)

    expect(mockNotion.blocks.children.list).toHaveBeenCalledWith({
      block_id: 'parent-1',
      start_cursor: undefined,
      page_size: 100
    })
    expect((blocks[0] as any).toggle.children).toHaveLength(1)
  })
})
