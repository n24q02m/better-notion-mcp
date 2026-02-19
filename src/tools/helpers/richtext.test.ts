import { describe, expect, it } from 'vitest'
import { extractPlainText, splitText } from './richtext'

describe('splitText', () => {
  it('should return a single chunk if content is within limit', () => {
    const content = 'Hello world'
    const chunks = splitText(content, 20)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.content).toBe(content)
  })

  it('should split content into multiple chunks if exceeding limit', () => {
    const content = 'Hello world'
    const maxLength = 5
    const chunks = splitText(content, maxLength)

    // "Hello" (5)
    // " worl" (5)
    // "d" (1)
    expect(chunks).toHaveLength(3)
    expect(chunks[0].text.content).toBe('Hello')
    expect(chunks[1].text.content).toBe(' worl')
    expect(chunks[2].text.content).toBe('d')

    // Verify reconstruction
    expect(extractPlainText(chunks)).toBe(content)
  })

  it('should handle exact boundary correctly', () => {
    const content = 'Hello'
    const maxLength = 5
    const chunks = splitText(content, maxLength)

    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.content).toBe('Hello')
  })

  it('should handle exact multiples correctly', () => {
    const content = '123456'
    const maxLength = 3
    const chunks = splitText(content, maxLength)

    expect(chunks).toHaveLength(2)
    expect(chunks[0].text.content).toBe('123')
    expect(chunks[1].text.content).toBe('456')
    expect(extractPlainText(chunks)).toBe(content)
  })

  it('should handle empty string', () => {
    const chunks = splitText('', 100)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text.content).toBe('')
  })

  it('should use default maxLength of 2000', () => {
    const longContent = 'a'.repeat(3000)
    const chunks = splitText(longContent)

    expect(chunks).toHaveLength(2)
    expect(chunks[0].text.content).toHaveLength(2000)
    expect(chunks[1].text.content).toHaveLength(1000)
    expect(extractPlainText(chunks)).toBe(longContent)
  })

  it('should handle custom maxLength', () => {
    const content = 'abcdef'
    const chunks = splitText(content, 2)

    expect(chunks).toHaveLength(3)
    expect(chunks.map((c) => c.text.content)).toEqual(['ab', 'cd', 'ef'])
  })
})
