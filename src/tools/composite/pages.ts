/**
 * Pages Mega Tool
 * All page operations in one unified interface
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { blocksToMarkdown, markdownToBlocks } from '../helpers/markdown.js'
import { autoPaginate, processBatches } from '../helpers/pagination.js'
import { convertToNotionProperties, extractProperties } from '../helpers/properties.js'
import * as RichText from '../helpers/richtext.js'

export interface PagesInput {
  action: 'create' | 'get' | 'update' | 'archive' | 'restore' | 'duplicate'

  // Common params
  page_id?: string
  page_ids?: string[]

  // Create/Update params
  title?: string
  content?: string // Markdown
  append_content?: string
  parent_id?: string
  properties?: Record<string, any>
  icon?: string
  cover?: string

  // Archive/Restore params
  archived?: boolean
}

/**
 * Unified pages tool - handles all page operations
 */
export async function pages(notion: Client, input: PagesInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'create':
        return await createPage(notion, input)

      case 'get':
        return await getPage(notion, input)

      case 'update':
        return await updatePage(notion, input)

      case 'archive':
      case 'restore':
        return await archivePage(notion, input)

      case 'duplicate':
        return await duplicatePage(notion, input)

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: create, get, update, archive, restore, duplicate'
        )
    }
  })()
}

/**
 * Create page with title and content
 * Maps to: POST /v1/pages + PATCH /v1/blocks/{id}/children
 */
async function createPage(notion: Client, input: PagesInput): Promise<any> {
  if (!input.title) {
    throw new NotionMCPError('title is required for create action', 'VALIDATION_ERROR', 'Provide page title')
  }

  if (!input.parent_id) {
    throw new NotionMCPError(
      'parent_id is required for page creation',
      'VALIDATION_ERROR',
      'Integration tokens cannot create workspace-level pages. Provide parent_id (database or page ID).'
    )
  }

  const normalizedId = input.parent_id.replace(/-/g, '')

  // Auto-detect parent type
  let parent: any
  if (input.properties && Object.keys(input.properties).length > 0) {
    parent = { type: 'database_id', database_id: normalizedId }
  } else {
    parent = { type: 'page_id', page_id: normalizedId }
  }

  // Prepare properties
  let properties: any = {}
  if (parent.database_id) {
    properties = convertToNotionProperties(input.properties || {})
    if (!properties.title && !properties.Name && !properties.Title) {
      properties.Name = { title: [RichText.text(input.title)] }
    }
  } else {
    properties = { title: { title: [RichText.text(input.title)] } }
  }

  const pageData: any = { parent, properties }
  if (input.icon) pageData.icon = { type: 'emoji', emoji: input.icon }
  if (input.cover) pageData.cover = { type: 'external', external: { url: input.cover } }

  const page = await notion.pages.create(pageData)

  // Add content if provided
  if (input.content) {
    const blocks = markdownToBlocks(input.content)
    if (blocks.length > 0) {
      await notion.blocks.children.append({
        block_id: page.id,
        children: blocks as any
      })
    }
  }

  return {
    action: 'create',
    page_id: page.id,
    url: (page as any).url,
    created: true
  }
}

/**
 * Get page with full content as markdown
 * Maps to: GET /v1/pages/{id} + GET /v1/blocks/{id}/children
 */
async function getPage(notion: Client, input: PagesInput): Promise<any> {
  if (!input.page_id) {
    throw new NotionMCPError('page_id is required for get action', 'VALIDATION_ERROR', 'Provide page_id')
  }

  const page: any = await notion.pages.retrieve({ page_id: input.page_id })

  // Get all blocks with auto-pagination
  const blocks = await autoPaginate((cursor) =>
    notion.blocks.children.list({
      block_id: input.page_id!,
      start_cursor: cursor,
      page_size: 100
    })
  )

  const markdown = blocksToMarkdown(blocks as any)

  // Extract properties
  const properties = extractProperties(page.properties)

  return {
    action: 'get',
    page_id: page.id,
    url: page.url,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    archived: page.archived,
    properties,
    content: markdown,
    block_count: blocks.length
  }
}

/**
 * Update page content/properties
 * Maps to: PATCH /v1/pages/{id} + PATCH /v1/blocks/{id}/children
 */
async function updatePage(notion: Client, input: PagesInput): Promise<any> {
  if (!input.page_id) {
    throw new NotionMCPError('page_id is required for update action', 'VALIDATION_ERROR', 'Provide page_id')
  }

  const updates: any = {}

  // Update metadata
  if (input.icon) updates.icon = { type: 'emoji', emoji: input.icon }
  if (input.cover) updates.cover = { type: 'external', external: { url: input.cover } }
  if (input.archived !== undefined) updates.archived = input.archived

  // Update properties
  if (input.properties || input.title) {
    updates.properties = {}

    if (input.title) {
      updates.properties.title = { title: [RichText.text(input.title)] }
    }

    if (input.properties) {
      const converted = convertToNotionProperties(input.properties)
      updates.properties = { ...updates.properties, ...converted }
    }
  }

  // Update page if we have metadata/property changes
  if (Object.keys(updates).length > 0) {
    await notion.pages.update({
      page_id: input.page_id,
      ...updates
    })
  }

  // Handle content updates
  if (input.content || input.append_content) {
    if (input.content) {
      // Replace all content
      const existingBlocks = await autoPaginate((cursor) =>
        notion.blocks.children.list({
          block_id: input.page_id!,
          start_cursor: cursor,
          page_size: 100
        })
      )

      await processBatches(existingBlocks, async (block) => {
        await notion.blocks.delete({ block_id: block.id })
      })

      const newBlocks = markdownToBlocks(input.content)
      if (newBlocks.length > 0) {
        await notion.blocks.children.append({
          block_id: input.page_id,
          children: newBlocks as any
        })
      }
    } else if (input.append_content) {
      const blocks = markdownToBlocks(input.append_content)
      if (blocks.length > 0) {
        await notion.blocks.children.append({
          block_id: input.page_id,
          children: blocks as any
        })
      }
    }
  }

  return {
    action: 'update',
    page_id: input.page_id,
    updated: true
  }
}

/**
 * Archive or restore page
 * Maps to: PATCH /v1/pages/{id}
 */
async function archivePage(notion: Client, input: PagesInput): Promise<any> {
  const pageIds = input.page_ids || (input.page_id ? [input.page_id] : [])

  if (pageIds.length === 0) {
    throw new NotionMCPError('page_id or page_ids required', 'VALIDATION_ERROR', 'Provide at least one page ID')
  }

  const archived = input.action === 'archive'
  const results = await processBatches(
    pageIds,
    async (pageId) => {
      await notion.pages.update({
        page_id: pageId,
        archived
      })
      return { page_id: pageId, archived }
    },
    { batchSize: 1, concurrency: 5 }
  )

  return {
    action: input.action,
    processed: results.length,
    results
  }
}

/**
 * Move page to new parent
 * Maps to: PATCH /v1/pages/{id}
 */
/**
 * Duplicate page
 * Maps to: GET /v1/pages/{id} + POST /v1/pages + GET/PATCH /v1/blocks
 */
async function duplicatePage(notion: Client, input: PagesInput): Promise<any> {
  const pageIds = input.page_ids || (input.page_id ? [input.page_id] : [])

  if (pageIds.length === 0) {
    throw new NotionMCPError('page_id or page_ids required', 'VALIDATION_ERROR', 'Provide at least one page ID')
  }

  // Process duplicates in batches to improve performance while respecting rate limits
  const results = await processBatches(
    pageIds,
    async (pageId) => {
      // Get original page
      const originalPage: any = await notion.pages.retrieve({ page_id: pageId })

      // Get original content
      const originalBlocks = await autoPaginate((cursor) =>
        notion.blocks.children.list({
          block_id: pageId,
          start_cursor: cursor,
          page_size: 100
        })
      )

      // Sanitize parent - API response may include extra fields that
      // the create endpoint rejects (e.g. database_id in data_source parent)
      const rawParent = originalPage.parent
      let parent: any
      if (rawParent.type === 'data_source_id') {
        parent = { type: 'data_source_id', data_source_id: rawParent.data_source_id }
      } else if (rawParent.type === 'database_id') {
        parent = { type: 'database_id', database_id: rawParent.database_id }
      } else if (rawParent.type === 'page_id') {
        parent = { type: 'page_id', page_id: rawParent.page_id }
      } else {
        parent = rawParent
      }

      // Create duplicate
      const duplicatePage: any = await notion.pages.create({
        parent,
        properties: originalPage.properties,
        icon: originalPage.icon,
        cover: originalPage.cover
      })

      // Copy content
      if (originalBlocks.length > 0) {
        await notion.blocks.children.append({
          block_id: duplicatePage.id,
          children: originalBlocks as any
        })
      }

      return {
        original_id: pageId,
        duplicate_id: duplicatePage.id,
        url: duplicatePage.url
      }
    },
    { batchSize: 5, concurrency: 3 }
  )

  return {
    action: 'duplicate',
    processed: results.length,
    results
  }
}
