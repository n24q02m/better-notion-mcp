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
    expect((enhanced.details as any).message).toBe('Invalid property value')
    expect((enhanced.details as any).object).toBe('error')
    expect((enhanced.details as any).status).toBe(400)

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
    if ((enhanced.details as any)?.headers) {
      expect((enhanced.details as any).headers).not.toHaveProperty('Authorization')
      expect((enhanced.details as any).headers).toHaveProperty('Content-Type')
    }
    if ((enhanced.details as any)?.config?.headers) {
      expect((enhanced.details as any).config.headers).not.toHaveProperty('authorization')
    }
    if ((enhanced.details as any)?.request?._headers) {
      expect((enhanced.details as any).request._headers).not.toHaveProperty('authorization')
    }
  })

  it('strips Authorization headers regardless of casing (case-insensitive redaction)', () => {
    // Upstream HTTP libraries differ on header-name casing. The redactor must
    // catch every variant or we leak the bearer token from the source error
    // object (whose reference may be retained elsewhere -- e.g. error logger).
    const errorWithMixedCase: any = {
      message: 'Failed to fetch',
      headers: {
        AUTHORIZATION: 'Bearer ntn_uppercase',
        'X-Api-Key': 'ntn_apikey',
        'Content-Type': 'application/json'
      },
      response: {
        headers: {
          Authorization: 'Bearer ntn_response',
          'Set-Cookie': 'session=secret'
        }
      },
      config: {
        headers: {
          AuThOrIzAtIoN: 'Bearer ntn_mixedcase'
        }
      }
    }

    enhanceError(errorWithMixedCase)

    // enhanceError mutates the input in place via stripSensitiveFields --
    // the original object should no longer contain any of the sensitive
    // header values, regardless of original casing.
    expect(errorWithMixedCase.headers).not.toHaveProperty('AUTHORIZATION')
    expect(errorWithMixedCase.headers).not.toHaveProperty('X-Api-Key')
    expect(errorWithMixedCase.headers).toHaveProperty('Content-Type')
    expect(errorWithMixedCase.response.headers).not.toHaveProperty('Authorization')
    expect(errorWithMixedCase.response.headers).not.toHaveProperty('Set-Cookie')
    expect(errorWithMixedCase.config.headers).not.toHaveProperty('AuThOrIzAtIoN')

    // Hard guarantee: no leaked bearer/api-key value anywhere in the tree.
    const json = JSON.stringify(errorWithMixedCase)
    expect(json).not.toContain('ntn_uppercase')
    expect(json).not.toContain('ntn_apikey')
    expect(json).not.toContain('ntn_response')
    expect(json).not.toContain('ntn_mixedcase')
    expect(json).not.toContain('session=secret')
  })

  it('strips Proxy-Authorization, Cookie and X-Auth-Token headers regardless of casing', () => {
    const error: any = {
      message: 'Failed',
      headers: {
        'Proxy-Authorization': 'Basic abc',
        Cookie: 'session=xyz',
        'X-Auth-Token': 'tok123',
        'set-COOKIE': 'second=def'
      }
    }
    enhanceError(error)
    expect(error.headers).not.toHaveProperty('Proxy-Authorization')
    expect(error.headers).not.toHaveProperty('Cookie')
    expect(error.headers).not.toHaveProperty('X-Auth-Token')
    expect(error.headers).not.toHaveProperty('set-COOKIE')
  })
})
