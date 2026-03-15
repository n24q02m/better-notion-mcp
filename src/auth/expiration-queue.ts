/**
 * A queue that tracks the expiration of items in a Map.
 * Used to avoid O(N) traversals during periodic cleanup.
 * Assumes items are added in chronological order of expiration.
 */
export class ExpirationQueue<K> {
  private queue: { key: K; expiresAt: number }[] = []
  private headIndex = 0

  /**
   * Add a key and its expiration time to the queue.
   */
  add(key: K, expiresAt: number) {
    this.queue.push({ key, expiresAt })
  }

  /**
   * Process the queue, calling `onExpire` for each expired key.
   * Breaks early as soon as an unexpired item is found.
   */
  process(now: number, onExpire: (key: K) => void) {
    while (this.headIndex < this.queue.length) {
      const item = this.queue[this.headIndex]
      if (item.expiresAt > now) {
        break // Stop at the first unexpired item
      }
      onExpire(item.key)
      this.headIndex++
    }

    // Periodically compact the array to avoid unbounded memory growth
    if (this.headIndex > 1000 && this.headIndex > this.queue.length / 2) {
      this.queue = this.queue.slice(this.headIndex)
      this.headIndex = 0
    }
  }

  /**
   * For testing/debugging: get the current size of the queue.
   */
  get size() {
    return this.queue.length - this.headIndex
  }
}
