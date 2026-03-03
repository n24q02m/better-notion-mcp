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
    // This assertion is expected to FAIL before the fix
    expect(enhanced.details).not.toHaveProperty('sensitive_token')
    expect(enhanced.details).not.toHaveProperty('internal_config')
    expect(enhanced.details).not.toHaveProperty('user_email')
  })
})
