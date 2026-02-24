import { describe, expect, it } from 'vitest'
import { enhanceError } from './errors'

describe('NotionMCPError Security', () => {
  it('should not leak sensitive details in validation_error', () => {
    const sensitiveBody = {
      message: 'Validation failed',
      object: 'error',
      status: 400,
      code: 'validation_error',
      // Simulate sensitive data in the error body
      request_payload: {
        authorization: 'Bearer secret-token-123',
        password: 'my-secret-password',
        user_email: 'admin@example.com'
      }
    }

    const error = {
      code: 'validation_error',
      message: 'Request body validation failed',
      body: sensitiveBody
    }

    const enhanced = enhanceError(error)

    expect(enhanced.details).toBeDefined()

    const detailsStr = JSON.stringify(enhanced.details)

    // Verify sensitive data is STRIPPED
    expect(detailsStr).not.toContain('secret-token-123')
    expect(detailsStr).not.toContain('my-secret-password')
    expect(detailsStr).not.toContain('admin@example.com')

    // Verify safe fields ARE present
    expect(enhanced.details.message).toBe('Validation failed')
    expect(enhanced.details.code).toBe('validation_error')
    expect(enhanced.details.status).toBe(400)

    // Verify unsafe fields are GONE
    expect(enhanced.details.request_payload).toBeUndefined()
  })
})
