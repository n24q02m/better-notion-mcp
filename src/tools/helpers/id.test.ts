import { describe, expect, it } from 'vitest'
import { formatId, isValidBase64, isValidNotionId, normalizeId } from './id'

describe('normalizeId', () => {
  it('should strip hyphens from UUID', () => {
    expect(normalizeId('a3802967-3621-4b04-b6af-bfef1b7687b3')).toBe('a380296736214b04b6afbfef1b7687b3')
  })

  it('should return compact UUID unchanged', () => {
    expect(normalizeId('a380296736214b04b6afbfef1b7687b3')).toBe('a380296736214b04b6afbfef1b7687b3')
  })

  it('should strip hyphens from any string', () => {
    expect(normalizeId('abc-def')).toBe('abcdef')
  })

  it('should return empty string unchanged', () => {
    expect(normalizeId('')).toBe('')
  })

  it('should return string without hyphens unchanged', () => {
    expect(normalizeId('abcdef123456')).toBe('abcdef123456')
  })
})

describe('isValidNotionId', () => {
  it('should accept hyphenated UUID', () => {
    expect(isValidNotionId('a3802967-3621-4b04-b6af-bfef1b7687b3')).toBe(true)
  })

  it('should accept compact UUID', () => {
    expect(isValidNotionId('a380296736214b04b6afbfef1b7687b3')).toBe(true)
  })

  it('should reject short strings', () => {
    expect(isValidNotionId('abc123')).toBe(false)
  })

  it('should reject non-hex characters', () => {
    expect(isValidNotionId('g3802967-3621-4b04-b6af-bfef1b7687b3')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidNotionId('')).toBe(false)
  })

  it('should be case insensitive', () => {
    expect(isValidNotionId('A3802967-3621-4B04-B6AF-BFEF1B7687B3')).toBe(true)
  })
})

describe('formatId', () => {
  it('should format compact UUID to hyphenated form', () => {
    expect(formatId('a380296736214b04b6afbfef1b7687b3')).toBe('a3802967-3621-4b04-b6af-bfef1b7687b3')
  })

  it('should return already-hyphenated UUID formatted correctly', () => {
    expect(formatId('a3802967-3621-4b04-b6af-bfef1b7687b3')).toBe('a3802967-3621-4b04-b6af-bfef1b7687b3')
  })

  it('should return non-UUID strings unchanged', () => {
    expect(formatId('not-a-uuid')).toBe('not-a-uuid')
  })

  it('should return short hex strings unchanged', () => {
    expect(formatId('abc123')).toBe('abc123')
  })

  it('should handle uppercase hex', () => {
    expect(formatId('A380296736214B04B6AFBFEF1B7687B3')).toBe('A3802967-3621-4B04-B6AF-BFEF1B7687B3')
  })
})

describe('isValidBase64', () => {
  it('should accept valid base64 string', () => {
    expect(isValidBase64('aGVsbG8=')).toBe(true)
  })

  it('should accept base64 without padding', () => {
    expect(isValidBase64('aGVs')).toBe(true)
  })

  it('should accept base64 with double padding', () => {
    expect(isValidBase64('aA==')).toBe(true)
  })

  it('should reject empty string', () => {
    expect(isValidBase64('')).toBe(false)
  })

  it('should reject string with length not divisible by 4', () => {
    expect(isValidBase64('abc')).toBe(false)
  })

  it('should reject string with invalid characters', () => {
    expect(isValidBase64('ab!d')).toBe(false)
  })

  it('should accept string with + and / characters', () => {
    expect(isValidBase64('ab+/')).toBe(true)
  })

  it('should reject string with spaces', () => {
    expect(isValidBase64('aG Vs')).toBe(false)
  })

  it('should reject non-canonical base64', () => {
    // 'aB==' has bits set in the padding area that shouldn't be there
    expect(isValidBase64('aB==')).toBe(false)
  })

  it('should reject incorrect padding placement', () => {
    expect(isValidBase64('a=bc')).toBe(false)
    expect(isValidBase64('==AA')).toBe(false)
  })

  it('should reject too many padding characters', () => {
    expect(isValidBase64('a===')).toBe(false)
  })
})
