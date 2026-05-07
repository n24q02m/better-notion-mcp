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
          throw NotionMCPError.validation('Content must be a string for markdown-to-blocks', 'Provide a string content')
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
            throw NotionMCPError.validation(
              'Content must be a valid JSON array or array object for blocks-to-markdown',
              'Provide a valid JSON array or object'
            )
          }
        }
        if (!Array.isArray(content)) {
          throw NotionMCPError.validation('Content must be an array for blocks-to-markdown', 'Provide an array content')
        }
        if (!content.every((b) => typeof b === 'object' && b !== null)) {
          throw NotionMCPError.validation(
            'Content must be an array of objects for blocks-to-markdown',
            'Provide an array of block objects'
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
        throw NotionMCPError.validation(`Unsupported direction: ${input.direction}`, 'Provide a valid direction')
    }
  })()
}
