import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blocks } from './blocks'

const mockNotion = {
  blocks: {
    retrieve: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    children: {
      list: vi.fn(),
      append: vi.fn()
    }
  }
}

describe('blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validation', () => {
    it('should throw without block_id', async () => {
      await expect(blocks(mockNotion as any, { action: 'get', block_id: '' })).rejects.toThrow('block_id required')
    })
  })

  describe('get', () => {
    it('should return block info', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false,
        paragraph: { rich_text: [] }
      })

      const result = await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })

      expect(result).toEqual({
        action: 'get',
        block_id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false,
        block: {
          id: 'block-1',
          type: 'paragraph',
          has_children: false,
          archived: false,
          paragraph: { rich_text: [] }
        }
      })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledWith({ block_id: 'block-1' })
    })
  })

  describe('children', () => {
    it('should return markdown and blocks', async () => {
      const paragraphBlock = {
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

      mockNotion.blocks.children.list.mockResolvedValue({
        results: [paragraphBlock],
        next_cursor: null,
        has_more: false
      })

      const result = await blocks(mockNotion as any, { action: 'children', block_id: 'block-1' })

      expect(result.action).toBe('children')
      expect(result.block_id).toBe('block-1')
      expect(result.total_children).toBe(1)
      expect(result.markdown).toBe('Hello')
      expect(result.blocks).toHaveLength(1)
      expect(mockNotion.blocks.children.list).toHaveBeenCalledWith({
        block_id: 'block-1',
        start_cursor: undefined,
        page_size: 100
      })
    })

    it('should handle empty blocks', async () => {
      mockNotion.blocks.children.list.mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const result = await blocks(mockNotion as any, { action: 'children', block_id: 'block-1' })

      expect(result.action).toBe('children')
      expect(result.block_id).toBe('block-1')
      expect(result.total_children).toBe(0)
      expect(result.markdown).toBe('')
      expect(result.blocks).toHaveLength(0)
    })
  })

  describe('append', () => {
    it('should append blocks from markdown', async () => {
      mockNotion.blocks.children.append.mockResolvedValue({})

      const result = await blocks(mockNotion as any, {
        action: 'append',
        block_id: 'block-1',
        content: 'Hello world'
      })

      expect(result.action).toBe('append')
      expect(result.block_id).toBe('block-1')
      expect(result.appended_count).toBe(1)
      expect(mockNotion.blocks.children.append).toHaveBeenCalledWith({
        block_id: 'block-1',
        children: expect.any(Array)
      })
    })

    it('should throw without content', async () => {
      await expect(blocks(mockNotion as any, { action: 'append', block_id: 'block-1' })).rejects.toThrow(
        'content required for append'
      )
    })
  })

  describe('update', () => {
    it('should update paragraph block', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false,
        paragraph: { rich_text: [] }
      })
      mockNotion.blocks.update.mockResolvedValue({})

      const result = await blocks(mockNotion as any, {
        action: 'update',
        block_id: 'block-1',
        content: 'Updated text'
      })

      expect(result).toEqual({
        action: 'update',
        block_id: 'block-1',
        type: 'paragraph',
        updated: true
      })
      expect(mockNotion.blocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          block_id: 'block-1',
          paragraph: { rich_text: expect.any(Array) }
        })
      )
    })

    it('should update heading block', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'heading_1',
        has_children: false,
        archived: false,
        heading_1: { rich_text: [], color: 'default' }
      })
      mockNotion.blocks.update.mockResolvedValue({})

      const result = await blocks(mockNotion as any, {
        action: 'update',
        block_id: 'block-1',
        content: '# New heading'
      })

      expect(result).toEqual({
        action: 'update',
        block_id: 'block-1',
        type: 'heading_1',
        updated: true
      })
      expect(mockNotion.blocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          block_id: 'block-1',
          heading_1: { rich_text: expect.any(Array) }
        })
      )
    })

    it('should throw for unsupported block type', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'image',
        has_children: false,
        archived: false,
        image: { type: 'external', external: { url: 'https://example.com/img.png' } }
      })

      await expect(
        blocks(mockNotion as any, {
          action: 'update',
          block_id: 'block-1',
          content: 'Some text'
        })
      ).rejects.toThrow("Block type 'image' cannot be updated")
    })

    it('should throw without content', async () => {
      await expect(blocks(mockNotion as any, { action: 'update', block_id: 'block-1' })).rejects.toThrow(
        'content required for update'
      )
    })
  })

  describe('delete', () => {
    it('should delete block', async () => {
      mockNotion.blocks.delete.mockResolvedValue({})

      const result = await blocks(mockNotion as any, { action: 'delete', block_id: 'block-1' })

      expect(result).toEqual({
        action: 'delete',
        block_id: 'block-1',
        deleted: true
      })
      expect(mockNotion.blocks.delete).toHaveBeenCalledWith({ block_id: 'block-1' })
    })
  })

  describe('default', () => {
    it('should throw on unknown action', async () => {
      await expect(blocks(mockNotion as any, { action: 'invalid' as any, block_id: 'block-1' })).rejects.toThrow(
        'Unknown action: invalid'
      )
    })
  })
})
