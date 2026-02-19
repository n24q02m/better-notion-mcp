import { describe, expect, it } from 'vitest'
import { markdownToBlocks, type RichText } from './markdown.js'

describe('markdownToBlocks', () => {
  it('should convert paragraphs', () => {
    const markdown = 'Hello world\n\nThis is a paragraph.'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('paragraph')
    expect(blocks[0].paragraph.rich_text[0].text.content).toBe('Hello world')
    expect(blocks[1].type).toBe('paragraph')
    expect(blocks[1].paragraph.rich_text[0].text.content).toBe('This is a paragraph.')
  })

  it('should convert headings', () => {
    const markdown = '# Heading 1\n## Heading 2\n### Heading 3'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('heading_1')
    expect(blocks[0].heading_1.rich_text[0].text.content).toBe('Heading 1')
    expect(blocks[1].type).toBe('heading_2')
    expect(blocks[1].heading_2.rich_text[0].text.content).toBe('Heading 2')
    expect(blocks[2].type).toBe('heading_3')
    expect(blocks[2].heading_3.rich_text[0].text.content).toBe('Heading 3')
  })

  it('should convert lists', () => {
    const markdown = '- Item 1\n- Item 2\n1. Numbered 1\n2. Numbered 2'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(4)
    expect(blocks[0].type).toBe('bulleted_list_item')
    expect(blocks[0].bulleted_list_item.rich_text[0].text.content).toBe('Item 1')
    expect(blocks[1].type).toBe('bulleted_list_item')
    expect(blocks[2].type).toBe('numbered_list_item')
    expect(blocks[2].numbered_list_item.rich_text[0].text.content).toBe('Numbered 1')
  })

  it('should convert code blocks', () => {
    const markdown = '```javascript\nconsole.log("hello")\nreturn true\n```'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('code')
    expect(blocks[0].code.language).toBe('javascript')
    expect(blocks[0].code.rich_text[0].text.content).toBe('console.log("hello")\nreturn true')
  })

  it('should handle code blocks with no language', () => {
    const markdown = '```\nplain text\n```'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('code')
    expect(blocks[0].code.language).toBe('plain text')
    expect(blocks[0].code.rich_text[0].text.content).toBe('plain text')
  })

  it('should handle code blocks at end of file without newline', () => {
    const markdown = '```typescript\nconst x = 1\n```'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('code')
    expect(blocks[0].code.rich_text[0].text.content).toBe('const x = 1')
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

  it('should parse rich text', () => {
    const markdown = '**Bold** *Italic* `Code` ~~Strike~~ [Link](https://example.com)'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    const richText = blocks[0].paragraph.rich_text as RichText[]

    const boldItem = richText.find((rt) => rt.annotations.bold)
    expect(boldItem).toBeDefined()
    expect(boldItem!.text.content).toBe('Bold')

    const italicItem = richText.find((rt) => rt.annotations.italic)
    expect(italicItem).toBeDefined()
    expect(italicItem!.text.content).toBe('Italic')

    const linkItem = richText.find((rt) => rt.text.link)
    expect(linkItem).toBeDefined()
    expect(linkItem!.text.link!.url).toBe('https://example.com')
    expect(linkItem!.text.content).toBe('Link')
  })

  it('should handle empty string', () => {
    const blocks = markdownToBlocks('')
    expect(blocks).toHaveLength(0)
  })

  it('should handle string with only newlines', () => {
    const blocks = markdownToBlocks('\n\n\n')
    expect(blocks).toHaveLength(0)
  })
})
