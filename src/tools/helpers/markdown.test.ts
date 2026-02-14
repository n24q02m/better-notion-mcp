import { describe, expect, it } from 'vitest'
import { parseRichText } from './markdown'

describe('parseRichText', () => {
  it('should parse plain text', () => {
    const input = 'Hello world'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Hello world')
    expect(result[0].annotations.bold).toBe(false)
  })

  it('should parse bold text', () => {
    const input = 'Hello **bold** world'
    const result = parseRichText(input)

    // Expect: "Hello ", "**bold**" (as bold), " world"
    // Wait, the implementation toggles flags.
    // "Hello " -> plain
    // "**" -> toggle bold
    // "bold" -> text with bold=true
    // "**" -> toggle bold
    // " world" -> plain

    // Let's see how many segments.
    // Segment 1: "Hello " (plain)
    // Segment 2: "bold" (bold)
    // Segment 3: " world" (plain)

    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Hello ')
    expect(result[0].annotations.bold).toBe(false)

    expect(result[1].text.content).toBe('bold')
    expect(result[1].annotations.bold).toBe(true)

    expect(result[2].text.content).toBe(' world')
    expect(result[2].annotations.bold).toBe(false)
  })

  it('should parse italic text', () => {
    const input = '*italic*'
    const result = parseRichText(input)

    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('italic')
    expect(result[0].annotations.italic).toBe(true)
  })

  it('should parse code text', () => {
    const input = '`code`'
    const result = parseRichText(input)

    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('code')
    expect(result[0].annotations.code).toBe(true)
  })

  it('should parse strikethrough text', () => {
    const input = '~~strike~~'
    const result = parseRichText(input)

    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('strike')
    expect(result[0].annotations.strikethrough).toBe(true)
  })

  it('should parse links', () => {
    const input = '[Google](https://google.com)'
    const result = parseRichText(input)

    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Google')
    expect(result[0].text.link?.url).toBe('https://google.com')
  })

  it('should handle mixed formatting', () => {
    const input = 'Normal **Bold** *Italic* `Code` [Link](url)'
    const result = parseRichText(input)

    // "Normal "
    // "Bold" (bold)
    // " "
    // "Italic" (italic)
    // " "
    // "Code" (code)
    // " "
    // "Link" (link)

    expect(result.length).toBeGreaterThanOrEqual(7)

    const boldItem = result.find((r) => r.text.content === 'Bold')
    expect(boldItem?.annotations.bold).toBe(true)

    const italicItem = result.find((r) => r.text.content === 'Italic')
    expect(italicItem?.annotations.italic).toBe(true)

    const codeItem = result.find((r) => r.text.content === 'Code')
    expect(codeItem?.annotations.code).toBe(true)

    const linkItem = result.find((r) => r.text.content === 'Link')
    expect(linkItem?.text.link?.url).toBe('url')
  })

  it('should handle nested/overlapping formatting (as implemented)', () => {
    // The implementation is linear state toggle.
    // "**bold *italic* bold**"
    // "**" -> bold=true
    // "bold " -> bold text
    // "*" -> italic=true
    // "italic" -> bold+italic text
    // "*" -> italic=false
    // " bold" -> bold text
    // "**" -> bold=false

    const input = '**bold *italic* bold**'
    const result = parseRichText(input)

    expect(result).toHaveLength(3)

    // 1. "bold " (bold)
    expect(result[0].text.content).toBe('bold ')
    expect(result[0].annotations.bold).toBe(true)
    expect(result[0].annotations.italic).toBe(false)

    // 2. "italic" (bold + italic)
    expect(result[1].text.content).toBe('italic')
    expect(result[1].annotations.bold).toBe(true)
    expect(result[1].annotations.italic).toBe(true)

    // 3. " bold" (bold)
    expect(result[2].text.content).toBe(' bold')
    expect(result[2].annotations.bold).toBe(true)
    expect(result[2].annotations.italic).toBe(false)
  })

  it('should handle empty string', () => {
    const input = ''
    const result = parseRichText(input)
    // Current implementation: if empty loop -> returns [createRichText(text)] which is empty text
    // Wait, createRichText('') returns a block with empty content.
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('')
  })
})
