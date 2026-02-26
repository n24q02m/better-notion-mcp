import { describe, expect, it } from 'vitest'
import { markdownToBlocks, parseRichText } from './markdown'

describe('Security: Markdown Parsing Vulnerabilities', () => {
  describe('Unsafe URL handling', () => {
    it('should sanitize javascript: links in rich text', () => {
      const result = parseRichText('[Click me](javascript:alert(1))')
      // Correct behavior: URL is unsafe, so it should be stripped or null
      expect(result[0].text.link).toBeNull()
      expect(result[0].text.content).toBe('Click me')
    })

    it('should sanitize javascript: in image src', () => {
      const blocks = markdownToBlocks('![alt](javascript:alert(1))')
      // Correct behavior: should not be an image block, or image block with empty/safe URL
      // The implementation falls through to paragraph if unsafe
      expect(blocks[0].type).toBe('paragraph')
      // It renders as plain text "!" followed by "alt" because the unsafe link is stripped
      expect(blocks[0].paragraph.rich_text[0].text.content).toBe('!')
      expect(blocks[0].paragraph.rich_text[1].text.content).toBe('alt')
    })

    it('should sanitize javascript: in bookmarks', () => {
      const blocks = markdownToBlocks('[bookmark](javascript:void(0))')
      // Correct behavior: fall through to paragraph
      expect(blocks[0].type).toBe('paragraph')
      // Renders as plain text "bookmark" because link is stripped
      expect(blocks[0].paragraph.rich_text[0].text.content).toBe('bookmark')
    })

    it('should sanitize javascript: in embeds', () => {
      const blocks = markdownToBlocks('[embed](javascript:confirm(1))')
      // Correct behavior: fall through to paragraph
      expect(blocks[0].type).toBe('paragraph')
      // Renders as plain text "embed" because link is stripped
      expect(blocks[0].paragraph.rich_text[0].text.content).toBe('embed')
    })

    it('should sanitize data: URLs', () => {
      const result = parseRichText('[link](data:text/html,<script>alert(1)</script>)')
      // Correct behavior: URL stripped
      expect(result[0].text.link).toBeNull()
      expect(result[0].text.content).toBe('link')
    })

    it('should sanitize vbscript: URLs', () => {
      const result = parseRichText('[link](vbscript:msgbox(1))')
      // Correct behavior: URL stripped
      expect(result[0].text.link).toBeNull()
    })

    it('should allow safe http/https/mailto URLs', () => {
      const result = parseRichText('[link](https://example.com)')
      expect(result[0].text.link?.url).toBe('https://example.com')

      const blocks = markdownToBlocks('![alt](https://example.com/img.png)')
      expect(blocks[0].type).toBe('image')
      expect(blocks[0].image.external.url).toBe('https://example.com/img.png')
    })
  })
})
