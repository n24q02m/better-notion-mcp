import { describe, expect, it } from 'vitest'
import { parseRichText } from './markdown.js'

describe('parseRichText', () => {
  it('parses plain text correctly', () => {
    const input = 'Hello world'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Hello world')
    expect(result[0].annotations.bold).toBe(false)
    expect(result[0].annotations.italic).toBe(false)
    expect(result[0].annotations.code).toBe(false)
    expect(result[0].annotations.strikethrough).toBe(false)
  })

  it('parses bold text (**)', () => {
    const input = '**Bold text**'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Bold text')
    expect(result[0].annotations.bold).toBe(true)
  })

  it('parses italic text (*)', () => {
    const input = '*Italic text*'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Italic text')
    expect(result[0].annotations.italic).toBe(true)
  })

  it('parses inline code (`)', () => {
    const input = '`Code text`'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Code text')
    expect(result[0].annotations.code).toBe(true)
  })

  it('parses strikethrough (~~)', () => {
    const input = '~~Strikethrough text~~'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Strikethrough text')
    expect(result[0].annotations.strikethrough).toBe(true)
  })

  it('parses mixed formatting correctly', () => {
    const input = 'Start **bold** middle *italic* end'
    const result = parseRichText(input)
    expect(result).toHaveLength(5)

    expect(result[0].text.content).toBe('Start ')
    expect(result[0].annotations.bold).toBe(false)

    expect(result[1].text.content).toBe('bold')
    expect(result[1].annotations.bold).toBe(true)

    expect(result[2].text.content).toBe(' middle ')
    expect(result[2].annotations.bold).toBe(false)
    expect(result[2].annotations.italic).toBe(false)

    expect(result[3].text.content).toBe('italic')
    expect(result[3].annotations.italic).toBe(true)

    expect(result[4].text.content).toBe(' end')
    expect(result[4].annotations.italic).toBe(false)
  })

  it('parses links [text](url)', () => {
    const input = '[Google](https://google.com)'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Google')
    expect(result[0].text.link).toEqual({ url: 'https://google.com' })
  })

  it('parses links with surrounding text', () => {
    const input = 'Click [here](https://example.com) now'
    const result = parseRichText(input)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Click ')
    expect(result[1].text.content).toBe('here')
    expect(result[1].text.link).toEqual({ url: 'https://example.com' })
    expect(result[2].text.content).toBe(' now')
  })

  it('handles empty strings', () => {
    const input = ''
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('')
  })

  it('handles unclosed tags gracefully (treats as formatted)', () => {
    const input = '**Unclosed bold'
    const result = parseRichText(input)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Unclosed bold')
    expect(result[0].annotations.bold).toBe(true)
  })

  it('handles nested formatting (naive implementation)', () => {
    const input = '**bold *italic***'
    const result = parseRichText(input)
    // Expect: [bold "bold ", bold+italic "italic"]
    // Note: The loop finishes 'bold ' when it sees '*', then toggles italic.
    // So current="" -> push 'bold ' (bold=T, italic=F)
    // Italic toggles T.
    // 'italic' accumulated.
    // '*' seen. current='italic' -> push 'italic' (bold=T, italic=T). Italic toggles F.
    // '**' seen. bold toggles F.
    // End.

    expect(result).toHaveLength(2)
    expect(result[0].text.content).toBe('bold ')
    expect(result[0].annotations.bold).toBe(true)
    expect(result[0].annotations.italic).toBe(false)

    expect(result[1].text.content).toBe('italic')
    expect(result[1].annotations.bold).toBe(true)
    expect(result[1].annotations.italic).toBe(true)
  })

  it('handles broken link syntax gracefully', () => {
    const input = '[Broken link(no paren)'
    const result = parseRichText(input)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].text.content).toContain('[Broken link')
    expect(result[0].text.link).toBeNull()
  })
})
