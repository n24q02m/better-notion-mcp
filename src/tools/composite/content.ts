/**
 * Content Conversion Tool
 * Convert between Markdown and Notion blocks
 */

import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { blocksToMarkdown, markdownToBlocks } from '../helpers/markdown.js'

export interface ContentConvertInput {
  direction: 'markdown-to-blocks' | 'blocks-to-markdown'
  content: string | any[]
}

/**
 * Convert content between formats
 */
export async function contentConvert(input: ContentConvertInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.direction) {
      case 'markdown-to-blocks': {
        if (typeof input.content !== 'string') {
          throw new NotionMCPError(
            'Content must be a string for markdown-to-blocks',
            'VALIDATION_ERROR',
            'Provide a string content'
          )
        }
        const blocks = markdownToBlocks(input.content)
        return {
          direction: input.direction,
          block_count: blocks.length,
          blocks
        }
      }

      case 'blocks-to-markdown': {
        let content = input.content
        // Parse JSON string if needed
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content)
          } catch {
            throw new NotionMCPError(
              'Content must be a valid JSON array or array object for blocks-to-markdown',
              'VALIDATION_ERROR',
              'Provide a valid JSON array or object'
            )
          }
        }
        if (!Array.isArray(content)) {
          throw new NotionMCPError(
            'Content must be an array for blocks-to-markdown',
            'VALIDATION_ERROR',
            'Provide an array content'
          )
        }

        // Validate each block in the array
        for (const block of content) {
          if (!block || typeof block !== 'object') {
            throw new NotionMCPError(
              'Each block in the content array must be a valid object',
              'VALIDATION_ERROR',
              'Provide a valid array of block objects'
            )
          }
          if (!('type' in block)) {
            throw new NotionMCPError(
              'Each block in the content array must have a "type" property',
              'VALIDATION_ERROR',
              'Provide a valid array of block objects with "type" properties'
            )
          }
          if (typeof block.type !== 'string') {
            throw new NotionMCPError(
              'Each block in the content array must have a "type" string property',
              'VALIDATION_ERROR',
              'Provide a valid array of block objects with string "type" properties'
            )
          }
        }

        const markdown = blocksToMarkdown(content as any)
        return {
          direction: input.direction,
          char_count: markdown.length,
          markdown
        }
      }

      default:
        throw new NotionMCPError(
          `Unsupported direction: ${input.direction}`,
          'VALIDATION_ERROR',
          'Provide a valid direction'
        )
    }
  })()
}
