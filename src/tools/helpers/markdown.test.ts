import { describe, it, expect } from 'vitest'
import { parseRichText } from './markdown.js' // Note extension for local import

describe('parseRichText', () => {
  it('parses simple text', () => {
    const result = parseRichText('Hello world')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Hello world')
  })

  it('parses bold text', () => {
    const result = parseRichText('**Bold**')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Bold')
    expect(result[0].annotations.bold).toBe(true)
  })

  it('parses italic text', () => {
    const result = parseRichText('*Italic*')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Italic')
    expect(result[0].annotations.italic).toBe(true)
  })

  it('parses code text', () => {
    const result = parseRichText('`Code`')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Code')
    expect(result[0].annotations.code).toBe(true)
  })

  it('parses links', () => {
    const result = parseRichText('[Link](http://example.com)')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Link')
    expect(result[0].text.link?.url).toBe('http://example.com')
  })

  it('parses mixed content', () => {
    const result = parseRichText('Start **bold** and [link](url) end')
    expect(result).toHaveLength(5) // Start, bold, and, link, end
    expect(result[0].text.content).toBe('Start ')
    expect(result[1].text.content).toBe('bold')
    expect(result[1].annotations.bold).toBe(true)
    expect(result[3].text.content).toBe('link')
    expect(result[3].text.link?.url).toBe('url')
  })

  it('handles nested brackets behavior (current implementation)', () => {
    // Current behavior: [ [text](url) ] -> Link(' [text', 'url') + ' ]'
    const result = parseRichText('[ [text](url) ]')
    expect(result[0].text.content).toBe(' [text')
    expect(result[0].text.link?.url).toBe('url')
    // The trailing ' ]' should be next
    // Actually there is ' ' before ']'?
    // [ [text](url) ]
    // i jumps to ) at 12.
    // 13 is ' '. 14 is ']'.
    // So next is ' ]'.
    expect(result[1].text.content).toBe(' ]')
  })

  it('handles broken links', () => {
    const result = parseRichText('[Broken link')
    expect(result[0].text.content).toBe('[Broken link')
  })

  it('handles nested formatting', () => {
    // Note: current parser doesn't support nested formatting inside links or bold inside italic efficiently in all cases
    // but let's check basic nesting if supported
    // The parser is linear/flat state machine.
    // **bold *italic* bold**
    // * triggers italic toggle.
    const result = parseRichText('**bold *italic* bold**')
    // Expect: bold, bold+italic, bold
    expect(result[0].text.content).toBe('bold ')
    expect(result[0].annotations.bold).toBe(true)
    expect(result[1].text.content).toBe('italic')
    expect(result[1].annotations.bold).toBe(true)
    expect(result[1].annotations.italic).toBe(true)
  })

  it('handles worst case input gracefully', () => {
    const input = '['.repeat(100)
    const start = performance.now()
    const result = parseRichText(input)
    const end = performance.now()
    expect(result[0].text.content).toBe(input)
    expect(end - start).toBeLessThan(100) // Should be fast enough even unoptimized for 100 chars
  })
})
