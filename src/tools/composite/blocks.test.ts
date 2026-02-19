import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blocks } from './blocks.js'

describe('blocks tool', () => {
  const mockNotion = {
    blocks: {
      retrieve: vi.fn(),
      children: {
        list: vi.fn(),
        append: vi.fn()
      },
      update: vi.fn(),
      delete: vi.fn()
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('update action', () => {
    it('should correctly update a block type when markdown suggests a change', async () => {
      // Mock existing block as a paragraph
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-id',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: 'Original text' } }]
        }
      })

      mockNotion.blocks.update.mockResolvedValue({
        id: 'block-id',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: 'New Heading' } }]
        }
      })

      await blocks(mockNotion as any, {
        action: 'update',
        block_id: 'block-id',
        content: '# New Heading'
      })

      // The key fix: verify that the update payload uses the NEW type (heading_1), not the old type (paragraph)
      expect(mockNotion.blocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          block_id: 'block-id',
          heading_1: expect.objectContaining({
            rich_text: expect.arrayContaining([
              expect.objectContaining({
                text: expect.objectContaining({ content: 'New Heading' })
              })
            ])
          })
        })
      )

      expect(mockNotion.blocks.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          paragraph: expect.anything()
        })
      )
    })

    it('should throw error for unsupported block types', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-id',
        type: 'paragraph'
      })

      // Divider is not in the supported list for update
      await expect(
        blocks(mockNotion as any, {
          action: 'update',
          block_id: 'block-id',
          content: '---'
        })
      ).rejects.toThrow(/Markdown parsed to unsupported type/)
    })
  })
})
