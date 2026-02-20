/**
 * Markdown to Notion Blocks Converter
 * Converts markdown text to Notion block format
 * Supports: headings, paragraphs, lists, code, quotes, dividers,
 *           tables, toggles, callouts, images, bookmarks, embeds,
 *           equations, columns, table of contents, breadcrumb
 */

export interface NotionBlock {
  object: 'block'
  type: string
  [key: string]: any
}

export interface RichText {
  type: 'text'
  text: {
    content: string
    link?: { url: string } | null
  }
  annotations: {
    bold: boolean
    italic: boolean
    strikethrough: boolean
    underline: boolean
    code: boolean
    color: string
  }
  plain_text?: string
  href?: string | null
}

/**
 * Convert markdown string to Notion blocks
 */
export function markdownToBlocks(markdown: string): NotionBlock[] {
  const lines = markdown.split('\n')
  const blocks: NotionBlock[] = []
  let currentList: NotionBlock[] = []
  let currentListType: 'bulleted' | 'numbered' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Flush list if we're not in a list anymore
    if (currentListType && !isListItem(line)) {
      blocks.push(...currentList)
      currentList = []
      currentListType = null
    }

    // Skip empty lines
    if (!line.trim()) {
      continue
    }

    // Table of Contents [toc]
    if (line.trim() === '[toc]' || line.trim() === '[TOC]') {
      blocks.push(createTableOfContents())
      continue
    }

    // Breadcrumb [breadcrumb]
    if (line.trim() === '[breadcrumb]' || line.trim() === '[BREADCRUMB]') {
      blocks.push(createBreadcrumb())
      continue
    }

    // Equation block $$...$$
    if (line.trim().startsWith('$$')) {
      if (line.trim().endsWith('$$') && line.trim().length > 4) {
        // Single line equation: $$expression$$
        const expression = line.trim().slice(2, -2).trim()
        blocks.push(createEquation(expression))
        continue
      }
      // Multi-line equation
      const eqLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('$$')) {
        eqLines.push(lines[i])
        i++
      }
      blocks.push(createEquation(eqLines.join('\n')))
      continue
    }

    // Callout > [!TYPE] content or > [!TYPE]\n> content
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|SUCCESS|ERROR)\]\s*(.*)/i)
    if (calloutMatch) {
      const calloutType = calloutMatch[1].toUpperCase()
      let calloutContent = calloutMatch[2] || ''

      // Collect continuation lines (lines starting with >)
      while (i + 1 < lines.length && lines[i + 1].startsWith('> ')) {
        i++
        calloutContent += (calloutContent ? '\n' : '') + lines[i].slice(2)
      }

      const icon = getCalloutIcon(calloutType)
      const color = getCalloutColor(calloutType)
      blocks.push(createCallout(calloutContent || calloutType, icon, color))
      continue
    }

    // Image ![alt](url)
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imageMatch) {
      blocks.push(createImage(imageMatch[2], imageMatch[1]))
      continue
    }

    // Bookmark/Embed [bookmark](url) or [embed](url)
    const bookmarkMatch = line.match(/^\[(bookmark|embed)\]\(([^)]+)\)$/i)
    if (bookmarkMatch) {
      const type = bookmarkMatch[1].toLowerCase()
      const url = bookmarkMatch[2]
      if (type === 'embed') {
        blocks.push(createEmbed(url))
      } else {
        blocks.push(createBookmark(url))
      }
      continue
    }

    // Toggle <details><summary>Title</summary>
    if (line.trim() === '<details>' || line.trim().startsWith('<details>')) {
      const toggleData = parseToggle(lines, i)
      blocks.push(createToggle(toggleData.title, toggleData.children))
      i = toggleData.endIndex
      continue
    }

    // Column layout :::columns
    if (line.trim() === ':::columns') {
      const columnData = parseColumns(lines, i)
      blocks.push(createColumnList(columnData.columns))
      i = columnData.endIndex
      continue
    }

    // Table (pipe-delimited)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableData = parseTable(lines, i)
      if (tableData) {
        blocks.push(createTable(tableData.headers, tableData.rows, tableData.hasHeader))
        i = tableData.endIndex
        continue
      }
    }

    // Heading
    if (line.startsWith('# ')) {
      blocks.push(createHeading(1, line.slice(2)))
    } else if (line.startsWith('## ')) {
      blocks.push(createHeading(2, line.slice(3)))
    } else if (line.startsWith('### ')) {
      blocks.push(createHeading(3, line.slice(4)))
    }
    // Code block
    else if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push(createCodeBlock(codeLines.join('\n'), language))
    }
    // Task list / Checkbox list - [ ] or - [x]
    else if (line.match(/^[-*]\s\[([ xX])\]\s/)) {
      const checked = line[3] !== ' '
      const text = line.replace(/^[-*]\s\[([ xX])\]\s/, '')
      currentListType = 'bulleted'
      currentList.push(createTodoItem(text, checked))
    }
    // Bulleted list
    else if (line.match(/^[-*]\s/)) {
      const text = line.slice(2)
      currentListType = 'bulleted'
      currentList.push(createBulletedListItem(text))
    }
    // Numbered list
    else if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s/, '')
      currentListType = 'numbered'
      currentList.push(createNumberedListItem(text))
    }
    // Quote
    else if (line.startsWith('> ')) {
      blocks.push(createQuote(line.slice(2)))
    }
    // Divider
    else if (line.match(/^[-*]{3,}$/)) {
      blocks.push(createDivider())
    }
    // Regular paragraph
    else {
      blocks.push(createParagraph(line))
    }
  }

  // Flush remaining list
  if (currentList.length > 0) {
    blocks.push(...currentList)
  }

  return blocks
}

/**
 * Convert Notion blocks to markdown
 */
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'heading_1':
        lines.push(`# ${richTextToMarkdown(block.heading_1.rich_text)}`)
        break
      case 'heading_2':
        lines.push(`## ${richTextToMarkdown(block.heading_2.rich_text)}`)
        break
      case 'heading_3':
        lines.push(`### ${richTextToMarkdown(block.heading_3.rich_text)}`)
        break
      case 'paragraph':
        lines.push(richTextToMarkdown(block.paragraph.rich_text))
        break
      case 'bulleted_list_item':
        lines.push(`- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`)
        break
      case 'numbered_list_item':
        lines.push(`1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`)
        break
      case 'to_do':
        lines.push(`- [${block.to_do.checked ? 'x' : ' '}] ${richTextToMarkdown(block.to_do.rich_text)}`)
        break
      case 'code':
        lines.push(`\`\`\`${block.code.language || ''}`)
        lines.push(richTextToMarkdown(block.code.rich_text))
        lines.push('```')
        break
      case 'quote':
        lines.push(`> ${richTextToMarkdown(block.quote.rich_text)}`)
        break
      case 'divider':
        lines.push('---')
        break
      case 'callout': {
        const calloutText = richTextToMarkdown(block.callout.rich_text)
        const calloutIcon = block.callout.icon?.emoji || ''
        const calloutType = getCalloutTypeFromIcon(calloutIcon)
        lines.push(`> [!${calloutType}] ${calloutText}`)
        break
      }
      case 'toggle': {
        const toggleText = richTextToMarkdown(block.toggle.rich_text)
        lines.push('<details>')
        lines.push(`<summary>${toggleText}</summary>`)
        if (block.toggle.children && block.toggle.children.length > 0) {
          lines.push('')
          lines.push(blocksToMarkdown(block.toggle.children))
        }
        lines.push('</details>')
        break
      }
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
      case 'table': {
        const tableRows = block.table?.children || []
        if (tableRows.length > 0) {
          for (let rowIdx = 0; rowIdx < tableRows.length; rowIdx++) {
            const row = tableRows[rowIdx]
            const cells = (row.table_row?.cells || []).map((cell: RichText[]) => richTextToMarkdown(cell))
            lines.push(`| ${cells.join(' | ')} |`)
            // Add header separator after first row if table has column header
            if (rowIdx === 0 && block.table?.has_column_header) {
              lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
            }
          }
        }
        break
      }
      case 'column_list': {
        lines.push(':::columns')
        const columns = block.column_list?.children || []
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          lines.push(':::column')
          const columnChildren = columns[colIdx].column?.children || []
          if (columnChildren.length > 0) {
            lines.push(blocksToMarkdown(columnChildren))
          }
          if (colIdx < columns.length - 1) {
            lines.push('')
          }
        }
        lines.push(':::end')
        break
      }
      case 'table_of_contents':
        lines.push('[toc]')
        break
      case 'breadcrumb':
        lines.push('[breadcrumb]')
        break
      default:
        // Unsupported block type, skip
        break
    }
  }

  return lines.join('\n')
}

/**
 * Parse inline markdown formatting to rich text
 * Supports: bold, italic, code, strikethrough, links, mentions, colors
 */
export function parseRichText(text: string): RichText[] {
  const richText: RichText[] = []
  let current = ''
  let bold = false
  let italic = false
  let code = false
  let strikethrough = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    // Link [text](url)
    if (char === '[') {
      const closeBracket = text.indexOf(']', i)
      const openParen = closeBracket !== -1 ? text.indexOf('(', closeBracket) : -1
      const closeParen = openParen !== -1 ? text.indexOf(')', openParen) : -1

      if (closeBracket !== -1 && openParen === closeBracket + 1 && closeParen !== -1) {
        if (current) {
          richText.push(createRichText(current, { bold, italic, code, strikethrough }))
          current = ''
        }

        const linkText = text.slice(i + 1, closeBracket)
        const linkUrl = text.slice(openParen + 1, closeParen)

        richText.push({
          type: 'text',
          text: { content: linkText, link: { url: linkUrl } },
          annotations: {
            bold,
            italic,
            strikethrough,
            underline: false,
            code,
            color: 'default'
          }
        })

        i = closeParen
        continue
      }
    }

    // Bold **text**
    if (char === '*' && next === '*') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      bold = !bold
      i++ // Skip next *
      continue
    }
    // Italic *text*
    else if (char === '*' && next !== '*') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      italic = !italic
      continue
    }
    // Code `text`
    else if (char === '`') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      code = !code
      continue
    }
    // Strikethrough ~~text~~
    else if (char === '~' && next === '~') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      strikethrough = !strikethrough
      i++ // Skip next ~
      continue
    }

    current += char
  }

  if (current) {
    richText.push(createRichText(current, { bold, italic, code, strikethrough }))
  }

  return richText.length > 0 ? richText : [createRichText(text)]
}

/**
 * Convert rich text array to plain markdown
 */
function richTextToMarkdown(richText: RichText[]): string {
  if (!richText || !Array.isArray(richText)) return ''

  return richText
    .map((rt) => {
      if (!rt || !rt.text) return ''

      let text = rt.text.content || ''
      const annotations = rt.annotations || {}

      if (annotations.bold) text = `**${text}**`
      if (annotations.italic) text = `*${text}*`
      if (annotations.code) text = `\`${text}\``
      if (annotations.strikethrough) text = `~~${text}~~`
      if (rt.text.link) text = `[${text}](${rt.text.link.url})`
      return text
    })
    .join('')
}

/**
 * Extract plain text from rich text
 */
export function extractPlainText(richText: RichText[]): string {
  return richText.map((rt) => rt.text.content).join('')
}

// ============================================================
// Table parsing
// ============================================================

interface TableParseResult {
  headers: string[]
  rows: string[][]
  hasHeader: boolean
  endIndex: number
}

function parseTable(lines: string[], startIndex: number): TableParseResult | null {
  const tableLines: string[] = []
  let i = startIndex

  // Collect all consecutive pipe-delimited lines
  while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].includes('|')) {
    tableLines.push(lines[i])
    i++
  }

  if (tableLines.length < 1) return null

  const parsedRows = tableLines.map((line) => {
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1) // Remove empty first/last
    return cells
  })

  // Check for separator row (contains ---)
  let hasHeader = false
  let headerRow: string[] = []
  const dataRows: string[][] = []

  if (parsedRows.length >= 2) {
    const possibleSeparator = parsedRows[1]
    const isSeparator = possibleSeparator.every((cell) => /^[-:]+$/.test(cell.trim()))

    if (isSeparator) {
      hasHeader = true
      headerRow = parsedRows[0]
      dataRows.push(...parsedRows.slice(2))
    } else {
      headerRow = parsedRows[0]
      dataRows.push(...parsedRows.slice(1))
    }
  } else {
    headerRow = parsedRows[0]
  }

  return {
    headers: headerRow,
    rows: dataRows,
    hasHeader,
    endIndex: i - 1
  }
}

// ============================================================
// Toggle parsing (<details>/<summary>)
// ============================================================

interface ToggleParseResult {
  title: string
  children: NotionBlock[]
  endIndex: number
}

function parseToggle(lines: string[], startIndex: number): ToggleParseResult {
  let i = startIndex
  let title = ''
  const childLines: string[] = []

  // Skip <details> tag
  const detailsLine = lines[i].trim()
  if (detailsLine === '<details>') {
    i++
  } else if (detailsLine.startsWith('<details>')) {
    // Inline content after <details>
    i++
  }

  // Look for <summary>...</summary>
  if (i < lines.length) {
    const summaryMatch = lines[i].match(/<summary>(.*?)<\/summary>/)
    if (summaryMatch) {
      title = summaryMatch[1]
      i++
    }
  }

  // Collect content until </details>
  while (i < lines.length && !lines[i].trim().startsWith('</details>')) {
    childLines.push(lines[i])
    i++
  }

  // Convert child content to blocks
  const childContent = childLines.join('\n').trim()
  const children = childContent ? markdownToBlocks(childContent) : []

  return { title, children, endIndex: i }
}

// ============================================================
// Column parsing (:::columns / :::column / :::end)
// ============================================================

interface ColumnParseResult {
  columns: NotionBlock[][]
  endIndex: number
}

function parseColumns(lines: string[], startIndex: number): ColumnParseResult {
  let i = startIndex + 1 // Skip :::columns
  const columns: NotionBlock[][] = []
  let currentColumnLines: string[] = []

  while (i < lines.length) {
    const line = lines[i].trim()

    if (line === ':::end') {
      // Flush last column
      if (currentColumnLines.length > 0) {
        columns.push(markdownToBlocks(currentColumnLines.join('\n').trim()))
        currentColumnLines = []
      }
      break
    }

    if (line === ':::column') {
      // Flush previous column
      if (currentColumnLines.length > 0) {
        columns.push(markdownToBlocks(currentColumnLines.join('\n').trim()))
        currentColumnLines = []
      }
      i++
      continue
    }

    currentColumnLines.push(lines[i])
    i++
  }

  // If no :::end found, flush remaining
  if (currentColumnLines.length > 0 && (columns.length > 0 || currentColumnLines.some((l) => l.trim()))) {
    columns.push(markdownToBlocks(currentColumnLines.join('\n').trim()))
  }

  return { columns, endIndex: i }
}

// ============================================================
// Callout helpers
// ============================================================

function getCalloutIcon(type: string): string {
  const icons: Record<string, string> = {
    NOTE: '\u2139\ufe0f',
    TIP: 'U0001f4a1',
    IMPORTANT: '\u2757',
    WARNING: '\u26a0\ufe0f',
    CAUTION: 'U0001f6d1',
    INFO: '\u2139\ufe0f',
    SUCCESS: '\u2705',
    ERROR: '\u274c'
  }
  return icons[type] || '\u2139\ufe0f'
}

function getCalloutColor(type: string): string {
  const colors: Record<string, string> = {
    NOTE: 'blue_background',
    TIP: 'green_background',
    IMPORTANT: 'purple_background',
    WARNING: 'yellow_background',
    CAUTION: 'red_background',
    INFO: 'blue_background',
    SUCCESS: 'green_background',
    ERROR: 'red_background'
  }
  return colors[type] || 'gray_background'
}

function getCalloutTypeFromIcon(icon: string): string {
  const iconMap: Record<string, string> = {
    '\u2139\ufe0f': 'NOTE',
    U0001f4a1: 'TIP',
    '\u2757': 'IMPORTANT',
    '\u26a0\ufe0f': 'WARNING',
    U0001f6d1: 'CAUTION',
    '\u2705': 'SUCCESS',
    '\u274c': 'ERROR'
  }
  return iconMap[icon] || 'NOTE'
}

// ============================================================
// Block creators
// ============================================================

function createRichText(
  content: string,
  annotations: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean; color?: string } = {}
): RichText {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: {
      bold: annotations.bold || false,
      italic: annotations.italic || false,
      strikethrough: annotations.strikethrough || false,
      underline: false,
      code: annotations.code || false,
      color: annotations.color || 'default'
    }
  }
}

function createHeading(level: 1 | 2 | 3, text: string): NotionBlock {
  const type = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3'
  return {
    object: 'block',
    type,
    [type]: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

function createParagraph(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

function createBulletedListItem(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

function createNumberedListItem(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

function createTodoItem(text: string, checked: boolean): NotionBlock {
  return {
    object: 'block',
    type: 'to_do',
    to_do: {
      rich_text: parseRichText(text),
      checked,
      color: 'default'
    }
  }
}

function createCodeBlock(code: string, language: string): NotionBlock {
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [createRichText(code)],
      language: language || 'plain text'
    }
  }
}

function createQuote(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'quote',
    quote: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

function createDivider(): NotionBlock {
  return {
    object: 'block',
    type: 'divider',
    divider: {}
  }
}

function createCallout(text: string, icon: string, color: string): NotionBlock {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: parseRichText(text),
      icon: { type: 'emoji', emoji: icon },
      color
    }
  }
}

function createToggle(text: string, children: NotionBlock[] = []): NotionBlock {
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: parseRichText(text),
      color: 'default',
      children
    }
  }
}

function createImage(url: string, caption: string = ''): NotionBlock {
  return {
    object: 'block',
    type: 'image',
    image: {
      type: 'external',
      external: { url },
      caption: caption ? [createRichText(caption)] : []
    }
  }
}

function createBookmark(url: string): NotionBlock {
  return {
    object: 'block',
    type: 'bookmark',
    bookmark: { url, caption: [] }
  }
}

function createEmbed(url: string): NotionBlock {
  return {
    object: 'block',
    type: 'embed',
    embed: { url }
  }
}

function createEquation(expression: string): NotionBlock {
  return {
    object: 'block',
    type: 'equation',
    equation: { expression }
  }
}

function createTable(headers: string[], rows: string[][], hasHeader: boolean): NotionBlock {
  const tableWidth = headers.length
  const allRows: NotionBlock[] = []

  // Header row
  allRows.push({
    object: 'block',
    type: 'table_row',
    table_row: {
      cells: headers.map((h) => [createRichText(h)])
    }
  })

  // Data rows
  for (const row of rows) {
    const cells = []
    for (let c = 0; c < tableWidth; c++) {
      cells.push([createRichText(row[c] || '')])
    }
    allRows.push({
      object: 'block',
      type: 'table_row',
      table_row: { cells }
    })
  }

  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: tableWidth,
      has_column_header: hasHeader,
      has_row_header: false,
      children: allRows
    }
  }
}

function createColumnList(columns: NotionBlock[][]): NotionBlock {
  const columnBlocks = columns.map((children) => ({
    object: 'block' as const,
    type: 'column',
    column: { children }
  }))

  return {
    object: 'block',
    type: 'column_list',
    column_list: {
      children: columnBlocks
    }
  }
}

function createTableOfContents(): NotionBlock {
  return {
    object: 'block',
    type: 'table_of_contents',
    table_of_contents: { color: 'default' }
  }
}

function createBreadcrumb(): NotionBlock {
  return {
    object: 'block',
    type: 'breadcrumb',
    breadcrumb: {}
  }
}

function isListItem(line: string): boolean {
  return line.match(/^[-*]\s/) !== null || line.match(/^\d+\.\s/) !== null
}
