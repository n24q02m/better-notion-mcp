/**
 * Blocks Mega Tool
 * All block operations in one unified interface
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { blocksToMarkdown, collectMentionIds, markdownToBlocks, replaceMentionTitles } from '../helpers/markdown.js'
import { autoPaginate, fetchChildrenRecursive } from '../helpers/pagination.js'

export interface BlocksInput {
  action: 'get' | 'children' | 'append' | 'update' | 'delete'
  block_id: string
  content?: string // Markdown format
}

/**
 * Unified blocks tool
 * Maps to: GET/PATCH/DELETE /v1/blocks/{id} and GET/PATCH /v1/blocks/{id}/children
 */
export async function blocks(notion: Client, input: BlocksInput): Promise<any> {
  return withErrorHandling(async () => {
    if (!input.block_id) {
      throw new NotionMCPError('block_id required', 'VALIDATION_ERROR', 'Provide block_id')
    }

    switch (input.action) {
      case 'get': {
        const block: any = await notion.blocks.retrieve({ block_id: input.block_id })
        return {
          action: 'get',
          block_id: block.id,
          type: block.type,
          has_children: block.has_children,
          archived: block.archived,
          block
        }
      }

      case 'children': {
        const blocksList = await autoPaginate((cursor) =>
          notion.blocks.children.list({
            block_id: input.block_id,
            start_cursor: cursor,
            page_size: 100
          })
        )

        // Recursively fetch children for blocks that need them (tables, toggles, columns)
        await fetchChildrenRecursive(blocksList as any[], async (blockId) => {
          return autoPaginate((cursor) =>
            notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 })
          ) as any
        })

        // Resolve stale mention titles (plain_text === 'Untitled') by batch-fetching page titles
        const mentionIds = collectMentionIds(blocksList as any[])
        if (mentionIds.size > 0 && mentionIds.size <= 50) {
          const titleMap = new Map<string, string>()
          const ids = Array.from(mentionIds)
          for (let i = 0; i < ids.length; i += 5) {
            const batch = ids.slice(i, i + 5)
            const results = await Promise.allSettled(batch.map((id) => notion.pages.retrieve({ page_id: id })))
            for (let j = 0; j < results.length; j++) {
              if (results[j].status === 'fulfilled') {
                const page = (results[j] as PromiseFulfilledResult<any>).value
                const titleProp = Object.values(page.properties || {}).find((p: any) => p.type === 'title') as any
                const title = titleProp?.title?.[0]?.plain_text
                if (title) {
                  titleMap.set(batch[j], title)
                }
              }
            }
          }
          if (titleMap.size > 0) {
            replaceMentionTitles(blocksList as any[], titleMap)
          }
        }

        const markdown = blocksToMarkdown(blocksList as any)
        return {
          action: 'children',
          block_id: input.block_id,
          total_children: blocksList.length,
          markdown,
          blocks: blocksList
        }
      }

      case 'append': {
        if (!input.content) {
          throw new NotionMCPError('content required for append', 'VALIDATION_ERROR', 'Provide markdown content')
        }
        const blocksList = markdownToBlocks(input.content)
        await notion.blocks.children.append({
          block_id: input.block_id,
          children: blocksList as any
        })
        return {
          action: 'append',
          block_id: input.block_id,
          appended_count: blocksList.length
        }
      }

      case 'update': {
        if (!input.content) {
          throw new NotionMCPError('content required for update', 'VALIDATION_ERROR', 'Provide markdown content')
        }
        const block: any = await notion.blocks.retrieve({ block_id: input.block_id })
        const blockType = block.type
        const newBlocks = markdownToBlocks(input.content)

        if (newBlocks.length === 0) {
          throw new NotionMCPError('Content must produce at least one block', 'VALIDATION_ERROR', 'Invalid markdown')
        }

        const newContent = newBlocks[0]

        // Validate block type match
        if (newContent.type !== blockType) {
          throw new NotionMCPError(
            `Block type mismatch: cannot update ${blockType} with content that parses to ${newContent.type}`,
            'VALIDATION_ERROR',
            `Provide markdown that parses to ${blockType}`
          )
        }

        const updatePayload: any = {}

        // Build update based on block type
        if (
          [
            'paragraph',
            'heading_1',
            'heading_2',
            'heading_3',
            'bulleted_list_item',
            'numbered_list_item',
            'quote',
            'to_do',
            'code'
          ].includes(blockType)
        ) {
          if (blockType === 'to_do') {
            updatePayload.to_do = {
              rich_text: (newContent as any).to_do?.rich_text || [],
              checked: (newContent as any).to_do?.checked ?? block.to_do?.checked ?? false
            }
          } else if (blockType === 'code') {
            updatePayload.code = {
              rich_text: (newContent as any).code?.rich_text || [],
              language: (newContent as any).code?.language || block.code?.language || 'plain text'
            }
          } else {
            updatePayload[blockType] = {
              rich_text: (newContent as any)[blockType]?.rich_text || []
            }
          }
        } else {
          throw new NotionMCPError(
            `Block type '${blockType}' cannot be updated`,
            'VALIDATION_ERROR',
            'Only text-based blocks (paragraph, headings, lists, quote, to_do, code) can be updated'
          )
        }

        await notion.blocks.update({
          block_id: input.block_id,
          ...updatePayload
        } as any)

        return {
          action: 'update',
          block_id: input.block_id,
          type: blockType,
          updated: true
        }
      }

      case 'delete': {
        await notion.blocks.delete({ block_id: input.block_id })
        return {
          action: 'delete',
          block_id: input.block_id,
          deleted: true
        }
      }

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: get, children, append, update, delete'
        )
    }
  })()
}
