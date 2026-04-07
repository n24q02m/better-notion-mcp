import { describe, expect, it, vi } from 'vitest'
import {
  aiReadableMessage,
  enhanceError,
  findClosestMatch,
  NotionMCPError,
  retryWithBackoff,
  suggestFixes,
  withErrorHandling
} from './errors'

describe('NotionMCPError', () => {
  it('should set all properties from constructor', () => {
    const error = new NotionMCPError('test message', 'TEST_CODE', 'try this', { foo: 'bar' })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(NotionMCPError)
    expect(error.name).toBe('NotionMCPError')
    expect(error.message).toBe('test message')
    expect(error.code).toBe('TEST_CODE')
    expect(error.suggestion).toBe('try this')
    expect(error.details).toEqual({ foo: 'bar' })
  })

  it('should allow optional suggestion and details', () => {
    const error = new NotionMCPError('msg', 'CODE')

    expect(error.suggestion).toBeUndefined()
    expect(error.details).toBeUndefined()
  })

  it('toJSON should return correct shape', () => {
    const error = new NotionMCPError('msg', 'CODE', 'hint', { id: 1 })
    const json = error.toJSON()

    expect(json).toEqual({
      error: 'NotionMCPError',
      code: 'CODE',
      message: 'msg',
      suggestion: 'hint',
      details: { id: 1 }
    })
  })

  it('toJSON should include undefined fields when not provided', () => {
    const error = new NotionMCPError('msg', 'CODE')
    const json = error.toJSON()

    expect(json).toEqual({
      error: 'NotionMCPError',
      code: 'CODE',
      message: 'msg',
      suggestion: undefined,
      details: undefined
    })
  })
})

describe('enhanceError', () => {
  describe('Notion API errors', () => {
    it('should handle unauthorized error', () => {
      const result = enhanceError({ code: 'unauthorized' })

      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.suggestion).toContain('NOTION_TOKEN')
    })

    it('should handle restricted_resource error', () => {
      const result = enhanceError({ code: 'restricted_resource' })

      expect(result.code).toBe('RESTRICTED_RESOURCE')
      expect(result.suggestion).toContain('Share the page')
    })

    it('should handle object_not_found error', () => {
      const result = enhanceError({ code: 'object_not_found' })

      expect(result.code).toBe('NOT_FOUND')
      expect(result.suggestion).toContain('Check the ID')
    })

    it('should handle validation_error with body message', () => {
      const result = enhanceError({
        code: 'validation_error',
        body: { message: 'invalid property' }
      })

      expect(result.code).toBe('VALIDATION_ERROR')
      expect(result.message).toBe('invalid property')
    })

    it('should handle validation_error without body', () => {
      const result = enhanceError({ code: 'validation_error' })

      expect(result.code).toBe('VALIDATION_ERROR')
      expect(result.message).toBe('Invalid request parameters')
    })

    it('should sanitize validation_error body to remove sensitive fields', () => {
      const result = enhanceError({
        code: 'validation_error',
        body: {
          message: 'error',
          sensitive_token: 'secret'
        }
      })

      expect(result.details.sensitive_token).toBeUndefined()
      expect(result.details.message).toBe('error')
    })

    it('should handle rate_limited error', () => {
      const result = enhanceError({ code: 'rate_limited' })

      expect(result.code).toBe('RATE_LIMITED')
      expect(result.suggestion).toContain('Wait a few seconds')
    })

    it('should handle conflict_error', () => {
      const result = enhanceError({ code: 'conflict_error' })

      expect(result.code).toBe('CONFLICT')
      expect(result.suggestion).toContain('modified')
    })

    it('should handle service_unavailable error', () => {
      const result = enhanceError({ code: 'service_unavailable' })

      expect(result.code).toBe('SERVICE_UNAVAILABLE')
      expect(result.suggestion).toContain('status.notion.so')
    })

    it('should handle internal_server_error', () => {
      const result = enhanceError({ code: 'internal_server_error' })
      expect(result.code).toBe('INTERNAL_SERVER_ERROR')
      expect(result.suggestion).toContain('internal error')
    })

    it('should handle gateway_timeout', () => {
      const result = enhanceError({ code: 'gateway_timeout' })
      expect(result.code).toBe('GATEWAY_TIMEOUT')
      expect(result.suggestion).toContain('timed out')
    })

    it('should handle unknown Notion error codes by uppercasing', () => {
      const result = enhanceError({ code: 'something_weird' })

      expect(result.code).toBe('SOMETHING_WEIRD')
      expect(result.suggestion).toContain('Notion API documentation')
    })

    it('should use fallback message when Notion error has no message', () => {
      const result = enhanceError({ code: 'some_code' })

      expect(result.message).toBe('Unknown Notion API error')
    })
  })

  describe('Network errors', () => {
    it('should handle ECONNREFUSED', () => {
      const result = enhanceError({ message: 'connect ECONNREFUSED 127.0.0.1:443' })

      expect(result.code).toBe('NETWORK_ERROR')
      expect(result.message).toContain('Cannot connect')
      expect(result.suggestion).toContain('internet connection')
    })

    it('should handle ENOTFOUND', () => {
      const result = enhanceError({ message: 'getaddrinfo ENOTFOUND api.notion.com' })

      expect(result.code).toBe('NETWORK_ERROR')
      expect(result.message).toContain('Cannot connect')
    })
  })

  describe('Generic errors', () => {
    it('should handle errors without code', () => {
      const result = enhanceError({ message: 'something broke' })

      expect(result.code).toBe('UNKNOWN_ERROR')
      expect(result.message).toBe('something broke')
      expect(result.suggestion).toContain('try again')
    })

    it('should handle errors without message', () => {
      const result = enhanceError({})

      expect(result.code).toBe('UNKNOWN_ERROR')
      expect(result.message).toBe('Unknown error occurred')
    })

    it('should sanitize details for generic errors', () => {
      const result = enhanceError({
        message: 'oops',
        name: 'SomeError',
        status: 502
      })

      expect(result.details).toEqual({
        message: 'oops',
        name: 'SomeError',
        code: undefined,
        status: 502
      })
    })
  })

  describe('Security', () => {
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
})

describe('aiReadableMessage', () => {
  it('should format error with suggestion', () => {
    const error = new NotionMCPError('Page not found', 'NOT_FOUND', 'Check the ID')
    const msg = aiReadableMessage(error)

    expect(msg).toBe('Error: Page not found\n\nSuggestion: Check the ID')
  })

  it('should format error without suggestion', () => {
    const error = new NotionMCPError('Something failed', 'UNKNOWN')
    const msg = aiReadableMessage(error)

    expect(msg).toBe('Error: Something failed')
    expect(msg).not.toContain('Suggestion')
  })

  it('should format error with details', () => {
    const error = new NotionMCPError('Bad input', 'VALIDATION_ERROR', undefined, { field: 'title' })
    const msg = aiReadableMessage(error)

    expect(msg).toContain('Error: Bad input')
    expect(msg).not.toContain('Suggestion')
    expect(msg).toContain('Details:')
    expect(msg).toContain('"field": "title"')
  })

  it('should format error with both suggestion and details', () => {
    const error = new NotionMCPError('Bad input', 'VALIDATION_ERROR', 'Fix it', { field: 'title' })
    const msg = aiReadableMessage(error)

    expect(msg).toContain('Error: Bad input')
    expect(msg).toContain('Suggestion: Fix it')
    expect(msg).toContain('Details:')
  })
})

describe('suggestFixes', () => {
  it('should return UNAUTHORIZED suggestions', () => {
    const fixes = suggestFixes(new NotionMCPError('', 'UNAUTHORIZED'))

    expect(fixes).toHaveLength(3)
    expect(fixes[0]).toContain('NOTION_TOKEN')
    expect(fixes[1]).toContain('notion.so/my-integrations')
  })

  it('should return RESTRICTED_RESOURCE suggestions', () => {
    const fixes = suggestFixes(new NotionMCPError('', 'RESTRICTED_RESOURCE'))

    expect(fixes).toHaveLength(3)
    expect(fixes.some((f) => f.includes('Add connections'))).toBe(true)
  })

  it('should return NOT_FOUND suggestions', () => {
    const fixes = suggestFixes(new NotionMCPError('', 'NOT_FOUND'))

    expect(fixes).toHaveLength(3)
    expect(fixes[0]).toContain('ID')
  })

  it('should return VALIDATION_ERROR suggestions', () => {
    const fixes = suggestFixes(new NotionMCPError('', 'VALIDATION_ERROR'))

    expect(fixes).toHaveLength(3)
    expect(fixes.some((f) => f.includes('parameter'))).toBe(true)
  })

  it('should return RATE_LIMITED suggestions', () => {
    const fixes = suggestFixes(new NotionMCPError('', 'RATE_LIMITED'))

    expect(fixes).toHaveLength(3)
    expect(fixes.some((f) => f.includes('backoff'))).toBe(true)
  })

  it('should return INTERNAL_SERVER_ERROR suggestions', () => {
    const fixes = suggestFixes(new NotionMCPError('', 'INTERNAL_SERVER_ERROR'))
    expect(fixes).toHaveLength(2)
    expect(fixes[1]).toContain('status.notion.so')
  })

  it('should return default suggestions for unknown codes', () => {
    const fixes = suggestFixes(new NotionMCPError('', 'SOMETHING_ELSE'))

    expect(fixes).toHaveLength(3)
    expect(fixes[0]).toContain('status.notion.so')
    expect(fixes.some((f) => f.includes('Try again'))).toBe(true)
  })
})

describe('withErrorHandling', () => {
  it('should pass through successful results', async () => {
    const fn = async (a: number, b: number) => a + b
    const wrapped = withErrorHandling(fn)

    const result = await wrapped(2, 3)
    expect(result).toBe(5)
  })

  it('should catch and enhance errors', async () => {
    const fn = async () => {
      throw { code: 'unauthorized', message: 'bad token' }
    }
    const wrapped = withErrorHandling(fn)

    await expect(wrapped()).rejects.toThrow(NotionMCPError)
    await expect(wrapped()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('should preserve argument types', async () => {
    const fn = async (name: string) => `hello ${name}`
    const wrapped = withErrorHandling(fn)

    expect(await wrapped('world')).toBe('hello world')
  })
})

describe('retryWithBackoff', () => {
  it('should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue('ok')

    const result = await retryWithBackoff(fn, { initialDelay: 1 })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should succeed after retries', async () => {
    const fn = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject({ message: 'fail 1' }))
      .mockImplementationOnce(() => Promise.reject({ message: 'fail 2' }))
      .mockResolvedValue('ok')

    const result = await retryWithBackoff(fn, { initialDelay: 1, maxDelay: 10 })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should give up after maxRetries', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject({ message: 'always fails' }))

    await expect(retryWithBackoff(fn, { maxRetries: 2, initialDelay: 1, maxDelay: 5 })).rejects.toThrow(NotionMCPError)

    // 1 initial + 2 retries = 3
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should not retry on UNAUTHORIZED', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject({ code: 'UNAUTHORIZED', message: 'bad token' }))

    await expect(retryWithBackoff(fn, { maxRetries: 3, initialDelay: 1 })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    })

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should not retry on NOT_FOUND', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject({ code: 'NOT_FOUND', message: 'gone' }))

    await expect(retryWithBackoff(fn, { maxRetries: 3, initialDelay: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on other error codes', async () => {
    const fn = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject({ code: 'RATE_LIMITED', message: 'slow down' }))
      .mockResolvedValue('ok')

    const result = await retryWithBackoff(fn, { initialDelay: 1 })

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should use default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue('ok')

    const result = await retryWithBackoff(fn)

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should enhance the last error when all retries fail', async () => {
    const fn = vi.fn().mockImplementation(() => Promise.reject({ message: 'transient' }))

    try {
      await retryWithBackoff(fn, { maxRetries: 1, initialDelay: 1 })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(NotionMCPError)
      expect((error as NotionMCPError).code).toBe('UNKNOWN_ERROR')
    }
  })
})

describe('findClosestMatch', () => {
  it('should return null for empty input or empty options', () => {
    expect(findClosestMatch('', ['option'])).toBeNull()
    expect(findClosestMatch('input', [])).toBeNull()
  })

  it('should return option if it is a prefix of input or vice versa (case-insensitive)', () => {
    expect(findClosestMatch('prop', ['property', 'other'])).toBe('property')
    expect(findClosestMatch('PROPERTY', ['prop', 'other'])).toBe('prop')
    expect(findClosestMatch('property', ['Prop', 'other'])).toBe('Prop')
  })

  it('should return closest match based on bigram similarity', () => {
    expect(findClosestMatch('propety', ['property', 'something else'])).toBe('property')
  })

  it('should return null if no match is above threshold', () => {
    expect(findClosestMatch('xyz', ['abc', 'def'])).toBeNull()
  })

  it('should return the match with the highest score', () => {
    expect(findClosestMatch('test', ['testing', 'tent'])).toBe('testing')
  })
})
