import { describe, it, expect } from 'vitest'
import { markdownToBlocks } from './markdown'

describe('markdownToBlocks', () => {
  it('should parse bulleted lists', () => {
    const markdown = '- Item 1\n- Item 2'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('bulleted_list_item')
    expect(blocks[1].type).toBe('bulleted_list_item')
  })

  it('should parse numbered lists', () => {
    const markdown = '1. Item 1\n2. Item 2'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('numbered_list_item')
    expect(blocks[1].type).toBe('numbered_list_item')
  })

  it('should parse dividers', () => {
    const markdown = '---'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('divider')
  })

  it('should handle mixed content', () => {
    const markdown = '# Header\n\n- List item\n\n1. Numbered item\n\n---'
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(4)
    expect(blocks[0].type).toBe('heading_1')
    expect(blocks[1].type).toBe('bulleted_list_item')
    expect(blocks[2].type).toBe('numbered_list_item')
    expect(blocks[3].type).toBe('divider')
  })
})
