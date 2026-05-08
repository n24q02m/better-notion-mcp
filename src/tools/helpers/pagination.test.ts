import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('should fetch children breadth-first (parallel at each level)', async () => {
    const blocks: any[] = [
      { id: 'toggle-1', type: 'toggle', has_children: true, toggle: {} },
      { id: 'toggle-2', type: 'toggle', has_children: true, toggle: {} }
    ]

    const children1 = [{ id: 'child-1', type: 'paragraph', has_children: false, paragraph: {} }]
    const children2 = [{ id: 'child-2', type: 'paragraph', has_children: false, paragraph: {} }]

    const fetchChildren = vi.fn().mockImplementation((id) => {
      if (id === 'toggle-1') return Promise.resolve(children1)
      if (id === 'toggle-2') return Promise.resolve(children2)
      return Promise.resolve([])
    })

    await fetchChildrenRecursive(blocks, fetchChildren)

    expect(fetchChildren).toHaveBeenCalledTimes(2)
    expect(blocks[0].toggle.children).toEqual(children1)
    expect(blocks[1].toggle.children).toEqual(children2)
  })

  it('should use sessionCache and skip redundant fetches within call', async () => {
    const blocks: any[] = [
      { id: 'dup-1', type: 'toggle', has_children: true, toggle: {} },
      { id: 'dup-1', type: 'toggle', has_children: true, toggle: {} }
    ]
    const children = [{ id: 'p-1', type: 'paragraph' }]

    const fetchChildren = vi.fn().mockResolvedValue(children)
    const sessionCache = new Map<string, any[]>()

    await fetchChildrenRecursive(blocks, fetchChildren, 0, undefined, sessionCache)

    expect(fetchChildren).toHaveBeenCalledTimes(1)
    expect(blocks[0].toggle.children).toEqual(children)
    expect(blocks[1].toggle.children).toEqual(children)
  })

  it('should be resilient: one failure does not stop sibling fetches', async () => {
    const blocks: any[] = [
      { id: 'fail-1', type: 'toggle', has_children: true, toggle: {} },
      { id: 'ok-1', type: 'toggle', has_children: true, toggle: {} }
    ]

    const okChildren = [{ id: 'p-ok', type: 'paragraph' }]
    const fetchChildren = vi.fn().mockImplementation((id) => {
      if (id === 'fail-1') return Promise.reject(new Error('Fetch failed'))
      if (id === 'ok-1') return Promise.resolve(okChildren)
      return Promise.resolve([])
    })

    // Should not throw
    await fetchChildrenRecursive(blocks, fetchChildren)

    expect(fetchChildren).toHaveBeenCalledTimes(2)
    expect(blocks[1].toggle.children).toEqual(okChildren)
    expect(blocks[0].toggle.children).toBeUndefined()
  })

  it('should respect max depth limit', async () => {
    const blocks: any[] = [{ id: 'toggle-1', type: 'toggle', has_children: true, toggle: {} }]
    const fetchChildren = vi.fn().mockResolvedValue([])

    await fetchChildrenRecursive(blocks, fetchChildren, 5)

    expect(fetchChildren).not.toHaveBeenCalled()
  })
})

describe('ConcurrencyQueue', () => {
  it('should respect concurrency limit', async () => {
    const queue = new ConcurrencyQueue(2)
    let active = 0
    let maxActive = 0

    const tasks = Array.from({ length: 5 }, () => async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active--
    })

    await Promise.all(tasks.map((t) => queue.run(t)))
    expect(maxActive).toBe(2)
    expect(active).toBe(0)
  })

  it('should fail fast by default', async () => {
    const queue = new ConcurrencyQueue(1, true)
    const error = new Error('boom')

    await expect(
      queue.run(async () => {
        throw error
      })
    ).rejects.toThrow('boom')
    await expect(queue.run(async () => 'ok')).rejects.toThrow('Queue stopped due to previous error')
  })

  it('should NOT fail fast if failFast is false', async () => {
    const queue = new ConcurrencyQueue(1, false)
    const error = new Error('boom')

    await expect(
      queue.run(async () => {
        throw error
      })
    ).rejects.toThrow('boom')
    const result = await queue.run(async () => 'ok')
    expect(result).toBe('ok')
  })
})

describe('populateDeepChildren', () => {
  it('should call fetchChildrenRecursive with autoPaginate', async () => {
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
    expect((blocks[0] as any).toggle.children[0].id).toBe('child-1')
  })
})

describe('processBatches', () => {
  it('should process all items and return results', async () => {
    const items = [1, 2, 3, 4, 5]
    const processFn = vi.fn((x: number) => Promise.resolve(x * 2))

    const results = await processBatches(items, processFn)

    expect(results).toEqual([2, 4, 6, 8, 10])
  })
})
