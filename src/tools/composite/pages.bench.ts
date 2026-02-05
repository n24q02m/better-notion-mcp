import { autoPaginate, processBatches } from '../helpers/pagination.js'

// Mock Data
const TOTAL_BLOCKS = 2000
const BLOCK_PAYLOAD = 'x'.repeat(1000) // 1KB text
const mockBlocks = Array.from({ length: TOTAL_BLOCKS }, (_, i) => ({
  id: `block-${i}`,
  type: 'paragraph',
  paragraph: {
    rich_text: [{ type: 'text', text: { content: BLOCK_PAYLOAD } }]
  },
  created_time: new Date().toISOString(),
  last_edited_time: new Date().toISOString(),
  has_children: false,
  archived: false
}))

// Mock Notion Client
const notion = {
  blocks: {
    children: {
      list: async ({ start_cursor, page_size = 100 }: any) => {
        const start = start_cursor ? parseInt(start_cursor, 10) : 0
        const end = Math.min(start + page_size, mockBlocks.length)
        const results = mockBlocks.slice(start, end)
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 10))
        return {
          results: JSON.parse(JSON.stringify(results)), // Clone
          next_cursor: end < mockBlocks.length ? end.toString() : null,
          has_more: end < mockBlocks.length
        }
      }
    },
    delete: async ({ block_id }: any) => {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { id: block_id, object: 'block', deleted: true }
    }
  }
}

async function runBenchmark() {
  if (global.gc) global.gc()

  console.log('Starting Benchmark Comparison...')
  console.log(`Total Blocks: ${TOTAL_BLOCKS}`)

  // --- BASELINE ---
  console.log('\n[Baseline Implementation]')
  const start = performance.now()
  const startMem = process.memoryUsage().heapUsed

  const existingBlocks = await autoPaginate(
    (cursor) =>
      notion.blocks.children.list({
        block_id: 'page-1',
        start_cursor: cursor,
        page_size: 100
      }) as any
  )

  await processBatches(existingBlocks, async (block: any) => {
    await notion.blocks.delete({ block_id: block.id })
  }) // Default concurrency 3

  const end = performance.now()
  const endMem = process.memoryUsage().heapUsed

  console.log(`Time: ${(end - start).toFixed(2)}ms`)
  console.log(`Heap Delta: ${((endMem - startMem) / 1024 / 1024).toFixed(2)} MB`)

  // --- OPTIMIZED ---
  if (global.gc) global.gc()
  console.log('\n[Optimized Implementation]')
  const startOpt = performance.now()
  const startMemOpt = process.memoryUsage().heapUsed

  const existingBlocksOpt = await autoPaginate(async (cursor) => {
    const blocks = await notion.blocks.children.list({
      block_id: 'page-1',
      start_cursor: cursor,
      page_size: 100
    })
    return {
      ...blocks,
      results: blocks.results.map((b: any) => ({ id: b.id }))
    } as any
  })

  await processBatches(
    existingBlocksOpt,
    async (block: any) => {
      await notion.blocks.delete({ block_id: block.id })
    },
    { concurrency: 5 }
  ) // Concurrency 5

  const endOpt = performance.now()
  const endMemOpt = process.memoryUsage().heapUsed

  console.log(`Time: ${(endOpt - startOpt).toFixed(2)}ms`)
  console.log(`Heap Delta: ${((endMemOpt - startMemOpt) / 1024 / 1024).toFixed(2)} MB`)

  // Comparison
  console.log('\n[Comparison]')
  console.log(`Time Improvement: ${(100 * (1 - (endOpt - startOpt) / (end - start))).toFixed(2)}%`)
  console.log(`Heap Reduction: ${(100 * (1 - (endMemOpt - startMemOpt) / (endMem - startMem))).toFixed(2)}%`)
}

runBenchmark().catch(console.error)
