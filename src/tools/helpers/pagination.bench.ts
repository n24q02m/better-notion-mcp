import { describe, bench } from 'vitest'
import { autoPaginate } from './pagination.js'

describe('autoPaginate', () => {
  bench('paginating 10k items with a limit of 9999', async () => {
    let callCount = 0
    const fetchFn = async (cursor?: string, pageSize?: number) => {
      callCount++
      const results = Array.from({ length: pageSize || 100 }, (_, i) => ({ id: `id-${callCount}-${i}` }))
      return {
        results,
        next_cursor: `cursor-${callCount}`,
        has_more: true
      }
    }

    await autoPaginate(fetchFn, { limit: 9999, pageSize: 100 })
  })
})
