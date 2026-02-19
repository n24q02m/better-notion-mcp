import { describe, expect, it } from 'vitest'
import { parseRichText } from './markdown'

describe('parseRichText', () => {
  it('parses plain text', () => {
    const text = 'Hello world'
    const result = parseRichText(text)
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'Hello world', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ])
  })

  it('parses bold text', () => {
    const text = '**Bold**'
    const result = parseRichText(text)
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'Bold', link: null },
        annotations: {
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ])
  })

  it('parses italic text', () => {
    const text = '*Italic*'
    const result = parseRichText(text)
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'Italic', link: null },
        annotations: {
          bold: false,
          italic: true,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ])
  })

  it('parses code', () => {
    const text = '`code`'
    const result = parseRichText(text)
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'code', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: true,
          color: 'default'
        }
      }
    ])
  })

  it('parses strikethrough', () => {
    const text = '~~strikethrough~~'
    const result = parseRichText(text)
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'strikethrough', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: true,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ])
  })

  it('parses simple link', () => {
    const text = '[link](url)'
    const result = parseRichText(text)
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'link', link: { url: 'url' } },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ])
  })

  it('parses link with text around it', () => {
    const text = 'prefix [link](url) suffix'
    const result = parseRichText(text)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('prefix ')
    expect(result[1].text.content).toBe('link')
    expect(result[1].text.link?.url).toBe('url')
    expect(result[2].text.content).toBe(' suffix')
  })

  it('parses nested brackets in link text', () => {
    const text = '[ [link](url)'
    const result = parseRichText(text)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe(' [link')
    expect(result[0].text.link?.url).toBe('url')
  })

  it('handles invalid link structure (missing parenthesis)', () => {
    const text = '[link] url'
    const result = parseRichText(text)
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: '[link] url', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ])
  })

  it('handles brackets not followed by parenthesis immediately', () => {
    const text = '[link] (url)' // Space between ] and (
    const result = parseRichText(text)
    expect(result[0].text.content).toBe('[link] (url)')
    expect(result[0].text.link).toBeNull()
  })

  it('handles nested structures correctly', () => {
    // [ a [ b ](url)
    // Should parse as link text " a [ b " with url "url"
    const text = '[ a [ b ](url)'
    const result = parseRichText(text)
    expect(result[0].text.content).toBe(' a [ b ')
    expect(result[0].text.link?.url).toBe('url')
  })

  it('handles multiple links', () => {
    const text = '[link1](url1) and [link2](url2)'
    const result = parseRichText(text)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('link1')
    expect(result[0].text.link?.url).toBe('url1')
    expect(result[1].text.content).toBe(' and ')
    expect(result[2].text.content).toBe('link2')
    expect(result[2].text.link?.url).toBe('url2')
  })

  it('handles formatting inside link text', () => {
    // Note: current parser might not support formatting inside link text because it treats link text as raw slice?
    // Let's check implementation.
    // const linkText = text.slice(i + 1, nextCloseBracket)
    // parseRichText is not recursive here. It returns linkText as content.
    // So **bold** inside link text is treated as literal **bold**.
    const text = '[**bold**](url)'
    const result = parseRichText(text)
    expect(result[0].text.content).toBe('**bold**')
  })
})
