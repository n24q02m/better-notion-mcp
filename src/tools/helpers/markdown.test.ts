import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, markdownToBlocks, parseRichText } from './markdown.js'

describe('markdown helpers', () => {
  it('should parse simple rich text', () => {
    const result = parseRichText('hello **world**')
    expect(result).toHaveLength(2)
    expect(result[0].text.content).toBe('hello ')
    expect(result[1].text.content).toBe('world')
    expect(result[1].annotations.bold).toBe(true)
  })

  it('should convert markdown to blocks', () => {
    const blocks = markdownToBlocks('# Hello\n\nParagraph')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('heading_1')
    expect(blocks[1].type).toBe('paragraph')
  })

  it('should convert blocks to markdown', () => {
    const blocks: any[] = [
      {
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: 'Hello' }, annotations: {} }] }
      }
    ]
    const md = blocksToMarkdown(blocks)
    expect(md).toBe('# Hello')
  })
})
