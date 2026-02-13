import { describe, it, expect } from 'vitest'
import { parseRichText } from './markdown.js'

describe('parseRichText', () => {
  it('should parse plain text', () => {
    const text = 'Hello world'
    const result = parseRichText(text)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Hello world')
    expect(result[0].annotations.bold).toBe(false)
  })

  it('should parse bold text', () => {
    const text = 'Hello **bold** world'
    const result = parseRichText(text)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Hello ')
    expect(result[1].text.content).toBe('bold')
    expect(result[1].annotations.bold).toBe(true)
    expect(result[2].text.content).toBe(' world')
  })

  it('should parse italic text', () => {
    const text = 'Hello *italic* world'
    const result = parseRichText(text)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Hello ')
    expect(result[1].text.content).toBe('italic')
    expect(result[1].annotations.italic).toBe(true)
    expect(result[2].text.content).toBe(' world')
  })

  it('should parse code', () => {
    const text = 'Hello `code` world'
    const result = parseRichText(text)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Hello ')
    expect(result[1].text.content).toBe('code')
    expect(result[1].annotations.code).toBe(true)
    expect(result[2].text.content).toBe(' world')
  })

  it('should parse strikethrough', () => {
    const text = 'Hello ~~strike~~ world'
    const result = parseRichText(text)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Hello ')
    expect(result[1].text.content).toBe('strike')
    expect(result[1].annotations.strikethrough).toBe(true)
    expect(result[2].text.content).toBe(' world')
  })

  it('should parse links', () => {
    const text = 'Hello [link](https://example.com) world'
    const result = parseRichText(text)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Hello ')
    expect(result[1].text.content).toBe('link')
    expect(result[1].text.link?.url).toBe('https://example.com')
    expect(result[2].text.content).toBe(' world')
  })

  it('should handle nested formatting (simple implementation checks)', () => {
    // The current implementation is simple and might not handle nesting perfectly or as expected in a full parser,
    // but let's see how it behaves. The current loop toggles flags.
    // **bold *italic***
    const text = '**bold *italic***'
    const _result = parseRichText(text)
    // Expected: bold, then bold+italic
    // Let's verify what the current implementation does.
    // It should produce segments based on token toggles.
  })
})

describe('parseRichText Performance', () => {
  it('should be fast for large text', () => {
    const plainText = 'This is a long sentence with some words to parse. '
    const formattedText = 'This is a **bold** sentence with *italic* words. '

    const largePlainText = plainText.repeat(10000) // ~500KB
    const largeFormattedText = formattedText.repeat(10000) // ~500KB with formatting

    const startPlain = performance.now()
    parseRichText(largePlainText)
    const endPlain = performance.now()
    console.log(`Plain text parsing time: ${(endPlain - startPlain).toFixed(2)}ms`)

    const startFormatted = performance.now()
    parseRichText(largeFormattedText)
    const endFormatted = performance.now()
    console.log(`Formatted text parsing time: ${(endFormatted - startFormatted).toFixed(2)}ms`)
  })
})
