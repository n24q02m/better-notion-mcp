import type { NotionBlock } from './markdown.types.js'
import { getCalloutTypeFromIcon, richTextToMarkdown } from './markdown.utils.js'

export function indentChildren(children: NotionBlock[]): string {
  // Optimized: use highly optimized C++ RegExp engine instead of creating thousands of intermediate JS array/string objects
  return blocksToMarkdown(children).replace(/^/gm, '  ')
}

export function calloutToMarkdown(block: NotionBlock, lines: string[]): void {
  const calloutText = richTextToMarkdown(block.callout.rich_text)
  const calloutIcon = block.callout.icon?.emoji || ''
  const calloutType = getCalloutTypeFromIcon(calloutIcon)
  lines.push(`> [!${calloutType}] ${calloutText}`)
  if (block.callout.children?.length > 0) {
    const childMd = blocksToMarkdown(block.callout.children)
    lines.push(childMd.replace(/^/gm, '> '))
  }
}

export function toggleToMarkdown(block: NotionBlock, lines: string[]): void {
  const toggleText = richTextToMarkdown(block.toggle.rich_text)
  lines.push('<details>')
  lines.push(`<summary>${toggleText}</summary>`)
  if (block.toggle.children && block.toggle.children.length > 0) {
    lines.push('')
    lines.push(blocksToMarkdown(block.toggle.children))
  }
  lines.push('</details>')
}

export function tableToMarkdown(block: NotionBlock, lines: string[]): void {
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

export function columnListToMarkdown(block: NotionBlock, lines: string[]): void {
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
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'heading_1':
        lines.push(`# ${richTextToMarkdown(block.heading_1.rich_text)}`)
        if (block.heading_1.children?.length > 0) {
          lines.push(blocksToMarkdown(block.heading_1.children))
        }
        break
      case 'heading_2':
        lines.push(`## ${richTextToMarkdown(block.heading_2.rich_text)}`)
        if (block.heading_2.children?.length > 0) {
          lines.push(blocksToMarkdown(block.heading_2.children))
        }
        break
      case 'heading_3':
        lines.push(`### ${richTextToMarkdown(block.heading_3.rich_text)}`)
        if (block.heading_3.children?.length > 0) {
          lines.push(blocksToMarkdown(block.heading_3.children))
        }
        break
      case 'paragraph':
        lines.push(richTextToMarkdown(block.paragraph.rich_text))
        break
      case 'bulleted_list_item':
        lines.push(`- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`)
        if (block.bulleted_list_item.children?.length > 0) {
          lines.push(indentChildren(block.bulleted_list_item.children))
        }
        break
      case 'numbered_list_item':
        lines.push(`1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`)
        if (block.numbered_list_item.children?.length > 0) {
          lines.push(indentChildren(block.numbered_list_item.children))
        }
        break
      case 'to_do':
        lines.push(`- [${block.to_do.checked ? 'x' : ' '}] ${richTextToMarkdown(block.to_do.rich_text)}`)
        if (block.to_do.children?.length > 0) {
          lines.push(indentChildren(block.to_do.children))
        }
        break
      case 'code':
        lines.push(`\`\`\`${block.code.language || ''}`)
        lines.push(richTextToMarkdown(block.code.rich_text))
        lines.push('```')
        break
      case 'quote':
        lines.push(`> ${richTextToMarkdown(block.quote.rich_text)}`)
        if (block.quote.children?.length > 0) {
          const childMd = blocksToMarkdown(block.quote.children)
          lines.push(childMd.replace(/^/gm, '> '))
        }
        break
      case 'divider':
        lines.push('---')
        break
      case 'callout':
        calloutToMarkdown(block, lines)
        break
      case 'toggle':
        toggleToMarkdown(block, lines)
        break
      case 'image': {
        const imageUrl = block.image?.file?.url || block.image?.external?.url || ''
        const caption = block.image?.caption ? richTextToMarkdown(block.image.caption) : ''
        lines.push(`![${caption}](${imageUrl})`)
        break
      }
      case 'bookmark':
        lines.push(`[bookmark](${block.bookmark.url})`)
        break
      case 'embed':
        lines.push(`[embed](${block.embed.url})`)
        break
      case 'equation':
        lines.push(`$$${block.equation.expression}$$`)
        break
      case 'table':
        tableToMarkdown(block, lines)
        break
      case 'column_list':
        columnListToMarkdown(block, lines)
        break
      case 'table_of_contents':
        lines.push('[toc]')
        break
      case 'breadcrumb':
        lines.push('[breadcrumb]')
        break
      case 'file':
      case 'pdf':
      case 'video':
      case 'audio': {
        const mediaData = block[block.type]
        const mediaUrl = mediaData?.file?.url || mediaData?.external?.url || ''
        const mediaCaption = mediaData?.caption ? richTextToMarkdown(mediaData.caption) : ''
        const mediaName = mediaData?.name || mediaCaption || block.type
        lines.push(`[${mediaName}](${mediaUrl})`)
        break
      }
      case 'child_page':
        lines.push(`[${block.child_page.title}](${block.id})`)
        break
      case 'child_database':
        lines.push(`[${block.child_database.title}](${block.id})`)
        break
      default:
        // Unsupported block type, skip
        break
    }
  }

  return lines.join('\n')
}
