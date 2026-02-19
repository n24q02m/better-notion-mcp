import { processBatches } from '../src/tools/helpers/pagination.js'

async function main() {
  const items = Array.from({ length: 50 }, (_, i) => i)
  let maxConcurrency = 0
  let currentConcurrency = 0

  const processFn = async (item: number) => {
    currentConcurrency++
    maxConcurrency = Math.max(maxConcurrency, currentConcurrency)

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 100))

    currentConcurrency--
    return item * 2
  }

  console.log('Running processBatches with defaults...')
  // Default: batchSize=10, concurrency=3 -> should be 30
  const start = Date.now()
  await processBatches(items, processFn)
  const end = Date.now()

  console.log(`Time: ${end - start}ms`)
  console.log(`Max Concurrency: ${maxConcurrency}`)

  // Reset
  maxConcurrency = 0
  currentConcurrency = 0

  console.log('\nRunning processBatches with explicit { batchSize: 5, concurrency: 2 }...')
  // Expect 5 * 2 = 10
  await processBatches(items, processFn, { batchSize: 5, concurrency: 2 })

  console.log(`Max Concurrency: ${maxConcurrency}`)
}

main().catch(console.error)
