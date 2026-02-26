import { describe, expect, it } from 'vitest'
import { markdownToBlocks } from './markdown'

describe('markdownToBlocks', () => {
  it('should create heading blocks correctly', () => {
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

  it('should create paragraph blocks', () => {
    const markdown = 'This is a paragraph.'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('paragraph')
    expect(blocks[0].paragraph.rich_text[0].text.content).toBe('This is a paragraph.')
  })

  it('should create bulleted list items', () => {
    const markdown = '- Item 1\n* Item 2'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('bulleted_list_item')
    expect(blocks[0].bulleted_list_item.rich_text[0].text.content).toBe('Item 1')
    expect(blocks[1].type).toBe('bulleted_list_item')
    expect(blocks[1].bulleted_list_item.rich_text[0].text.content).toBe('Item 2')
  })

  it('should create numbered list items', () => {
    const markdown = '1. Item 1\n2. Item 2'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('numbered_list_item')
    expect(blocks[0].numbered_list_item.rich_text[0].text.content).toBe('Item 1')
    expect(blocks[1].type).toBe('numbered_list_item')
    expect(blocks[1].numbered_list_item.rich_text[0].text.content).toBe('Item 2')
  })

  it('should create quote blocks', () => {
    const markdown = '> This is a quote'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('quote')
    expect(blocks[0].quote.rich_text[0].text.content).toBe('This is a quote')
  })

  it('should create divider blocks', () => {
    const markdown = '---'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('divider')
  })

  it('should parse rich text in blocks', () => {
    const markdown = 'Bold **text** and *italic*'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    const richText = blocks[0].paragraph.rich_text
    expect(richText.length).toBeGreaterThan(1)

    // Find the bold part
    const boldPart = richText.find((rt: any) => rt.annotations.bold)
    expect(boldPart).toBeDefined()
    expect(boldPart.text.content).toBe('text')

    // Find the italic part
    const italicPart = richText.find((rt: any) => rt.annotations.italic)
    expect(italicPart).toBeDefined()
    expect(italicPart.text.content).toBe('italic')
  })
})
