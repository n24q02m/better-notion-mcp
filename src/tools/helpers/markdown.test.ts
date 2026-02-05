import { describe, expect, it } from 'vitest'
import { parseRichText } from './markdown'

describe('parseRichText', () => {
  it('should parse plain text', () => {
    const result = parseRichText('Hello world')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Hello world')
    expect(result[0].annotations.bold).toBe(false)
  })

  it('should parse bold text', () => {
    const result = parseRichText('**bold**')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('bold')
    expect(result[0].annotations.bold).toBe(true)
  })

  it('should parse mixed text', () => {
    const result = parseRichText('plain **bold** plain')
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('plain ')
    expect(result[0].annotations.bold).toBe(false)
    expect(result[1].text.content).toBe('bold')
    expect(result[1].annotations.bold).toBe(true)
    expect(result[2].text.content).toBe(' plain')
    expect(result[2].annotations.bold).toBe(false)
  })

  it('should parse nested formatting', () => {
    const result = parseRichText('**bold *italic***')
    // Expected behavior based on standard markdown or current impl
    const boldPart = result.find((r) => r.text.content === 'bold ')
    expect(boldPart).toBeDefined()
    expect(boldPart?.annotations.bold).toBe(true)

    const italicPart = result.find((r) => r.text.content === 'italic')
    expect(italicPart).toBeDefined()
    expect(italicPart?.annotations.bold).toBe(true)
    expect(italicPart?.annotations.italic).toBe(true)
  })

  it('should parse links', () => {
    const result = parseRichText('[link](http://example.com)')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('link')
    expect(result[0].text.link?.url).toBe('http://example.com')
  })

  it('should parse links embedded in text', () => {
    const result = parseRichText('Click [here](http://example.com) to go')
    expect(result).toHaveLength(3)
    expect(result[1].text.content).toBe('here')
    expect(result[1].text.link?.url).toBe('http://example.com')
  })
})
