import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as markdown from '../helpers/markdown.js'
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

  describe('children - stale mention resolution', () => {
    it('should resolve stale Untitled mentions by fetching page titles', async () => {
      const staleMention = {
        type: 'mention',
        mention: { page: { id: 'mentioned-page-1' } },
        plain_text: 'Untitled',
        annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' }
      }

      mockNotion.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'block-with-mention',
            type: 'paragraph',
            paragraph: { rich_text: [staleMention] }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      // Mock pages.retrieve for mentioned page
      const mockPagesRetrieve = vi.fn().mockResolvedValue({
        id: 'mentioned-page-1',
        properties: { Name: { type: 'title', title: [{ plain_text: 'Resolved Page Title' }] } }
      })
      const notionWithPages = {
        ...mockNotion,
        pages: { retrieve: mockPagesRetrieve }
      }

      const result = await blocks(notionWithPages as any, { action: 'children', block_id: 'block-1' })

      expect(result.action).toBe('children')
      // Verify the mentioned page was fetched
      expect(mockPagesRetrieve).toHaveBeenCalledWith({ page_id: 'mentioned-page-1' })
      // Verify the stale mention was resolved in-place
      expect(staleMention.plain_text).toBe('Resolved Page Title')
    })

    it('should skip mention resolution when no stale mentions', async () => {
      mockNotion.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'block-1',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'mention',
                  mention: { page: { id: 'page-with-title' } },
                  plain_text: 'Already Named',
                  annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' }
                }
              ]
            }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const mockPagesRetrieve = vi.fn()
      const notionWithPages = {
        ...mockNotion,
        pages: { retrieve: mockPagesRetrieve }
      }

      await blocks(notionWithPages as any, { action: 'children', block_id: 'block-1' })

      // No page retrieval for mentions since none are stale
      expect(mockPagesRetrieve).not.toHaveBeenCalled()
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
