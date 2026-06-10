import { describe, expect, it, vi } from 'vitest'
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

  it('should handle non-hex characters and multiple hyphens', () => {
    expect(normalizeId('g-h-i--j')).toBe('ghij')
    expect(normalizeId('!@#- %^-&*')).toBe('!@# %^&*')
    expect(normalizeId('---')).toBe('')
    expect(normalizeId('🔥-id')).toBe('🔥id')
    expect(normalizeId('-abc-')).toBe('abc')
    expect(normalizeId(' a - b ')).toBe(' a  b ')
  })
  it('should preserve case', () => {
    expect(normalizeId('AbC-DeF')).toBe('AbCDeF')
  })

  it('should handle tabs and newlines mixed with hyphens', () => {
    expect(normalizeId('a\t-b\n')).toBe('a\tb\n')
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

  it('should reject 31-character hex strings', () => {
    expect(isValidNotionId('a380296736214b04b6afbfef1b7687b')).toBe(false)
  })

  it('should reject 33-character hex strings', () => {
    expect(isValidNotionId('a380296736214b04b6afbfef1b7687b3a')).toBe(false)
  })

  it('should reject leading hyphen', () => {
    expect(isValidNotionId('-a380296736214b04b6afbfef1b7687b3')).toBe(false)
  })

  it('should reject trailing hyphen', () => {
    expect(isValidNotionId('a380296736214b04b6afbfef1b7687b3-')).toBe(false)
  })

  it('should reject multiple hyphens between groups', () => {
    expect(isValidNotionId('a3802967--3621-4b04-b6af-bfef1b7687b3')).toBe(false)
  })

  it('should reject misplaced hyphens', () => {
    expect(isValidNotionId('a380296-73621-4b04-b6af-bfef1b7687b3')).toBe(false)
  })

  it('should accept mixed hyphenation', () => {
    expect(isValidNotionId('a38029673621-4b04-b6afbfef1b7687b3')).toBe(true)
  })

  it('should accept single hyphen at the first slot', () => {
    expect(isValidNotionId('a3802967-36214b04b6afbfef1b7687b3')).toBe(true)
  })

  it('should accept single hyphen at the second slot', () => {
    expect(isValidNotionId('a38029673621-4b04b6afbfef1b7687b3')).toBe(true)
  })

  it('should accept single hyphen at the third slot', () => {
    expect(isValidNotionId('a380296736214b04-b6afbfef1b7687b3')).toBe(true)
  })

  it('should accept single hyphen at the fourth slot', () => {
    expect(isValidNotionId('a380296736214b04b6af-bfef1b7687b3')).toBe(true)
  })

  it('should reject dots as separators', () => {
    expect(isValidNotionId('a3802967.3621.4b04.b6af.bfef1b7687b3')).toBe(false)
  })

  it('should reject underscores as separators', () => {
    expect(isValidNotionId('a3802967_3621_4b04_b6af_bfef1b7687b3')).toBe(false)
  })

  it('should reject spaces as separators', () => {
    expect(isValidNotionId('a3802967 3621 4b04 b6af bfef1b7687b3')).toBe(false)
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

  it('should return 32-character non-hex strings unchanged', () => {
    expect(formatId('g380296736214b04b6afbfef1b7687b3')).toBe('g380296736214b04b6afbfef1b7687b3')
  })

  it('should return 31-character hex strings unchanged', () => {
    expect(formatId('a380296736214b04b6afbfef1b7687b')).toBe('a380296736214b04b6afbfef1b7687b')
  })

  it('should return 33-character hex strings unchanged', () => {
    expect(formatId('a380296736214b04b6afbfef1b7687b3a')).toBe('a380296736214b04b6afbfef1b7687b3a')
  })

  it('should format UUIDs with misplaced hyphens correctly', () => {
    expect(formatId('a3802967-3621-4b04-b6af-bfef-1b76-87b3')).toBe('a3802967-3621-4b04-b6af-bfef1b7687b3')
  })

  it('should return empty string unchanged', () => {
    expect(formatId('')).toBe('')
  })

  it('should return string with only whitespace unchanged', () => {
    expect(formatId('   ')).toBe('   ')
  })

  it('should return 32-character string with non-hex symbols unchanged', () => {
    expect(formatId('a380296736214b04b6afbfef1b7687b!')).toBe('a380296736214b04b6afbfef1b7687b!')
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

  it('should return false if Buffer.from fails', () => {
    const spy = vi.spyOn(Buffer, 'from').mockImplementation(() => {
      throw new Error('Buffer failure')
    })
    expect(isValidBase64('aGVsbG8=')).toBe(false)
    spy.mockRestore()
  })

  it('should reject string that exceeds maximum length', () => {
    // MAX_BASE64_LENGTH is 64MB. Let's create a string slightly larger.
    const largeStr = 'a'.repeat(64 * 1024 * 1024 + 4)
    expect(isValidBase64(largeStr)).toBe(false)
  })

  it('should reject URL-safe base64 characters', () => {
    // Notion API expects standard base64 (+/), not URL-safe (-_)
    expect(isValidBase64('aA-_')).toBe(false)
  })

  it('should reject non-string inputs', () => {
    // @ts-expect-error
    expect(isValidBase64(null)).toBe(false)
    // @ts-expect-error
    expect(isValidBase64(undefined)).toBe(false)
    // @ts-expect-error
    expect(isValidBase64(123)).toBe(false)
    // @ts-expect-error
    expect(isValidBase64({ key: 'value' })).toBe(false)
    // @ts-expect-error
    expect(isValidBase64(['a', 'b'])).toBe(false)
  })

  it('should reject strings with other special characters', () => {
    expect(isValidBase64('aGVsbG8#')).toBe(false)
    expect(isValidBase64('aGVsbG8@')).toBe(false)
    expect(isValidBase64('aGVsbG8*')).toBe(false)
  })

  it('should reject padding characters in the middle', () => {
    expect(isValidBase64('a=GVsbG8')).toBe(false)
    expect(isValidBase64('aGV=sbG8')).toBe(false)
  })

  it('should accept diverse valid base64 strings', () => {
    expect(isValidBase64('YWJj')).toBe(true) // 'abc'
    expect(isValidBase64('YWJjZA==')).toBe(true) // 'abcd'
    expect(isValidBase64('YWJjZGU=')).toBe(true) // 'abcde'
    expect(isValidBase64('YWJjZGVm')).toBe(true) // 'abcdef'
    expect(isValidBase64('U29tZSB0ZXh0IHdpdGggc3BlY2lhbCBjaGFycyAhQCMkJV4mKigp')).toBe(true)
  })
})
