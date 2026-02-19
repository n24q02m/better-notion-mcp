/**
 * Blocks Mega Tool
 * All block operations in one unified interface
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { blocksToMarkdown, markdownToBlocks } from '../helpers/markdown.js'
import { autoPaginate } from '../helpers/pagination.js'

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
        const currentType = block.type
        const newBlocks = markdownToBlocks(input.content)

        if (newBlocks.length === 0) {
          throw new NotionMCPError('Content must produce at least one block', 'VALIDATION_ERROR', 'Invalid markdown')
        }

        const newContent = newBlocks[0]
        const targetType = newContent.type
        const updatePayload: any = {}

        const supportedTypes = [
          'paragraph',
          'heading_1',
          'heading_2',
          'heading_3',
          'bulleted_list_item',
          'numbered_list_item',
          'quote'
        ]

        // Ensure we are updating a supported block type
        if (!supportedTypes.includes(currentType)) {
          throw new NotionMCPError(
            `Block type '${currentType}' cannot be updated`,
            'VALIDATION_ERROR',
            'Only text blocks can be updated'
          )
        }

        // Check if the target block type is supported for update/conversion
        if (supportedTypes.includes(targetType)) {
          updatePayload.type = targetType
          updatePayload[targetType] = (newContent as any)[targetType]
        } else {
          throw new NotionMCPError(
            `Markdown parsed to unsupported type '${targetType}' for update`,
            'VALIDATION_ERROR',
            `Update only supports: ${supportedTypes.join(', ')}`
          )
        }

        await notion.blocks.update({
          block_id: input.block_id,
          ...updatePayload
        } as any)

        return {
          action: 'update',
          block_id: input.block_id,
          type: targetType,
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
