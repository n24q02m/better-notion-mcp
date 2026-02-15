import { describe, expect, it } from 'vitest'
import { splitText, text } from './richtext.js'

describe('splitText', () => {
  it('should return a single chunk if content is shorter than maxLength', () => {
    const content = 'short content'
    const result = splitText(content, 20)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(text(content))
  })

  it('should return a single chunk if content is equal to maxLength', () => {
    const content = 'exactly twenty chars'
    const result = splitText(content, 20)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(text(content))
  })

  it('should split content into multiple chunks if longer than maxLength', () => {
    const content = 'this is longer than twenty chars'
    const result = splitText(content, 20)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(text('this is longer than '))
    expect(result[1]).toEqual(text('twenty chars'))
  })

  it('should handle exact multiples correctly', () => {
    // 10 chars + 9 chars
    const content = '1234567890123456789'
    const result = splitText(content, 10)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(text('1234567890'))
    expect(result[1]).toEqual(text('123456789'))
  })

  it('should handle exact multiples correctly (2 chunks full)', () => {
    // 10 chars + 10 chars
    const content = '12345678901234567890'
    const result = splitText(content, 10)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(text('1234567890'))
    expect(result[1]).toEqual(text('1234567890'))
  })

  it('should handle empty string', () => {
    const result = splitText('', 10)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(text(''))
  })

  it('should handle small maxLength', () => {
    const content = 'abcde'
    const result = splitText(content, 1)
    expect(result).toHaveLength(5)
    expect(result.map((r) => r.text.content)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
