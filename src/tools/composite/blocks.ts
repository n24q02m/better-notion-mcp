/**
 * Blocks Mega Tool
 * All block operations in one unified interface
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { blocksToMarkdown, markdownToBlocks } from '../helpers/markdown.js'
import { autoPaginate, populateDeepChildren } from '../helpers/pagination.js'

const UPDATABLE_BLOCK_TYPES = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'quote',
  'to_do',
  'code'
])

export interface GetBlockResult {
  action: 'get'
  block_id: string
  type: string
  has_children: boolean
  archived: boolean
  block: any
}

export interface GetBlockChildrenResult {
  action: 'children'
  block_id: string
  total_children: number
  markdown: string
  blocks: any[]
}

export interface AppendToBlockResult {
  action: 'append'
  block_id: string
  appended_count: number
}

export interface UpdateBlockResult {
  action: 'update'
  block_id: string
  type: string
  updated: true
}

export interface DeleteBlockResult {
  action: 'delete'
  block_id: string
  deleted: true
}

export type BlocksResult =
  | GetBlockResult
  | GetBlockChildrenResult
  | AppendToBlockResult
  | UpdateBlockResult
  | DeleteBlockResult

export interface BlocksInput {
  action: 'get' | 'children' | 'append' | 'update' | 'delete'
  block_id: string
  content?: string // Markdown format
  position?: 'start' | 'end' | 'after_block'
  after_block_id?: string
}

/**
 * Unified blocks tool
 * Maps to: GET/PATCH/DELETE /v1/blocks/{id} and GET/PATCH /v1/blocks/{id}/children
 */
export async function blocks(notion: Client, input: BlocksInput): Promise<BlocksResult> {
  return withErrorHandling(async () => {
    if (!input.block_id) {
      throw new NotionMCPError('block_id required', 'VALIDATION_ERROR', 'Provide block_id')
    }

    switch (input.action) {
      case 'get':
        return await getBlock(notion, input)

      case 'children':
        return await getBlockChildren(notion, input)

      case 'append':
        return await appendToBlock(notion, input)

      case 'update':
        return await updateBlock(notion, input)

      case 'delete':
        return await deleteBlock(notion, input)

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: get, children, append, update, delete'
        )
    }
  })()
}

/**
 * Retrieve single block
 * Maps to: GET /v1/blocks/{id}
 */
async function getBlock(notion: Client, input: BlocksInput): Promise<GetBlockResult> {
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

/**
 * List child blocks
 * Maps to: GET /v1/blocks/{id}/children
 */
async function getBlockChildren(notion: Client, input: BlocksInput): Promise<GetBlockChildrenResult> {
  const blocksList = await autoPaginate((cursor) =>
    notion.blocks.children.list({
      block_id: input.block_id,
      start_cursor: cursor,
      page_size: 100
    })
  )

  // Recursively fetch children for blocks that need them (tables, toggles, columns)
  await populateDeepChildren(notion, blocksList as any[])

  const markdown = blocksToMarkdown(blocksList as any)
  return {
    action: 'children',
    block_id: input.block_id,
    total_children: blocksList.length,
    markdown,
    blocks: blocksList
  }
}

/**
 * Add markdown content at position
 * Maps to: PATCH /v1/blocks/{id}/children
 */
async function appendToBlock(notion: Client, input: BlocksInput): Promise<AppendToBlockResult> {
  if (!input.content) {
    throw new NotionMCPError('content required for append', 'VALIDATION_ERROR', 'Provide markdown content')
  }
  if (input.position === 'after_block' && !input.after_block_id) {
    throw new NotionMCPError(
      'after_block_id required when position is after_block',
      'VALIDATION_ERROR',
      'Provide after_block_id with the block ID to insert after'
    )
  }
  const blocksList = markdownToBlocks(input.content)
  const appendParams: any = {
    block_id: input.block_id,
    children: blocksList as any
  }
  if (input.position === 'start') {
    appendParams.position = { type: 'start' }
  } else if (input.position === 'after_block' && input.after_block_id) {
    appendParams.position = { type: 'after_block', after_block: { id: input.after_block_id } }
  }
  await notion.blocks.children.append(appendParams)
  return {
    action: 'append',
    block_id: input.block_id,
    appended_count: blocksList.length
  }
}

/**
 * Replace text block content
 * Maps to: PATCH /v1/blocks/{id}
 */
async function updateBlock(notion: Client, input: BlocksInput): Promise<UpdateBlockResult> {
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
  if (UPDATABLE_BLOCK_TYPES.has(blockType)) {
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

/**
 * Remove block
 * Maps to: DELETE /v1/blocks/{id}
 */
async function deleteBlock(notion: Client, input: BlocksInput): Promise<DeleteBlockResult> {
  await notion.blocks.delete({ block_id: input.block_id })
  return {
    action: 'delete',
    block_id: input.block_id,
    deleted: true
  }
}
