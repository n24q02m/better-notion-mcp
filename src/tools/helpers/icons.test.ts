import { describe, expect, it } from 'vitest'
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
})
