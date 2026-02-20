import { describe, expect, it } from 'vitest'
import * as RichText from './richtext'

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: 'default'
}

describe('text', () => {
  it('should create a simple rich text item', () => {
    const result = RichText.text('hello')
    expect(result).toEqual({
      type: 'text',
      text: { content: 'hello', link: null },
      annotations: DEFAULT_ANNOTATIONS
    })
  })

  it('should handle empty string', () => {
    const result = RichText.text('')
    expect(result.text.content).toBe('')
    expect(result.annotations).toEqual(DEFAULT_ANNOTATIONS)
  })
})

describe('bold', () => {
  it('should create bold text', () => {
    const result = RichText.bold('strong')
    expect(result.type).toBe('text')
    expect(result.text.content).toBe('strong')
    expect(result.annotations.bold).toBe(true)
    expect(result.annotations.italic).toBe(false)
    expect(result.annotations.code).toBe(false)
  })

  it('should handle empty string', () => {
    const result = RichText.bold('')
    expect(result.text.content).toBe('')
    expect(result.annotations.bold).toBe(true)
  })
})

describe('italic', () => {
  it('should create italic text', () => {
    const result = RichText.italic('emphasis')
    expect(result.type).toBe('text')
    expect(result.text.content).toBe('emphasis')
    expect(result.annotations.italic).toBe(true)
    expect(result.annotations.bold).toBe(false)
    expect(result.annotations.code).toBe(false)
  })

  it('should handle empty string', () => {
    const result = RichText.italic('')
    expect(result.text.content).toBe('')
    expect(result.annotations.italic).toBe(true)
  })
})

describe('code', () => {
  it('should create code text', () => {
    const result = RichText.code('const x = 1')
    expect(result.type).toBe('text')
    expect(result.text.content).toBe('const x = 1')
    expect(result.annotations.code).toBe(true)
    expect(result.annotations.bold).toBe(false)
    expect(result.annotations.italic).toBe(false)
  })

  it('should handle empty string', () => {
    const result = RichText.code('')
    expect(result.text.content).toBe('')
    expect(result.annotations.code).toBe(true)
  })
})

describe('link', () => {
  it('should create text with a link', () => {
    const result = RichText.link('click here', 'https://example.com')
    expect(result).toEqual({
      type: 'text',
      text: { content: 'click here', link: { url: 'https://example.com' } },
      annotations: DEFAULT_ANNOTATIONS
    })
  })

  it('should handle empty content with link', () => {
    const result = RichText.link('', 'https://example.com')
    expect(result.text.content).toBe('')
    expect(result.text.link).toEqual({ url: 'https://example.com' })
  })
})

describe('colored', () => {
  it('should create colored text', () => {
    const result = RichText.colored('warning', 'red')
    expect(result.type).toBe('text')
    expect(result.text.content).toBe('warning')
    expect(result.annotations.color).toBe('red')
    expect(result.annotations.bold).toBe(false)
  })

  it('should handle default color', () => {
    const result = RichText.colored('normal', 'default')
    expect(result.annotations.color).toBe('default')
  })

  it('should accept all valid color values', () => {
    const colors: RichText.Color[] = [
      'default',
      'gray',
      'brown',
      'orange',
      'yellow',
      'green',
      'blue',
      'purple',
      'pink',
      'red'
    ]
    for (const color of colors) {
      const result = RichText.colored('test', color)
      expect(result.annotations.color).toBe(color)
    }
  })
})

describe('formatText', () => {
  it('should create text with no options (defaults)', () => {
    const result = RichText.formatText('plain')
    expect(result).toEqual({
      type: 'text',
      text: { content: 'plain', link: null },
      annotations: DEFAULT_ANNOTATIONS
    })
  })

  it('should apply bold option', () => {
    const result = RichText.formatText('test', { bold: true })
    expect(result.annotations.bold).toBe(true)
    expect(result.annotations.italic).toBe(false)
  })

  it('should apply italic option', () => {
    const result = RichText.formatText('test', { italic: true })
    expect(result.annotations.italic).toBe(true)
  })

  it('should apply code option', () => {
    const result = RichText.formatText('test', { code: true })
    expect(result.annotations.code).toBe(true)
  })

  it('should apply strikethrough option', () => {
    const result = RichText.formatText('test', { strikethrough: true })
    expect(result.annotations.strikethrough).toBe(true)
  })

  it('should apply underline option', () => {
    const result = RichText.formatText('test', { underline: true })
    expect(result.annotations.underline).toBe(true)
  })

  it('should apply color option', () => {
    const result = RichText.formatText('test', { color: 'blue' })
    expect(result.annotations.color).toBe('blue')
  })

  it('should apply link option', () => {
    const result = RichText.formatText('test', { link: 'https://example.com' })
    expect(result.text.link).toEqual({ url: 'https://example.com' })
  })

  it('should apply all options at once', () => {
    const result = RichText.formatText('styled', {
      bold: true,
      italic: true,
      code: true,
      strikethrough: true,
      underline: true,
      color: 'purple',
      link: 'https://example.com'
    })
    expect(result).toEqual({
      type: 'text',
      text: { content: 'styled', link: { url: 'https://example.com' } },
      annotations: {
        bold: true,
        italic: true,
        strikethrough: true,
        underline: true,
        code: true,
        color: 'purple'
      }
    })
  })

  it('should handle empty string content', () => {
    const result = RichText.formatText('')
    expect(result.text.content).toBe('')
  })
})

describe('extractPlainText', () => {
  it('should join text content from multiple items', () => {
    const items = [RichText.text('hello '), RichText.bold('world')]
    expect(RichText.extractPlainText(items)).toBe('hello world')
  })

  it('should return empty string for empty array', () => {
    expect(RichText.extractPlainText([])).toBe('')
  })

  it('should return content from a single item', () => {
    expect(RichText.extractPlainText([RichText.text('solo')])).toBe('solo')
  })

  it('should handle items with empty content', () => {
    const items = [RichText.text(''), RichText.text('after')]
    expect(RichText.extractPlainText(items)).toBe('after')
  })
})

describe('splitText', () => {
  it('should return single item when content is shorter than maxLength', () => {
    const result = RichText.splitText('short', 2000)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('short')
  })

  it('should return single item when content equals maxLength', () => {
    const content = 'a'.repeat(2000)
    const result = RichText.splitText(content, 2000)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe(content)
  })

  it('should split content exceeding maxLength into multiple chunks', () => {
    const content = 'a'.repeat(5000)
    const result = RichText.splitText(content, 2000)
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('a'.repeat(2000))
    expect(result[1].text.content).toBe('a'.repeat(2000))
    expect(result[2].text.content).toBe('a'.repeat(1000))
  })

  it('should use default maxLength of 2000', () => {
    const content = 'b'.repeat(4000)
    const result = RichText.splitText(content)
    expect(result).toHaveLength(2)
    expect(result[0].text.content.length).toBe(2000)
    expect(result[1].text.content.length).toBe(2000)
  })

  it('should handle custom maxLength', () => {
    const result = RichText.splitText('abcdef', 3)
    expect(result).toHaveLength(2)
    expect(result[0].text.content).toBe('abc')
    expect(result[1].text.content).toBe('def')
  })

  it('should handle empty string', () => {
    const result = RichText.splitText('')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('')
  })

  it('should produce valid RichTextItem for each chunk', () => {
    const result = RichText.splitText('a'.repeat(3000), 2000)
    for (const item of result) {
      expect(item.type).toBe('text')
      expect(item.annotations).toEqual(DEFAULT_ANNOTATIONS)
    }
  })
})

describe('mergeRichText', () => {
  it('should merge multiple items into a single array', () => {
    const a = RichText.text('hello ')
    const b = RichText.bold('world')
    const result = RichText.mergeRichText(a, b)
    expect(result).toHaveLength(2)
    expect(result[0].text.content).toBe('hello ')
    expect(result[1].text.content).toBe('world')
    expect(result[1].annotations.bold).toBe(true)
  })

  it('should return empty array when called with no arguments', () => {
    const result = RichText.mergeRichText()
    expect(result).toEqual([])
  })

  it('should handle a single item', () => {
    const item = RichText.italic('alone')
    const result = RichText.mergeRichText(item)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('alone')
  })

  it('should preserve annotations of each item', () => {
    const result = RichText.mergeRichText(RichText.bold('b'), RichText.italic('i'), RichText.code('c'))
    expect(result[0].annotations.bold).toBe(true)
    expect(result[1].annotations.italic).toBe(true)
    expect(result[2].annotations.code).toBe(true)
  })
})

describe('fromStrings', () => {
  it('should convert string array to rich text items', () => {
    const result = RichText.fromStrings(['hello', 'world'])
    expect(result).toHaveLength(2)
    expect(result[0].text.content).toBe('hello')
    expect(result[1].text.content).toBe('world')
    for (const item of result) {
      expect(item.type).toBe('text')
      expect(item.annotations).toEqual(DEFAULT_ANNOTATIONS)
    }
  })

  it('should return empty array for empty input', () => {
    expect(RichText.fromStrings([])).toEqual([])
  })

  it('should handle strings with empty values', () => {
    const result = RichText.fromStrings(['', 'text', ''])
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('')
    expect(result[1].text.content).toBe('text')
    expect(result[2].text.content).toBe('')
  })
})

describe('isEmpty', () => {
  it('should return true for empty array', () => {
    expect(RichText.isEmpty([])).toBe(true)
  })

  it('should return true for array with whitespace-only items', () => {
    expect(RichText.isEmpty([RichText.text('   ')])).toBe(true)
    expect(RichText.isEmpty([RichText.text('\t\n')])).toBe(true)
  })

  it('should return true for array with empty string items', () => {
    expect(RichText.isEmpty([RichText.text('')])).toBe(true)
  })

  it('should return true for multiple whitespace-only items', () => {
    expect(RichText.isEmpty([RichText.text('  '), RichText.text('\n')])).toBe(true)
  })

  it('should return false for non-empty content', () => {
    expect(RichText.isEmpty([RichText.text('hello')])).toBe(false)
  })

  it('should return false when any item has content', () => {
    expect(RichText.isEmpty([RichText.text(''), RichText.text('a')])).toBe(false)
  })
})

describe('truncate', () => {
  it('should return original items when text is shorter than maxLength', () => {
    const items = [RichText.text('short')]
    const result = RichText.truncate(items, 100)
    expect(result).toBe(items)
  })

  it('should return original items when text equals maxLength', () => {
    const items = [RichText.text('12345')]
    const result = RichText.truncate(items, 5)
    expect(result).toBe(items)
  })

  it('should truncate and append ellipsis when text exceeds maxLength', () => {
    const items = [RichText.text('hello world')]
    const result = RichText.truncate(items, 8)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('hello...')
  })

  it('should account for ellipsis length in truncation', () => {
    const items = [RichText.text('abcdefghij')]
    const result = RichText.truncate(items, 7)
    expect(result[0].text.content).toBe('abcd...')
    expect(result[0].text.content.length).toBe(7)
  })

  it('should handle multi-item rich text by joining then truncating', () => {
    const items = [RichText.bold('hello '), RichText.italic('world')]
    const result = RichText.truncate(items, 8)
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('hello...')
    expect(result[0].annotations).toEqual(DEFAULT_ANNOTATIONS)
  })

  it('should handle truncation to minimum viable length', () => {
    const items = [RichText.text('abcdef')]
    const result = RichText.truncate(items, 4)
    expect(result[0].text.content).toBe('a...')
  })
})
