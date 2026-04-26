import { describe, expect, it } from 'vitest'
import { enhanceError, NotionMCPError } from './errors'

describe('Security: Error Handling', () => {
  it('should not leak sensitive fields in validation_error body', () => {
    const sensitiveError = {
      code: 'validation_error',
      message: 'Invalid request',
      body: {
        message: 'Invalid property value',
        object: 'error',
        status: 400,
        code: 'validation_error',
        // Sensitive fields that should be sanitized
        sensitive_token: 'secret_token_123',
        internal_config: {
          db_connection: 'postgres://user:pass@localhost:5432/db'
        },
        user_email: 'user@example.com'
      }
    }

    const enhanced = enhanceError(sensitiveError)

    expect(enhanced).toBeInstanceOf(NotionMCPError)
    expect(enhanced.code).toBe('VALIDATION_ERROR')

    // Check that safe fields are present
    expect(enhanced.details).toBeDefined()
    expect(enhanced.details.message).toBe('Invalid property value')
    expect(enhanced.details.object).toBe('error')
    expect(enhanced.details.status).toBe(400)

    // Check that sensitive fields are REMOVED
    expect(enhanced.details).not.toHaveProperty('sensitive_token')
    expect(enhanced.details).not.toHaveProperty('internal_config')
    expect(enhanced.details).not.toHaveProperty('user_email')
  })

  it('should not leak Authorization headers in error objects', () => {
    const errorWithAuth = {
      message: 'Failed to fetch',
      headers: {
        Authorization: 'Bearer ntn_1234567890',
        'Content-Type': 'application/json'
      },
      config: {
        headers: {
          authorization: 'Bearer ntn_0987654321'
        }
      },
      request: {
        _headers: {
          authorization: 'Bearer ntn_abcdef'
        }
      }
    }

    const enhanced = enhanceError(errorWithAuth)
    expect(enhanced.details).toBeDefined()
    if (enhanced.details?.headers) {
      expect(enhanced.details.headers).not.toHaveProperty('Authorization')
      expect(enhanced.details.headers).toHaveProperty('Content-Type')
    }
    if (enhanced.details?.config?.headers) {
      expect(enhanced.details.config.headers).not.toHaveProperty('authorization')
    }
    if (enhanced.details?.request?._headers) {
      expect(enhanced.details.request._headers).not.toHaveProperty('authorization')
    }
  })
})
