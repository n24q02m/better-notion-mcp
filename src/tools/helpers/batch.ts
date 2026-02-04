/**
 * Process items in batches to limit concurrency
 * @param items Array of items to process
 * @param batchSize Number of items to process concurrently
 * @param processor Async function to process each item
 * @returns Array of results in the same order as items (roughly, though strictly speaking Promise.all maintains order of input promises)
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }
  return results
}
