/**
 * Pages Mega Tool
 * All page operations in one unified interface
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { blocksToMarkdown, markdownToBlocks } from '../helpers/markdown.js'
import { autoPaginate, processBatches } from '../helpers/pagination.js'
import { convertToNotionProperties } from '../helpers/properties.js'
import * as RichText from '../helpers/richtext.js'

export interface PagesInput {
  action: 'create' | 'get' | 'get_property' | 'update' | 'move' | 'archive' | 'restore' | 'duplicate'

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

  // get_property params
  property_id?: string

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

      case 'get_property':
        return await getPageProperty(notion, input)

      case 'update':
        return await updatePage(notion, input)

      case 'move':
        return await movePage(notion, input)

      case 'archive':
      case 'restore':
        return await archivePage(notion, input)

      case 'duplicate':
        return await duplicatePage(notion, input)

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: create, get, get_property, update, move, archive, restore, duplicate'
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
  const properties: any = {}
  for (const [key, prop] of Object.entries(page.properties)) {
    const p = prop as any
    if (p.type === 'title' && p.title) {
      properties[key] = p.title.map((t: any) => t.plain_text).join('')
    } else if (p.type === 'rich_text' && p.rich_text) {
      properties[key] = p.rich_text.map((t: any) => t.plain_text).join('')
    } else if (p.type === 'select' && p.select) {
      properties[key] = p.select.name
    } else if (p.type === 'multi_select' && p.multi_select) {
      properties[key] = p.multi_select.map((s: any) => s.name)
    } else if (p.type === 'number') {
      properties[key] = p.number
    } else if (p.type === 'checkbox') {
      properties[key] = p.checkbox
    } else if (p.type === 'url') {
      properties[key] = p.url
    } else if (p.type === 'email') {
      properties[key] = p.email
    } else if (p.type === 'phone_number') {
      properties[key] = p.phone_number
    } else if (p.type === 'date' && p.date) {
      properties[key] = p.date.start + (p.date.end ? ` to ${p.date.end}` : '')
    } else if (p.type === 'relation' && p.relation) {
      properties[key] = p.relation.map((r: any) => r.id)
    } else if (p.type === 'rollup' && p.rollup) {
      properties[key] = p.rollup
    } else if (p.type === 'people' && p.people) {
      properties[key] = p.people.map((person: any) => person.name || person.id)
    } else if (p.type === 'files' && p.files) {
      properties[key] = p.files.map((f: any) => f.file?.url || f.external?.url || f.name)
    } else if (p.type === 'formula' && p.formula) {
      const formula = p.formula
      properties[key] = formula[formula.type]
    } else if (p.type === 'created_time') {
      properties[key] = p.created_time
    } else if (p.type === 'last_edited_time') {
      properties[key] = p.last_edited_time
    } else if (p.type === 'created_by' && p.created_by) {
      properties[key] = p.created_by.name || p.created_by.id
    } else if (p.type === 'last_edited_by' && p.last_edited_by) {
      properties[key] = p.last_edited_by.name || p.last_edited_by.id
    } else if (p.type === 'status' && p.status) {
      properties[key] = p.status.name
    } else if (p.type === 'unique_id' && p.unique_id) {
      properties[key] = p.unique_id.prefix ? `${p.unique_id.prefix}-${p.unique_id.number}` : p.unique_id.number
    }
  }

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
 * Retrieve a page property item (supports paginated properties like relation, rollup, rich_text)
 * Maps to: GET /v1/pages/{id}/properties/{property_id}
 */
async function getPageProperty(notion: Client, input: PagesInput): Promise<any> {
  if (!input.page_id) {
    throw new NotionMCPError('page_id is required for get_property action', 'VALIDATION_ERROR', 'Provide page_id')
  }

  if (!input.property_id) {
    throw new NotionMCPError(
      'property_id is required for get_property action',
      'VALIDATION_ERROR',
      'Provide property_id (from page properties metadata)'
    )
  }

  // Fetch with auto-pagination for paginated property items
  const allResults = await autoPaginate(async (cursor) => {
    const response: any = await notion.pages.properties.retrieve({
      page_id: input.page_id!,
      property_id: input.property_id!,
      start_cursor: cursor,
      page_size: 100
    } as any)

    // Non-paginated property items return the value directly (no results array)
    if (!response.results) {
      return {
        results: [response],
        next_cursor: null,
        has_more: false
      }
    }

    return {
      results: response.results,
      next_cursor: response.next_cursor,
      has_more: response.has_more
    }
  })

  // Format results based on property type
  const firstResult = allResults[0] as any
  const propertyType = firstResult?.type

  let value: any
  switch (propertyType) {
    case 'title':
    case 'rich_text':
      value = allResults.map((item: any) => item[propertyType]?.plain_text || '').join('')
      break
    case 'relation':
      value = allResults.map((item: any) => item.relation?.id).filter(Boolean)
      break
    case 'rollup':
      value = firstResult.rollup
      break
    case 'people':
      value = allResults.map((item: any) => ({
        id: item.people?.id,
        name: item.people?.name
      }))
      break
    default:
      // For non-paginated types, return the raw value
      value = firstResult?.[propertyType] ?? firstResult
      break
  }

  return {
    action: 'get_property',
    page_id: input.page_id,
    property_id: input.property_id,
    type: propertyType,
    value
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
      let cursor: string | undefined
      let hasMore = true
      const deletionPromises: Promise<any>[] = []

      while (hasMore) {
        const response = await notion.blocks.children.list({
          block_id: input.page_id!,
          start_cursor: cursor,
          page_size: 100
        })

        const blocksToDelete = response.results
        if (blocksToDelete.length > 0) {
          // Process deletion in background while fetching next page
          deletionPromises.push(
            processBatches(blocksToDelete, async (block) => {
              await notion.blocks.delete({ block_id: block.id })
            })
          )
        }

        cursor = response.next_cursor || undefined
        hasMore = response.has_more
      }

      // Wait for all deletions to complete
      await Promise.all(deletionPromises)

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
 * Move page to a new parent
 * Maps to: POST /v1/pages/{id}/move
 */
async function movePage(notion: Client, input: PagesInput): Promise<any> {
  if (!input.page_id) {
    throw new NotionMCPError('page_id is required for move action', 'VALIDATION_ERROR', 'Provide page_id')
  }

  if (!input.parent_id) {
    throw new NotionMCPError(
      'parent_id is required for move action',
      'VALIDATION_ERROR',
      'Provide parent_id (target page ID to move into)'
    )
  }

  const normalizedParentId = input.parent_id.replace(/-/g, '')

  // SDK types don't include parent in UpdatePageParameters, but the API supports it
  await (notion.pages as any).update({
    page_id: input.page_id,
    parent: { type: 'page_id', page_id: normalizedParentId }
  })

  return {
    action: 'move',
    page_id: input.page_id,
    new_parent_id: normalizedParentId,
    moved: true
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
      const duplicatedPage: any = await notion.pages.create({
        parent,
        properties: originalPage.properties,
        icon: originalPage.icon,
        cover: originalPage.cover
      })

      // Copy content
      if (originalBlocks.length > 0) {
        await notion.blocks.children.append({
          block_id: duplicatedPage.id,
          children: originalBlocks as any
        })
      }

      return {
        original_id: pageId,
        duplicate_id: duplicatedPage.id,
        url: duplicatedPage.url
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
