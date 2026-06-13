/**
 * Markdown Renderer for Notion Blocks
 * Converts Notion block format to markdown text
 */

import type { NotionBlock, RichText } from './markdown.js'

const CALLOUT_ICON_MAP: Record<string, string> = {
  ℹ️: 'NOTE',
  '💡': 'TIP',
  '❗': 'IMPORTANT',
  '⚠️': 'WARNING',
  '🛑': 'CAUTION',
  '✅': 'SUCCESS',
  '❌': 'ERROR'
}

function getCalloutTypeFromIcon(icon: string): string {
  return CALLOUT_ICON_MAP[icon] || 'NOTE'
}

function mediaToMarkdown(block: NotionBlock, lines: string[]): void {
  const mediaData = block[block.type]
  const mediaUrl = mediaData?.file?.url || mediaData?.external?.url || ''
  const mediaCaption = mediaData?.caption ? richTextToMarkdown(mediaData.caption) : ''
  const mediaName = mediaData?.name || mediaCaption || block.type
  lines.push(`[${mediaName}](${mediaUrl})`)
}

function indentChildren(children: NotionBlock[]): string {
  // Optimized: use highly optimized C++ RegExp engine instead of creating thousands of intermediate JS array/string objects
  return blocksToMarkdown(children).replace(/^/gm, '  ')
}

function calloutToMarkdown(block: NotionBlock, lines: string[]): void {
  const calloutText = richTextToMarkdown(block.callout.rich_text)
  const calloutIcon = block.callout.icon?.emoji || ''
  const calloutType = getCalloutTypeFromIcon(calloutIcon)
  lines.push(`> [!${calloutType}] ${calloutText}`)
  if (block.callout.children?.length > 0) {
    const childMd = blocksToMarkdown(block.callout.children)
    lines.push(childMd.replace(/^/gm, '> '))
  }
}

function toggleToMarkdown(block: NotionBlock, lines: string[]): void {
  const toggleText = richTextToMarkdown(block.toggle.rich_text)
  lines.push('<details>')
  lines.push(`<summary>${toggleText}</summary>`)
  if (block.toggle.children && block.toggle.children.length > 0) {
    lines.push('')
    lines.push(blocksToMarkdown(block.toggle.children))
  }
  lines.push('</details>')
}

function tableToMarkdown(block: NotionBlock, lines: string[]): void {
  const tableRows = block.table?.children || []
  if (tableRows.length > 0) {
    for (let rowIdx = 0; rowIdx < tableRows.length; rowIdx++) {
      const row = tableRows[rowIdx]
      const rawCells = row.table_row?.cells || []

      if (rawCells.length === 0) {
        lines.push('|  |')
        if (rowIdx === 0 && block.table?.has_column_header) {
          lines.push('|  |')
        }
        continue
      }

      let rowStr = '|'
      let headerSep = '|'
      const isFirstRowHeader = rowIdx === 0 && block.table?.has_column_header

      for (let i = 0; i < rawCells.length; i++) {
        // Optimization: Consolidate row cell rendering and header separator generation
        // into a single loop, eliminating redundant array mappings on cell data.
        rowStr += ` ${richTextToMarkdown(rawCells[i])} |`
        if (isFirstRowHeader) {
          headerSep += ' --- |'
        }
      }

      lines.push(rowStr)
      if (isFirstRowHeader) {
        lines.push(headerSep)
      }
    }
  }
}

function columnListToMarkdown(block: NotionBlock, lines: string[]): void {
  lines.push(':::columns')
  const columns = block.column_list?.children || []
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx]
    const ratio = col.column?.format?.column_ratio
    lines.push(ratio !== undefined ? `:::column{width=${ratio}}` : ':::column')
    const columnChildren = col.column?.children || []
    if (columnChildren.length > 0) {
      lines.push(blocksToMarkdown(columnChildren))
    }
    if (colIdx < columns.length - 1) {
      lines.push('')
    }
  }
  lines.push(':::end')
}

type BlockHandler = (block: NotionBlock, lines: string[]) => void

const BLOCK_HANDLERS: Record<string, BlockHandler> = {
  heading_1: (block, lines) => {
    lines.push(`# ${richTextToMarkdown(block.heading_1.rich_text)}`)
    if (block.heading_1.children?.length > 0) {
      lines.push(blocksToMarkdown(block.heading_1.children))
    }
  },
  heading_2: (block, lines) => {
    lines.push(`## ${richTextToMarkdown(block.heading_2.rich_text)}`)
    if (block.heading_2.children?.length > 0) {
      lines.push(blocksToMarkdown(block.heading_2.children))
    }
  },
  heading_3: (block, lines) => {
    lines.push(`### ${richTextToMarkdown(block.heading_3.rich_text)}`)
    if (block.heading_3.children?.length > 0) {
      lines.push(blocksToMarkdown(block.heading_3.children))
    }
  },
  paragraph: (block, lines) => {
    lines.push(richTextToMarkdown(block.paragraph.rich_text))
  },
  bulleted_list_item: (block, lines) => {
    lines.push(`- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`)
    if (block.bulleted_list_item.children?.length > 0) {
      lines.push(indentChildren(block.bulleted_list_item.children))
    }
  },
  numbered_list_item: (block, lines) => {
    lines.push(`1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`)
    if (block.numbered_list_item.children?.length > 0) {
      lines.push(indentChildren(block.numbered_list_item.children))
    }
  },
  to_do: (block, lines) => {
    lines.push(`- [${block.to_do.checked ? 'x' : ' '}] ${richTextToMarkdown(block.to_do.rich_text)}`)
    if (block.to_do.children?.length > 0) {
      lines.push(indentChildren(block.to_do.children))
    }
  },
  code: (block, lines) => {
    lines.push(`\`\`\`${block.code.language || ''}`)
    lines.push(richTextToMarkdown(block.code.rich_text))
    lines.push('```')
  },
  quote: (block, lines) => {
    lines.push(`> ${richTextToMarkdown(block.quote.rich_text)}`)
    if (block.quote.children?.length > 0) {
      const childMd = blocksToMarkdown(block.quote.children)
      lines.push(childMd.replace(/^/gm, '> '))
    }
  },
  divider: (_, lines) => {
    lines.push('---')
  },
  callout: (block, lines) => {
    calloutToMarkdown(block, lines)
  },
  toggle: (block, lines) => {
    toggleToMarkdown(block, lines)
  },
  image: (block, lines) => {
    const imageUrl = block.image?.file?.url || block.image?.external?.url || ''
    const caption = block.image?.caption ? richTextToMarkdown(block.image.caption) : ''
    lines.push(`![${caption}](${imageUrl})`)
  },
  bookmark: (block, lines) => {
    lines.push(`[bookmark](${block.bookmark.url})`)
  },
  embed: (block, lines) => {
    lines.push(`[embed](${block.embed.url})`)
  },
  equation: (block, lines) => {
    lines.push(`$$${block.equation.expression}$$`)
  },
  table: (block, lines) => {
    tableToMarkdown(block, lines)
  },
  column_list: (block, lines) => {
    columnListToMarkdown(block, lines)
  },
  table_of_contents: (_, lines) => {
    lines.push('[toc]')
  },
  breadcrumb: (_, lines) => {
    lines.push('[breadcrumb]')
  },
  file: (block, lines) => mediaToMarkdown(block, lines),
  pdf: (block, lines) => mediaToMarkdown(block, lines),
  video: (block, lines) => mediaToMarkdown(block, lines),
  audio: (block, lines) => mediaToMarkdown(block, lines),
  child_page: (block, lines) => {
    lines.push(`[${block.child_page.title}](${block.id})`)
  },
  child_database: (block, lines) => {
    lines.push(`[${block.child_database.title}](${block.id})`)
  }
}

export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = []

  for (const block of blocks) {
    const handler = BLOCK_HANDLERS[block.type]
    if (handler) {
      handler(block, lines)
    }
  }

  return lines.join('\n')
}

export function richTextToMarkdown(richText: RichText[]): string {
  if (!richText || !Array.isArray(richText)) return ''

  let result = ''
  for (let i = 0; i < richText.length; i++) {
    const rt = richText[i]
    if (!rt) continue

    // Handle mention elements
    if (rt.type === 'mention' && rt.mention) {
      const title = rt.plain_text || rt.text?.content || 'Untitled'
      const id = rt.mention.page?.id || rt.mention.database?.id || ''
      if (id) {
        result += `@[${title}](${id})`
        continue
      }
      // Fallback for other mention types (user, date, etc.)
      result += title
      continue
    }

    if (!rt.text) continue

    let text = rt.text.content || ''
    const annotations = rt.annotations || ({} as any)

    if (annotations.bold) text = `**${text}**`
    if (annotations.italic) text = `*${text}*`
    if (annotations.code) text = `\`${text}\``
    if (annotations.strikethrough) text = `~~${text}~~`
    if (rt.text.link) text = `[${text}](${rt.text.link.url})`
    result += text
  }

  return result
}
