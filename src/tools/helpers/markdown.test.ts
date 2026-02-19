import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, extractPlainText, markdownToBlocks } from './markdown'

describe('Markdown Helper', () => {
  describe('markdownToBlocks', () => {
    it('should convert paragraphs', () => {
      const markdown = 'This is a paragraph.'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('paragraph')
      expect(blocks[0].paragraph.rich_text[0].text.content).toBe('This is a paragraph.')
    })

    it('should convert headings', () => {
      const markdown =
        '# Heading 1\n## Heading 2\n### Heading 3'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(3)
      expect(blocks[0].type).toBe('heading_1')
      expect(blocks[0].heading_1.rich_text[0].text.content).toBe('Heading 1')
      expect(blocks[1].type).toBe('heading_2')
      expect(blocks[1].heading_2.rich_text[0].text.content).toBe('Heading 2')
      expect(blocks[2].type).toBe('heading_3')
      expect(blocks[2].heading_3.rich_text[0].text.content).toBe('Heading 3')
    })

    it('should convert quotes', () => {
      const markdown = '> This is a quote'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('quote')
      expect(blocks[0].quote.rich_text[0].text.content).toBe('This is a quote')
    })

    it('should convert dividers', () => {
      const markdown = '---'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('divider')
    })

    it('should handle multiple empty lines', () => {
      const markdown = 'Paragraph 1\n\n\nParagraph 2'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('paragraph')
      expect(blocks[1].type).toBe('paragraph')
    })

    it('should convert bulleted lists', () => {
      const markdown = '- Item 1\n* Item 2\n- Item 3'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(3)
      expect(blocks[0].type).toBe('bulleted_list_item')
      expect(blocks[0].bulleted_list_item.rich_text[0].text.content).toBe('Item 1')
      expect(blocks[1].type).toBe('bulleted_list_item')
      expect(blocks[1].bulleted_list_item.rich_text[0].text.content).toBe('Item 2')
    })

    it('should convert numbered lists', () => {
      const markdown = '1. First\n2. Second'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('numbered_list_item')
      expect(blocks[0].numbered_list_item.rich_text[0].text.content).toBe('First')
      expect(blocks[1].type).toBe('numbered_list_item')
      expect(blocks[1].numbered_list_item.rich_text[0].text.content).toBe('Second')
    })

    it('should convert code blocks', () => {
      const markdown = '```typescript\nconst x = 1;\nconsole.log(x);\n```'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('code')
      expect(blocks[0].code.language).toBe('typescript')
      expect(blocks[0].code.rich_text[0].text.content).toBe('const x = 1;\nconsole.log(x);')
    })

    it('should convert code blocks without language', () => {
      const markdown = '```\nplain text code\n```'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('code')
      expect(blocks[0].code.language).toBe('plain text')
      expect(blocks[0].code.rich_text[0].text.content).toBe('plain text code')
    })

    it('should parse rich text (bold, italic, code, strikethrough)', () => {
      const markdown = 'This is **bold**, *italic*, `code`, and ~~strikethrough~~.'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(1)
      const richText = blocks[0].paragraph.rich_text

      // "This is "
      expect(richText[0].text.content).toBe('This is ')
      expect(richText[0].annotations.bold).toBe(false)

      // "**bold**"
      expect(richText[1].text.content).toBe('bold')
      expect(richText[1].annotations.bold).toBe(true)

      // ", "
      expect(richText[2].text.content).toBe(', ')
      expect(richText[2].annotations.bold).toBe(false)

      // "*italic*"
      expect(richText[3].text.content).toBe('italic')
      expect(richText[3].annotations.italic).toBe(true)

      // ", "
      expect(richText[4].text.content).toBe(', ')

      // "`code`"
      expect(richText[5].text.content).toBe('code')
      expect(richText[5].annotations.code).toBe(true)

      // ", and "
      expect(richText[6].text.content).toBe(', and ')

      // "~~strikethrough~~"
      expect(richText[7].text.content).toBe('strikethrough')
      expect(richText[7].annotations.strikethrough).toBe(true)

      // "."
      expect(richText[8].text.content).toBe('.')
    })

    it('should parse links', () => {
      const markdown = 'Click [here](https://example.com) for more info.'
      const blocks = markdownToBlocks(markdown)
      expect(blocks).toHaveLength(1)
      const richText = blocks[0].paragraph.rich_text

      expect(richText[0].text.content).toBe('Click ')

      expect(richText[1].text.content).toBe('here')
      expect(richText[1].text.link?.url).toBe('https://example.com')

      expect(richText[2].text.content).toBe(' for more info.')
    })

    it('should perform round trip conversion', () => {
      const markdown =
        '# Heading\n\nParagraph with **bold** and *italic*.\n\n- List item 1\n- List item 2\n\n> Quote block\n\n---\n\n```javascript\nconsole.log("code");\n```'
      const blocks = markdownToBlocks(markdown)
      const convertedMarkdown = blocksToMarkdown(blocks)

      // Note: The round trip might not be byte-identical due to normalization (e.g. whitespace)
      // but the structure should be preserved.
      const roundTripBlocks = markdownToBlocks(convertedMarkdown)

      expect(roundTripBlocks).toHaveLength(blocks.length)
      expect(roundTripBlocks[0].type).toBe(blocks[0].type) // Heading
      expect(roundTripBlocks[1].type).toBe(blocks[1].type) // Paragraph
      expect(roundTripBlocks[2].type).toBe(blocks[2].type) // List item 1
      expect(roundTripBlocks[3].type).toBe(blocks[3].type) // List item 2
      expect(roundTripBlocks[4].type).toBe(blocks[4].type) // Quote
      expect(roundTripBlocks[5].type).toBe(blocks[5].type) // Divider
      expect(roundTripBlocks[6].type).toBe(blocks[6].type) // Code
    })
  })

  describe('extractPlainText', () => {
    it('should extract plain text from rich text', () => {
      const markdown = 'Text with **bold** and [link](url)'
      const blocks = markdownToBlocks(markdown)
      const richText = blocks[0].paragraph.rich_text
      const plainText = extractPlainText(richText)
      expect(plainText).toBe('Text with bold and link')
    })
  })
})
