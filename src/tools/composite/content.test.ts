import { describe, expect, it, vi } from 'vitest'
import * as markdownHelpers from '../helpers/markdown.js'
import { contentConvert } from './content.js'

// Mock markdown helpers to test error paths
vi.mock('../helpers/markdown.js', async () => {
  const actual = (await vi.importActual('../helpers/markdown.js')) as any
  return {
    ...actual,
    blocksToMarkdown: vi.fn(actual.blocksToMarkdown),
    markdownToBlocks: vi.fn(actual.markdownToBlocks)
  }
})

describe('contentConvert', () => {
  describe('markdown-to-blocks', () => {
    it('should convert markdown string to blocks', async () => {
      const input = 'Hello'
      const result = await contentConvert({
        direction: 'markdown-to-blocks',
        content: input
      })

      expect(result.direction).toBe('markdown-to-blocks')
      expect(result.block_count).toBe(1)
      expect(result.blocks).toHaveLength(1)
      expect(result.blocks[0].type).toBe('paragraph')
      expect(result.blocks[0].paragraph.rich_text[0].text.content).toBe('Hello')
    })

    it('should throw error if content is not a string', async () => {
      try {
        await contentConvert({
          direction: 'markdown-to-blocks',
          content: ['not', 'a', 'string']
        } as any)
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Content must be a string for markdown-to-blocks')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide a string content')
      }
    })

    it('should catch and enhance unexpected errors from markdownToBlocks', async () => {
      vi.mocked(markdownHelpers.markdownToBlocks).mockImplementationOnce(() => {
        throw new Error('Unexpected markdown error')
      })

      try {
        await contentConvert({
          direction: 'markdown-to-blocks',
          content: 'some markdown'
        })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Unexpected markdown error')
        expect(error.code).toBe('UNKNOWN_ERROR')
      }
    })
  })

  describe('blocks-to-markdown', () => {
    it('should convert blocks array to markdown string', async () => {
      const inputBlocks = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: 'Hello' },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default'
                }
              }
            ]
          }
        }
      ]

      const result = await contentConvert({
        direction: 'blocks-to-markdown',
        content: inputBlocks
      })

      expect(result.direction).toBe('blocks-to-markdown')
      expect(typeof result.char_count).toBe('number')
      expect(result.markdown).toBe('Hello')
    })

    it('should parse JSON string and convert to markdown', async () => {
      const inputBlocks = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: 'Parsed JSON' },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default'
                }
              }
            ]
          }
        }
      ]
      const jsonContent = JSON.stringify(inputBlocks)

      const result = await contentConvert({
        direction: 'blocks-to-markdown',
        content: jsonContent
      })

      expect(result.direction).toBe('blocks-to-markdown')
      expect(result.markdown).toBe('Parsed JSON')
    })

    it('should throw error if content is invalid JSON string', async () => {
      try {
        await contentConvert({
          direction: 'blocks-to-markdown',
          content: '{ invalid json }'
        })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Content must be a valid JSON array or array object for blocks-to-markdown')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide a valid JSON array or object')
      }
    })

    it('should throw error if content is not an array (after parsing)', async () => {
      // Test direct non-array input
      try {
        await contentConvert({
          direction: 'blocks-to-markdown',
          content: { not: 'an array' } as any
        })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Content must be an array for blocks-to-markdown')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide an array content')
      }

      // Test JSON object that is not an array
      try {
        await contentConvert({
          direction: 'blocks-to-markdown',
          content: '{"not": "an array"}'
        })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Content must be an array for blocks-to-markdown')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide an array content')
      }

      // Test JSON array with non-object elements
      try {
        await contentConvert({
          direction: 'blocks-to-markdown',
          content: '[1, 2, 3]'
        })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Content must be an array of objects for blocks-to-markdown')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide an array of block objects')
      }
    })

    it('should catch and enhance unexpected errors from blocksToMarkdown', async () => {
      vi.mocked(markdownHelpers.blocksToMarkdown).mockImplementationOnce(() => {
        throw new Error('Unexpected blocks error')
      })

      try {
        await contentConvert({
          direction: 'blocks-to-markdown',
          content: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } }]
        })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Unexpected blocks error')
        expect(error.code).toBe('UNKNOWN_ERROR')
      }
    })
  })

  describe('unsupported direction', () => {
    it('should throw error for invalid direction', async () => {
      try {
        await contentConvert({
          direction: 'invalid-direction' as any,
          content: 'some content'
        })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Unsupported direction: invalid-direction')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide a valid direction')
      }
    })
  })
})

function fail(message: string) {
  throw new Error(message)
}
