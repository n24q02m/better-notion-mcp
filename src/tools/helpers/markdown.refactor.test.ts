import { describe, expect, it } from 'vitest'
import { markdownToBlocks } from './markdown.js'

describe('MarkdownParser Regression Tests', () => {
  it('should handle metadata tags [toc] and [breadcrumb]', () => {
    const md = '[toc]\n[breadcrumb]\n[TOC]\n[BREADCRUMB]'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(4)
    expect(blocks[0].type).toBe('table_of_contents')
    expect(blocks[1].type).toBe('breadcrumb')
    expect(blocks[2].type).toBe('table_of_contents')
    expect(blocks[3].type).toBe('breadcrumb')
  })

  it('should handle equation blocks', () => {
    const md = '$$x^2 + y^2 = z^2$$'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('equation')
  })

  it('should handle callout blocks', () => {
    const md = '> [!NOTE]\n> This is a note'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('callout')
    expect(blocks[0].callout?.icon.emoji).toBe('ℹ️')
  })

  it('should handle images with safety checks', () => {
    const md = '![alt](https://example.com/image.png)\n![alt](javascript:alert(1))'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('image')
    expect(blocks[1].type).toBe('paragraph') // Unsafe URL becomes paragraph
  })

  it('should handle bookmarks and embeds', () => {
    const md = '[bookmark](https://example.com)\n[embed](https://example.com)'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('bookmark')
    expect(blocks[1].type).toBe('embed')
  })

  it('should handle toggles (<details>)', () => {
    const md = '<details>\n<summary>Title</summary>\nContent\n</details>'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('toggle')
  })

  it('should handle column layouts', () => {
    const md = ':::columns\n:::column\nCol 1\n:::column\nCol 2\n:::end'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('column_list')
  })

  it('should handle tables', () => {
    const md = '| Head 1 | Head 2 |\n|---|---|\n| Cell 1 | Cell 2 |'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('table')
  })

  it('should handle headings', () => {
    const md = '# H1\n## H2\n### H3'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('heading_1')
    expect(blocks[1].type).toBe('heading_2')
    expect(blocks[2].type).toBe('heading_3')
  })

  it('should handle code blocks', () => {
    const md = '```ts\nconst x = 1\n```'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('code')
  })

  it('should handle lists (bulleted, numbered, todo)', () => {
    const md = '- Item 1\n1. Item 2\n- [ ] Task 1\n- [x] Task 2'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(4)
    expect(blocks[0].type).toBe('bulleted_list_item')
    expect(blocks[1].type).toBe('numbered_list_item')
    expect(blocks[2].type).toBe('to_do')
    expect(blocks[3].type).toBe('to_do')
  })

  it('should handle quotes', () => {
    const md = '> Quote'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('quote')
  })

  it('should handle dividers', () => {
    const md = '---'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('divider')
  })

  it('should handle regular paragraphs', () => {
    const md = 'Regular text'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('paragraph')
  })

  it('should flush lists when moving to non-list blocks', () => {
    const md = '- List item\n\nParagraph'
    const blocks = markdownToBlocks(md)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('bulleted_list_item')
    expect(blocks[1].type).toBe('paragraph')
  })
})
