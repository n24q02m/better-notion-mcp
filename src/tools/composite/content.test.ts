import { describe, it, expect, vi, beforeEach } from 'vitest'
import { contentConvert } from './content.js'
import { markdownToBlocks, blocksToMarkdown } from '../helpers/markdown.js'

// Mock the markdown helpers
vi.mock('../helpers/markdown.js', () => ({
  markdownToBlocks: vi.fn(),
  blocksToMarkdown: vi.fn()
}))

describe('contentConvert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('markdown-to-blocks', () => {
    it('should convert markdown string to blocks', async () => {
      const mockBlocks = [{ object: 'block', type: 'paragraph' }]
      vi.mocked(markdownToBlocks).mockReturnValue(mockBlocks as any)

      const input = {
        direction: 'markdown-to-blocks' as const,
        content: '# Hello'
      }

      const result = await contentConvert(input)

      expect(markdownToBlocks).toHaveBeenCalledWith('# Hello')
      expect(result).toEqual({
        direction: 'markdown-to-blocks',
        block_count: 1,
        blocks: mockBlocks
      })
    })

    it('should throw error if content is not a string', async () => {
      const input = {
        direction: 'markdown-to-blocks' as const,
        content: 123 as any
      }

      await expect(contentConvert(input)).rejects.toThrow('Content must be a string')
    })
  })

  describe('blocks-to-markdown', () => {
    it('should convert blocks array to markdown', async () => {
      const mockMarkdown = '# Hello'
      vi.mocked(blocksToMarkdown).mockReturnValue(mockMarkdown)

      const input = {
        direction: 'blocks-to-markdown' as const,
        content: [{ object: 'block' }]
      }

      const result = await contentConvert(input)

      expect(blocksToMarkdown).toHaveBeenCalledWith(input.content)
      expect(result).toEqual({
        direction: 'blocks-to-markdown',
        char_count: mockMarkdown.length,
        markdown: mockMarkdown
      })
    })

    it('should parse JSON string content and convert', async () => {
      const mockMarkdown = '# Hello'
      vi.mocked(blocksToMarkdown).mockReturnValue(mockMarkdown)

      const blocks = [{ object: 'block' }]
      const input = {
        direction: 'blocks-to-markdown' as const,
        content: JSON.stringify(blocks)
      }

      const result = await contentConvert(input)

      expect(blocksToMarkdown).toHaveBeenCalledWith(blocks)
      expect(result).toEqual({
        direction: 'blocks-to-markdown',
        char_count: mockMarkdown.length,
        markdown: mockMarkdown
      })
    })

    it('should throw error for invalid JSON string', async () => {
      const input = {
        direction: 'blocks-to-markdown' as const,
        content: '{ invalid json }'
      }

      await expect(contentConvert(input)).rejects.toThrow('Content must be a valid JSON array')
    })

    it('should throw error if content is not an array (after parsing)', async () => {
      const input = {
        direction: 'blocks-to-markdown' as const,
        content: JSON.stringify({ not: 'an array' })
      }

      await expect(contentConvert(input)).rejects.toThrow('Content must be an array')
    })

    it('should throw error if content is number', async () => {
        const input = {
            direction: 'blocks-to-markdown' as const,
            content: 123 as any
        }

        await expect(contentConvert(input)).rejects.toThrow('Content must be an array')
    })
  })

  describe('general', () => {
    it('should throw error for unsupported direction', async () => {
      const input = {
        direction: 'invalid-direction' as any,
        content: ''
      }

      await expect(contentConvert(input)).rejects.toThrow('Unsupported direction')
    })
  })
})
