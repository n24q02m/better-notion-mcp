import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, markdownToBlocks, parseRichText } from './markdown.js'

describe('Markdown Helper', () => {
  describe('parseRichText', () => {
    it('should parse plain text', () => {
      const result = parseRichText('Hello world')
      expect(result).toHaveLength(1)
      expect(result[0].text.content).toBe('Hello world')
      expect(result[0].annotations.bold).toBe(false)
    })

    it('should parse bold text', () => {
      const result = parseRichText('**Bold**')
      expect(result).toHaveLength(1)
      expect(result[0].text.content).toBe('Bold')
      expect(result[0].annotations.bold).toBe(true)
    })

    it('should parse italic text', () => {
      const result = parseRichText('*Italic*')
      expect(result).toHaveLength(1)
      expect(result[0].text.content).toBe('Italic')
      expect(result[0].annotations.italic).toBe(true)
    })

    it('should parse link', () => {
      const result = parseRichText('[Link](https://example.com)')
      expect(result).toHaveLength(1)
      expect(result[0].text.content).toBe('Link')
      expect(result[0].text.link?.url).toBe('https://example.com')
    })
  })

  describe('markdownToBlocks', () => {
    it('should convert heading', () => {
      const blocks = markdownToBlocks('# Heading 1')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('heading_1')
      expect(blocks[0].heading_1.rich_text[0].text.content).toBe('Heading 1')
    })

    it('should convert paragraph', () => {
      const blocks = markdownToBlocks('Paragraph text')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('paragraph')
      expect(blocks[0].paragraph.rich_text[0].text.content).toBe('Paragraph text')
    })

    it('should convert bulleted list', () => {
      const blocks = markdownToBlocks('- Item 1\n- Item 2')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('bulleted_list_item')
      expect(blocks[1].type).toBe('bulleted_list_item')
    })
  })

  describe('blocksToMarkdown', () => {
    it('should convert blocks to markdown', () => {
      const blocks: any[] = [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: 'Heading' }, annotations: {} }]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: 'Paragraph' }, annotations: {} }]
          }
        }
      ]

      const markdown = blocksToMarkdown(blocks)
      expect(markdown).toContain('# Heading')
      expect(markdown).toContain('Paragraph')
    })
  })
})
