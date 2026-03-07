import { describe, expect, it } from 'vitest'
import { NotionMCPError } from './errors'
import { formatIcon } from './icons'

describe('formatIcon', () => {
  describe('emoji icons', () => {
    it('wraps a single emoji as emoji type', () => {
      expect(formatIcon('🚀')).toEqual({ type: 'emoji', emoji: '🚀' })
    })

    it('wraps a flag emoji as emoji type', () => {
      expect(formatIcon('🇩🇪')).toEqual({ type: 'emoji', emoji: '🇩🇪' })
    })

    it('wraps a simple text emoji', () => {
      expect(formatIcon('📋')).toEqual({ type: 'emoji', emoji: '📋' })
    })
  })

  describe('external URL icons', () => {
    it('wraps an https URL as external type', () => {
      expect(formatIcon('https://example.com/logo.png')).toEqual({
        type: 'external',
        external: { url: 'https://example.com/logo.png' }
      })
    })

    it('wraps an http URL as external type', () => {
      expect(formatIcon('http://example.com/icon.svg')).toEqual({
        type: 'external',
        external: { url: 'http://example.com/icon.svg' }
      })
    })
  })

  describe('Notion built-in icon shorthand', () => {
    it('expands name:color to Notion icon URL', () => {
      expect(formatIcon('document:gray')).toEqual({
        type: 'external',
        external: { url: 'https://www.notion.so/icons/document_gray.svg' }
      })
    })

    it('expands with different colors', () => {
      expect(formatIcon('helm:blue')).toEqual({
        type: 'external',
        external: { url: 'https://www.notion.so/icons/helm_blue.svg' }
      })
    })

    it('expands lightgray color', () => {
      expect(formatIcon('star:lightgray')).toEqual({
        type: 'external',
        external: { url: 'https://www.notion.so/icons/star_lightgray.svg' }
      })
    })

    it('does not treat a colon in a URL as icon shorthand', () => {
      expect(formatIcon('https://example.com/icon:blue.svg')).toEqual({
        type: 'external',
        external: { url: 'https://example.com/icon:blue.svg' }
      })
    })
  })

  describe('invalid color shorthand', () => {
    it('rejects invalid color as unsafe URL scheme', () => {
      // 'magenta' is not a valid Notion color, so 'document:magenta' is not
      // recognized as shorthand. It then parses as a URL with 'document:' scheme,
      // which is not in the safe protocol list, so it throws NotionMCPError.
      expect(() => formatIcon('document:magenta')).toThrow(NotionMCPError)
    })
  })

  describe('empty string input', () => {
    it('throws NotionMCPError for empty string', () => {
      expect(() => formatIcon('')).toThrow(NotionMCPError)
    })
  })

  describe('unsafe URL rejection', () => {
    it('rejects javascript: URLs', () => {
      expect(() => formatIcon('javascript:alert(1)')).toThrow(NotionMCPError)
    })

    it('rejects data: URLs', () => {
      expect(() => formatIcon('data:text/html,<script>alert(1)</script>')).toThrow(NotionMCPError)
    })

    it('rejects vbscript: URLs', () => {
      expect(() => formatIcon('vbscript:msgbox(1)')).toThrow(NotionMCPError)
    })
  })
})
