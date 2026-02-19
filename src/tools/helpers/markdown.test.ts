import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, extractPlainText, markdownToBlocks, parseRichText } from './markdown.js'

describe('markdown helpers', () => {
  it('should parse simple markdown', () => {
    const markdown = 'Hello **world**'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('paragraph')
    const richText = blocks[0].paragraph.rich_text
    expect(richText).toHaveLength(2)
    expect(richText[0].text.content).toBe('Hello ')
    expect(richText[1].text.content).toBe('world')
    expect(richText[1].annotations.bold).toBe(true)
  })

  it('should convert blocks to markdown', () => {
    // Mock blocks
    const blocks: any[] = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: 'Hello ', link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            },
            {
              type: 'text',
              text: { content: 'world', link: null },
              annotations: {
                bold: true,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            }
          ],
          color: 'default'
        }
      }
    ]

    const markdown = blocksToMarkdown(blocks)
    expect(markdown).toBe('Hello **world**')
  })

  it('should parse rich text', () => {
    const text = 'Hello **world**'
    const richText = parseRichText(text)
    expect(richText).toHaveLength(2)
    expect(richText[0].text.content).toBe('Hello ')
    expect(richText[1].text.content).toBe('world')
    expect(richText[1].annotations.bold).toBe(true)
  })

  it('should extract plain text', () => {
    const richText: any[] = [
      {
        type: 'text',
        text: { content: 'Hello ', link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      },
      {
        type: 'text',
        text: { content: 'world', link: null },
        annotations: {
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ]
    expect(extractPlainText(richText)).toBe('Hello world')
  })
})
