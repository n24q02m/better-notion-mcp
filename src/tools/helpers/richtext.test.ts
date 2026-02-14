import { describe, expect, it } from 'vitest'
import { extractPlainText, splitText, text, truncate } from './richtext.js'

describe('RichText Helper', () => {
  describe('text', () => {
    it('should create text object', () => {
      const result = text('Hello')
      expect(result.type).toBe('text')
      expect(result.text.content).toBe('Hello')
      expect(result.annotations.bold).toBe(false)
    })
  })

  describe('extractPlainText', () => {
    it('should extract text from array', () => {
      const items = [text('Hello'), text(' '), text('World')]
      expect(extractPlainText(items)).toBe('Hello World')
    })
  })

  describe('splitText', () => {
    it('should return single item if short enough', () => {
      const result = splitText('Hello', 10)
      expect(result).toHaveLength(1)
      expect(result[0].text.content).toBe('Hello')
    })

    it('should split long text', () => {
      const result = splitText('HelloWorld', 5)
      expect(result).toHaveLength(2)
      expect(result[0].text.content).toBe('Hello')
      expect(result[1].text.content).toBe('World')
    })
  })

  describe('truncate', () => {
    it('should not truncate if short enough', () => {
      const items = [text('Hello')]
      const result = truncate(items, 10)
      expect(extractPlainText(result)).toBe('Hello')
    })

    it('should truncate and add ellipsis', () => {
      const items = [text('Hello World')]
      const result = truncate(items, 5)
      expect(extractPlainText(result)).toBe('He...')
    })
  })
})
