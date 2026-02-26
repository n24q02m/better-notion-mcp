## ⚡ Optimize processBatches with safe defaults and sliding window concurrency

### 💡 What
- Changed default `batchSize` in `processBatches` from 10 to 1.
- Refactored `processBatches` to use a sliding window concurrency model (semaphore/queue) instead of batch-of-batches.
- Resulting default concurrency is now 3 (was 30).
- Preserved backward compatibility for explicit high-concurrency configurations (e.g., `batchSize: 5, concurrency: 3` results in 15 concurrent tasks).

### 🎯 Why
- The previous implementation had aggressive default concurrency (30 parallel requests), which risks hitting Notion API rate limits (429).
- The batch-of-batches implementation was inefficient, waiting for the slowest task in a batch before starting the next batch.

### 📊 Measured Improvement
- **Safety:** Default concurrency reduced from 30 to 3.
- **Efficiency:** Sliding window implementation eliminates idle time waiting for batch completion.
- **Benchmark:** Validated with `scripts/benchmark-pagination.ts`.
