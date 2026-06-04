import { describe, expect, it, vi } from 'vitest'
import {
  aiReadableMessage,
  enhanceError,
  findClosestMatch,
  NotionMCPError,
  retryWithBackoff,
  suggestFixes,
  withErrorHandling
} from './errors.js'

describe('NotionMCPError', () => {
  it('should set all properties from constructor', () => {
    const error = new NotionMCPError('message', 'CODE', 'suggestion', { detail: 'value' })

    expect(error.message).toBe('message')
    expect(error.code).toBe('CODE')
    expect(error.suggestion).toBe('suggestion')
    expect(error.details).toEqual({ detail: 'value' })
    expect(error.name).toBe('NotionMCPError')
  })

  it('should allow optional suggestion and details', () => {
    const error = new NotionMCPError('message', 'CODE')

    expect(error.suggestion).toBeUndefined()
    expect(error.details).toBeUndefined()
  })

  it('toJSON should return correct shape', () => {
    const error = new NotionMCPError('msg', 'ERR', 'suggest', { d: 1 })
    const json = error.toJSON()

    expect(json).toEqual({
      error: 'NotionMCPError',
      code: 'ERR',
      message: 'msg',
      suggestion: 'suggest',
      details: { d: 1 }
    })
  })

  it('toJSON should include undefined fields when not provided', () => {
    const error = new NotionMCPError('msg', 'ERR')
    const json = error.toJSON()

    expect(json).toHaveProperty('suggestion', undefined)
    expect(json).toHaveProperty('details', undefined)
  })
})

describe('enhanceError', () => {
  describe('Notion API errors', () => {
    it('should handle unauthorized error', () => {
      const result = enhanceError({ code: 'unauthorized', message: 'bad' })

      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.message).toContain('Invalid or missing')
      expect(result.suggestion).toContain('Set NOTION_TOKEN')
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
        body: { message: 'Property format error' }
      })

      expect(result.code).toBe('VALIDATION_ERROR')
      expect(result.message).toBe('Property format error')
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
          message: 'err',
          status: 400,
          request_id: '123',
          some_secret: 'hide me'
        }
      })

      expect(result.details).toEqual({
        message: 'err',
        status: 400,
        request_id: '123'
      })
      expect(result.details.some_secret).toBeUndefined()
    })

    it('should handle rate_limited error', () => {
      const result = enhanceError({ code: 'rate_limited', message: 'rate limited' })

      expect(result.code).toBe('RATE_LIMITED')
      expect(result.message).toContain('Too many requests')
      expect(result.suggestion).toContain('Wait')
    })

    it('should handle conflict_error', () => {
      const result = enhanceError({ code: 'conflict_error', message: 'conflict' })

      expect(result.code).toBe('CONFLICT')
      expect(result.message).toContain('Conflict')
    })

    it('should handle service_unavailable error', () => {
      const result = enhanceError({ code: 'service_unavailable', message: 'unavailable' })

      expect(result.code).toBe('SERVICE_UNAVAILABLE')
      expect(result.message).toContain('temporarily unavailable')
      expect(result.suggestion).toContain('status.notion.so')
    })

    it('should handle unknown Notion error codes by uppercasing', () => {
      const result = enhanceError({ code: 'some_new_error', message: 'something new' })

      expect(result.code).toBe('SOME_NEW_ERROR')
      expect(result.message).toBe('something new')
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

  it('should format error with fallback suggestions when no explicit suggestion provided', () => {
    const error = new NotionMCPError('Something failed', 'UNKNOWN')
    const msg = aiReadableMessage(error)

    expect(msg).toContain('Error: Something failed')
    expect(msg).toContain('Suggestion:')
    expect(msg).toContain('Check Notion API status')
  })

  it('should format error with details and fallback suggestions', () => {
    const error = new NotionMCPError('Bad input', 'VALIDATION_ERROR', undefined, { field: 'title' })
    const msg = aiReadableMessage(error)

    expect(msg).toContain('Error: Bad input')
    expect(msg).toContain('Suggestion:')
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

  it('should format error with empty message', () => {
    const error = new NotionMCPError('', 'CODE', 'Fix it')
    const msg = aiReadableMessage(error)

    expect(msg).toBe('Error: \n\nSuggestion: Fix it')
  })

  it('should format error with empty details object', () => {
    const error = new NotionMCPError('Error', 'CODE', undefined, {})
    const msg = aiReadableMessage(error)

    expect(msg).toContain('Details: {}')
  })

  it('should format fallback suggestions with exact bulleted list', () => {
    const error = new NotionMCPError('Failed', 'UNAUTHORIZED')
    const msg = aiReadableMessage(error)

    // UNAUTHORIZED has 3 suggestions
    const expectedSuggestion =
      '\n- Check that NOTION_TOKEN is set in your environment\n- Verify token at https://www.notion.so/my-integrations\n- Create a new integration token if needed'
    expect(msg).toBe(`Error: Failed\n\nSuggestion: ${expectedSuggestion}`)
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
