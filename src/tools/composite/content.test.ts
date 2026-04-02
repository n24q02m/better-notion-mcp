import { describe, expect, it } from 'vitest'
import { contentConvert } from './content'

// Integration tests using real markdown helpers
// We do not mock dependencies because we cannot reliably mock ESM imports in this environment without vitest runner.

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
        throw new Error('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Content must be a string for markdown-to-blocks')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide a string content')
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
        throw new Error('Should have thrown')
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
        throw new Error('Should have thrown')
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
        throw new Error('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Content must be an array for blocks-to-markdown')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide an array content')
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
        throw new Error('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Unsupported direction: invalid-direction')
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.suggestion).toBe('Provide a valid direction')
      }
    })
  })
})
