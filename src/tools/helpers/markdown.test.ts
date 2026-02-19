import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, type NotionBlock, type RichText } from './markdown'

// Helper to create RichText object
function createRichText(
  content: string,
  annotations: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean } = {},
  link?: string
): RichText {
  return {
    type: 'text',
    text: { content, link: link ? { url: link } : null },
    annotations: {
      bold: annotations.bold || false,
      italic: annotations.italic || false,
      strikethrough: annotations.strikethrough || false,
      underline: false,
      code: annotations.code || false,
      color: 'default'
    }
  }
}

// Helper block creators for testing
const createParagraph = (text: RichText[]): NotionBlock => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: text, color: 'default' }
})

const createHeading = (level: 1 | 2 | 3, text: RichText[]): NotionBlock => ({
  object: 'block',
  type: `heading_${level}`,
  [`heading_${level}`]: { rich_text: text, color: 'default' }
})

const createBulletedListItem = (text: RichText[]): NotionBlock => ({
  object: 'block',
  type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: text, color: 'default' }
})

const createNumberedListItem = (text: RichText[]): NotionBlock => ({
  object: 'block',
  type: 'numbered_list_item',
  numbered_list_item: { rich_text: text, color: 'default' }
})

const createCodeBlock = (text: RichText[], language?: string): NotionBlock => ({
  object: 'block',
  type: 'code',
  code: { rich_text: text, language: language || 'plain text' }
})

const createQuote = (text: RichText[]): NotionBlock => ({
  object: 'block',
  type: 'quote',
  quote: { rich_text: text, color: 'default' }
})

const createDivider = (): NotionBlock => ({
  object: 'block',
  type: 'divider',
  divider: {}
})

describe('blocksToMarkdown', () => {
  it('should convert paragraph blocks', () => {
    const blocks = [
      createParagraph([createRichText('Hello world')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('Hello world')
  })

  it('should convert heading blocks', () => {
    const blocks = [
      createHeading(1, [createRichText('Heading 1')]),
      createHeading(2, [createRichText('Heading 2')]),
      createHeading(3, [createRichText('Heading 3')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('# Heading 1\n## Heading 2\n### Heading 3')
  })

  it('should convert bulleted list items', () => {
    const blocks = [
      createBulletedListItem([createRichText('Item 1')]),
      createBulletedListItem([createRichText('Item 2')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('- Item 1\n- Item 2')
  })

  it('should convert numbered list items', () => {
    const blocks = [
      createNumberedListItem([createRichText('Item 1')]),
      createNumberedListItem([createRichText('Item 2')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('1. Item 1\n1. Item 2')
  })

  it('should convert code blocks', () => {
    const blocks = [
      createCodeBlock([createRichText('console.log("Hello")')], 'typescript')
    ]
    expect(blocksToMarkdown(blocks)).toBe('```typescript\nconsole.log("Hello")\n```')
  })

  it('should handle code blocks without language', () => {
    const blocks = [
      createCodeBlock([createRichText('echo "test"')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('```plain text\necho "test"\n```')
  })

  it('should convert quote blocks', () => {
    const blocks = [
      createQuote([createRichText('This is a quote')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('> This is a quote')
  })

  it('should convert divider blocks', () => {
    const blocks = [
      createDivider()
    ]
    expect(blocksToMarkdown(blocks)).toBe('---')
  })

  it('should handle rich text formatting', () => {
    const blocks = [
      createParagraph([
        createRichText('Bold', { bold: true }),
        createRichText(' and '),
        createRichText('Italic', { italic: true }),
        createRichText(' and '),
        createRichText('Code', { code: true }),
        createRichText(' and '),
        createRichText('Strikethrough', { strikethrough: true })
      ])
    ]
    expect(blocksToMarkdown(blocks)).toBe('**Bold** and *Italic* and `Code` and ~~Strikethrough~~')
  })

  it('should handle links', () => {
    const blocks = [
      createParagraph([
        createRichText('Click here', {}, 'https://example.com')
      ])
    ]
    expect(blocksToMarkdown(blocks)).toBe('[Click here](https://example.com)')
  })

  it('should handle mixed block types', () => {
    const blocks = [
      createHeading(1, [createRichText('Title')]),
      createParagraph([createRichText('Introduction')]),
      createDivider(),
      createBulletedListItem([createRichText('Point 1')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('# Title\nIntroduction\n---\n- Point 1')
  })

  it('should ignore unsupported block types', () => {
    const blocks = [
      createParagraph([createRichText('Supported')]),
      {
        object: 'block',
        type: 'unsupported_type',
        unsupported_type: {}
      } as unknown as NotionBlock,
      createParagraph([createRichText('Also supported')])
    ]
    expect(blocksToMarkdown(blocks)).toBe('Supported\nAlso supported')
  })

  it('should handle empty blocks array', () => {
    expect(blocksToMarkdown([])).toBe('')
  })
})
