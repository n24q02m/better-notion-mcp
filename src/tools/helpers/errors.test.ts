import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceError, NotionMCPError, retryWithBackoff } from './errors'

describe('Error Handling Security', () => {
  it('should not leak sensitive details in generic errors', () => {
    const sensitiveError = {
      message: 'Something went wrong',
      name: 'GenericError',
      // No code, so it hits the generic path
      config: {
        headers: {
          Authorization: 'Bearer secret-token'
        }
      },
      request: {
        _headers: {
          authorization: 'Bearer secret-token'
        }
      },
      response: {
        status: 500
      }
    }

    const enhanced = enhanceError(sensitiveError)

    // Expectation of SECURE behavior
    expect(enhanced.details).toBeDefined()
    expect(enhanced.details.message).toBe('Something went wrong')

    // Verify secret is NOT leaked
    expect(JSON.stringify(enhanced.details)).not.toContain('secret-token')
    expect(enhanced.details.config).toBeUndefined()
    expect(enhanced.details.request).toBeUndefined()
  })
})

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await retryWithBackoff(fn)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail 1')).mockResolvedValue('success')

    const promise = retryWithBackoff(fn, { initialDelay: 100 })

    // Advance timers to trigger retry
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should fail after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const promise = retryWithBackoff(fn, { maxRetries: 2, initialDelay: 100 })

    // Attach handler immediately to avoid unhandled rejection warning
    const expectPromise = expect(promise).rejects.toThrow(NotionMCPError)

    // Advance enough time for all retries
    await vi.advanceTimersByTimeAsync(1000)

    await expectPromise
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('should not retry on unauthorized error', async () => {
    const error: any = new Error('Unauthorized')
    error.code = 'UNAUTHORIZED'
    const fn = vi.fn().mockRejectedValue(error)

    await expect(retryWithBackoff(fn)).rejects.toThrow(NotionMCPError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should increase delay exponentially', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    // Start async operation and handle expected error
    const promise = retryWithBackoff(fn, { maxRetries: 2, initialDelay: 100, backoffMultiplier: 2 }).catch(() => {})

    // Initial call happens immediately
    expect(fn).toHaveBeenCalledTimes(1)

    // Advance 50ms - should not retry yet (total 50ms < 100ms)
    await vi.advanceTimersByTimeAsync(50)
    expect(fn).toHaveBeenCalledTimes(1)

    // Advance another 50ms - should retry now (total 100ms)
    await vi.advanceTimersByTimeAsync(50)
    expect(fn).toHaveBeenCalledTimes(2)

    // Next delay is 100 * 2 = 200ms
    // Advance 100ms - should not retry yet (total 100ms < 200ms)
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)

    // Advance another 100ms - should retry now (total 200ms)
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(3)

    await promise
  })
})
