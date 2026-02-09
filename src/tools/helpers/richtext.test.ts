import { describe, expect, it } from 'vitest'
import {
  bold,
  code,
  colored,
  extractPlainText,
  formatText,
  fromStrings,
  isEmpty,
  italic,
  link,
  mergeRichText,
  splitText,
  text,
  truncate
} from './richtext.js'

describe('Rich Text Helpers', () => {
  describe('text', () => {
    it('should create a simple text item', () => {
      const result = text('Hello')
      expect(result).toEqual({
        type: 'text',
        text: { content: 'Hello', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      })
    })
  })

  describe('bold', () => {
    it('should create bold text', () => {
      const result = bold('Hello')
      expect(result.annotations.bold).toBe(true)
      expect(result.text.content).toBe('Hello')
    })
  })

  describe('italic', () => {
    it('should create italic text', () => {
      const result = italic('Hello')
      expect(result.annotations.italic).toBe(true)
    })
  })

  describe('code', () => {
    it('should create code text', () => {
      const result = code('const x = 1')
      expect(result.annotations.code).toBe(true)
    })
  })

  describe('link', () => {
    it('should create link text', () => {
      const result = link('Google', 'https://google.com')
      expect(result.text.link).toEqual({ url: 'https://google.com' })
      expect(result.text.content).toBe('Google')
    })
  })

  describe('colored', () => {
    it('should create colored text', () => {
      const result = colored('Red text', 'red')
      expect(result.annotations.color).toBe('red')
    })
  })

  describe('formatText', () => {
    it('should apply multiple formats', () => {
      const result = formatText('Formatted', { bold: true, color: 'blue', link: 'https://example.com' })
      expect(result.annotations.bold).toBe(true)
      expect(result.annotations.color).toBe('blue')
      expect(result.text.link).toEqual({ url: 'https://example.com' })
    })

    it('should use defaults when options are missing', () => {
      const result = formatText('Simple')
      expect(result.annotations.bold).toBe(false)
      expect(result.annotations.color).toBe('default')
    })
  })

  describe('extractPlainText', () => {
    it('should combine text content from multiple items', () => {
      const items = [text('Hello '), bold('World')]
      expect(extractPlainText(items)).toBe('Hello World')
    })
  })

  describe('splitText', () => {
    it('should return single item if length is within limit', () => {
      const result = splitText('Short text', 100)
      expect(result).toHaveLength(1)
      expect(result[0].text.content).toBe('Short text')
    })

    it('should split long text into chunks', () => {
      const result = splitText('1234567890', 4)
      expect(result).toHaveLength(3) // '1234', '5678', '90'
      expect(result[0].text.content).toBe('1234')
      expect(result[1].text.content).toBe('5678')
      expect(result[2].text.content).toBe('90')
    })
  })

  describe('fromStrings', () => {
    it('should convert array of strings to rich text items', () => {
      const result = fromStrings(['One', 'Two'])
      expect(result).toHaveLength(2)
      expect(result[0].text.content).toBe('One')
      expect(result[1].text.content).toBe('Two')
    })
  })

  describe('isEmpty', () => {
    it('should return true for empty array', () => {
      expect(isEmpty([])).toBe(true)
    })

    it('should return true for array with empty string', () => {
      expect(isEmpty([text('')])).toBe(true)
    })

    it('should return true for whitespace only', () => {
      expect(isEmpty([text('   ')])).toBe(true)
    })

    it('should return false for non-empty text', () => {
      expect(isEmpty([text('Content')])).toBe(false)
    })
  })

  describe('truncate', () => {
    it('should not truncate if within limit', () => {
      const items = [text('Short')]
      const result = truncate(items, 10)
      expect(result).toEqual(items)
    })

    it('should truncate and add ellipsis', () => {
      const items = [text('Long text here')]
      const result = truncate(items, 8)
      expect(result).toHaveLength(1)
      expect(result[0].text.content).toBe('Long ...') // "Long " is 5 chars. "..." is 3. Total 8.
    })
  })

  describe('mergeRichText', () => {
    it('should merge individual rich text items', () => {
      const item1 = text('Hello')
      const item2 = text('World')
      const result = mergeRichText(item1, item2)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(item1)
      expect(result[1]).toEqual(item2)
    })

    it('should flatten arrays of rich text items', () => {
      const item1 = text('Hello')
      const item2 = text('World')
      const result = mergeRichText([item1], [item2])
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(item1)
      expect(result[1]).toEqual(item2)
    })

    it('should handle mixed inputs', () => {
      const item1 = text('Hello')
      const item2 = text('World')
      const result = mergeRichText(item1, [item2])
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(item1)
      expect(result[1]).toEqual(item2)
    })
  })
})
