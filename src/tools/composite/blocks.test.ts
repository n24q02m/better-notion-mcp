import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as markdown from '../helpers/markdown.js'
import { blockCache, blocks } from './blocks'

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
    blockCache.clear()
  })

  describe('get', () => {
    it('should retrieve block metadata', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false,
        paragraph: { rich_text: [] }
      })

      const result = await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })

      expect(result.action).toBe('get')
      expect(result.block_id).toBe('block-1')
      expect(result.type).toBe('paragraph')
      expect(result.has_children).toBe(false)
      expect(result.archived).toBe(false)
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledWith({ block_id: 'block-1' })
    })

    it('should use cache for subsequent calls', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false
      })

      // First call - populates cache
      await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

      // Second call - uses cache
      await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)
    })

    it('should throw without block_id', async () => {
      await expect(blocks(mockNotion as any, { action: 'get' } as any)).rejects.toThrow('block_id required')
    })
  })

  describe('children', () => {
    it('should list and populate children', async () => {
      mockNotion.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'child-1',
            type: 'paragraph',
            has_children: false,
            paragraph: { rich_text: [{ type: 'text', text: { content: 'Hello' } }] }
          }
        ],
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

    it('should pass position start when specified', async () => {
      mockNotion.blocks.children.append.mockResolvedValue({})

      await blocks(mockNotion as any, {
        action: 'append',
        block_id: 'block-1',
        content: 'Prepended',
        position: 'start'
      })

      expect(mockNotion.blocks.children.append).toHaveBeenCalledWith({
        block_id: 'block-1',
        children: expect.any(Array),
        position: { type: 'start' }
      })
    })

    it('should pass position after_block with after_block_id', async () => {
      mockNotion.blocks.children.append.mockResolvedValue({})

      await blocks(mockNotion as any, {
        action: 'append',
        block_id: 'block-1',
        content: 'Inserted after',
        position: 'after_block',
        after_block_id: 'target-block'
      })

      expect(mockNotion.blocks.children.append).toHaveBeenCalledWith({
        block_id: 'block-1',
        children: expect.any(Array),
        position: { type: 'after_block', after_block: { id: 'target-block' } }
      })
    })

    it('should throw when after_block without after_block_id', async () => {
      await expect(
        blocks(mockNotion as any, {
          action: 'append',
          block_id: 'block-1',
          content: 'Missing ID',
          position: 'after_block'
        })
      ).rejects.toThrow('after_block_id required')
    })

    it('should not include position when using default end', async () => {
      mockNotion.blocks.children.append.mockResolvedValue({})

      await blocks(mockNotion as any, {
        action: 'append',
        block_id: 'block-1',
        content: 'Default append'
      })

      const call = mockNotion.blocks.children.append.mock.calls[0][0]
      expect(call.position).toBeUndefined()
    })
  })

  describe('update', () => {
    it('should update paragraph block and invalidate cache', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false,
        paragraph: { rich_text: [] }
      })
      mockNotion.blocks.update.mockResolvedValue({})

      // Populate cache first
      await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

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

      // Get again - should call API because cache was invalidated
      await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(3) // 1 (get) + 1 (update internally) + 1 (get after invalidate)
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
      ).rejects.toThrow('Block type mismatch: cannot update image with content that parses to paragraph')
    })

    it('should throw without content', async () => {
      await expect(blocks(mockNotion as any, { action: 'update', block_id: 'block-1' })).rejects.toThrow(
        'content required for update'
      )
    })

    it('should throw when content type does not match block type', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false,
        paragraph: { rich_text: [] }
      })

      await expect(
        blocks(mockNotion as any, {
          action: 'update',
          block_id: 'block-1',
          content: '# New Heading'
        })
      ).rejects.toThrow('Block type mismatch')
    })

    it('should update to_do block with checked state', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'to_do',
        has_children: false,
        archived: false,
        to_do: { rich_text: [], checked: true }
      })
      mockNotion.blocks.update.mockResolvedValue({})

      const result = await blocks(mockNotion as any, {
        action: 'update',
        block_id: 'block-1',
        content: '- [ ] Updated task'
      })

      expect(result).toEqual({
        action: 'update',
        block_id: 'block-1',
        type: 'to_do',
        updated: true
      })
      expect(mockNotion.blocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          block_id: 'block-1',
          to_do: { rich_text: expect.any(Array), checked: expect.any(Boolean) }
        })
      )
    })

    it('should update code block with language', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'code',
        has_children: false,
        archived: false,
        code: { rich_text: [], language: 'javascript' }
      })
      mockNotion.blocks.update.mockResolvedValue({})

      const result = await blocks(mockNotion as any, {
        action: 'update',
        block_id: 'block-1',
        content: '```javascript\nconsole.log("hello")\n```'
      })

      expect(result).toEqual({
        action: 'update',
        block_id: 'block-1',
        type: 'code',
        updated: true
      })
      expect(mockNotion.blocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          block_id: 'block-1',
          code: { rich_text: expect.any(Array), language: expect.any(String) }
        })
      )
    })

    it('should throw for non-text block type like table', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'table',
        has_children: true,
        archived: false,
        table: { table_width: 2, has_column_header: false, has_row_header: false }
      })

      await expect(
        blocks(mockNotion as any, {
          action: 'update',
          block_id: 'block-1',
          content: '| A | B |'
        })
      ).rejects.toThrow("Block type 'table' cannot be updated")
    })

    it('should throw when content produces no blocks', async () => {
      mockNotion.blocks.retrieve.mockResolvedValue({
        id: 'block-1',
        type: 'paragraph',
        has_children: false,
        archived: false,
        paragraph: { rich_text: [] }
      })

      const spy = vi.spyOn(markdown, 'markdownToBlocks').mockReturnValueOnce([])

      await expect(
        blocks(mockNotion as any, {
          action: 'update',
          block_id: 'block-1',
          content: 'some content'
        })
      ).rejects.toThrow('Content must produce at least one block')

      spy.mockRestore()
    })
  })

  describe('delete', () => {
    it('should delete block and invalidate cache', async () => {
      mockNotion.blocks.delete.mockResolvedValue({})
      mockNotion.blocks.retrieve.mockResolvedValue({ id: 'block-1', type: 'paragraph' })

      // Populate cache
      await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(1)

      const result = await blocks(mockNotion as any, { action: 'delete', block_id: 'block-1' })

      expect(result).toEqual({
        action: 'delete',
        block_id: 'block-1',
        deleted: true
      })
      expect(mockNotion.blocks.delete).toHaveBeenCalledWith({ block_id: 'block-1' })

      // Get again - should call API because cache was invalidated
      await blocks(mockNotion as any, { action: 'get', block_id: 'block-1' })
      expect(mockNotion.blocks.retrieve).toHaveBeenCalledTimes(2)
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
