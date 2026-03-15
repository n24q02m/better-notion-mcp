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
            'Ensure content is a string'
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
              'Ensure content is a valid JSON string representing an array'
            )
          }
        }
        if (!Array.isArray(content)) {
          throw new NotionMCPError(
            'Content must be an array for blocks-to-markdown',
            'VALIDATION_ERROR',
            'Ensure content is an array'
          )
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
          'Use "markdown-to-blocks" or "blocks-to-markdown"'
        )
    }
  })()
}
