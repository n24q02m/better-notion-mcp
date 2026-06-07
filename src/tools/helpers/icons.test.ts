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

    it('wraps a complex URL with query parameters', () => {
      const url = 'https://example.com/path?query=val#hash'
      expect(formatIcon(url)).toEqual({
        type: 'external',
        external: { url }
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

    it('expands with orange color', () => {
      expect(formatIcon('fire:orange')).toEqual({
        type: 'external',
        external: { url: 'https://www.notion.so/icons/fire_orange.svg' }
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
      expect(() => formatIcon('')).toThrow(/Icon value cannot be empty/)
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

    it('rejects http URLs with whitespace', () => {
      expect(() => formatIcon('https://example.com/icon .png')).toThrow(NotionMCPError)
    })
  })

  describe('edge cases', () => {
    it('does not treat a leading colon as shorthand', () => {
      // ':blue' has colonIdx 0, which is < 1, so it falls through to emoji
      // then isSafeUrl(':blue') returns false because it's a relative URL with a colon
      expect(() => formatIcon(':blue')).toThrow(NotionMCPError)
    })

    it('treats a plain string as emoji', () => {
      expect(formatIcon('star')).toEqual({ type: 'emoji', emoji: 'star' })
    })
  })
})
