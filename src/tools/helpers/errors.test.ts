import { describe, expect, it } from 'vitest'
import { enhanceError } from './errors'

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
