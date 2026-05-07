import type { NotionBlock } from './markdown.types.js'
import {
  BOOKMARK_REGEX,
  BULLETED_LIST_REGEX,
  CALLOUT_REGEX,
  CHECKED_LIST_REGEX,
  createBookmark,
  createBreadcrumb,
  createBulletedListItem,
  createCallout,
  createCodeBlock,
  createColumnList,
  createDivider,
  createEmbed,
  createEquation,
  createHeading,
  createImage,
  createNumberedListItem,
  createParagraph,
  createQuote,
  createTable,
  createTableOfContents,
  createTodoItem,
  createToggle,
  DIVIDER_REGEX,
  getCalloutColor,
  getCalloutIcon,
  IMAGE_REGEX,
  isListItem,
  NUMBERED_LIST_REGEX
} from './markdown.utils.js'
import { isSafeUrl } from './security.js'

export class MarkdownParser {
  private lines: string[]
  private blocks: NotionBlock[] = []
  private currentList: NotionBlock[] = []
  private currentListType: 'bulleted' | 'numbered' | null = null

  constructor(markdown: string) {
    this.lines = markdown.split('\n')
  }

  public parse(): NotionBlock[] {
    for (let i = 0; i < this.lines.length; i++) {
      i = this.parseBlock(i)
    }

    // Flush remaining list
    if (this.currentList.length > 0) {
      this.blocks.push(...this.currentList)
    }

    return this.blocks
  }

  private parseBlock(i: number): number {
    const line = this.lines[i]

    // Flush list if we're not in a list anymore
    if (this.currentListType && !isListItem(line)) {
      this.blocks.push(...this.currentList)
      this.currentList = []
      this.currentListType = null
    }

    // Cache trimmed line for performance to avoid repeated string allocations
    const trimmedLine = line.trim()

    // Skip empty lines
    if (!trimmedLine) {
      return i
    }

    // Table of Contents [toc]
    if (trimmedLine === '[toc]' || trimmedLine === '[TOC]') {
      this.blocks.push(createTableOfContents())
      return i
    }

    // Breadcrumb [breadcrumb]
    if (trimmedLine === '[breadcrumb]' || trimmedLine === '[BREADCRUMB]') {
      this.blocks.push(createBreadcrumb())
      return i
    }

    // Equation block $...$
    if (trimmedLine.startsWith('$$')) {
      const eqData = parseEquationBlock(this.lines, i, trimmedLine)
      this.blocks.push(eqData.block)
      return eqData.endIndex
    }

    // Callout > [!TYPE] content or > [!TYPE]\n> content
    const calloutMatch = line.match(CALLOUT_REGEX)
    if (calloutMatch) {
      const calloutData = parseCalloutBlock(this.lines, i, calloutMatch)
      this.blocks.push(calloutData.block)
      return calloutData.endIndex
    }

    // Image ![alt](url)
    const imageMatch = line.match(IMAGE_REGEX)
    if (imageMatch) {
      const url = imageMatch[2]
      if (isSafeUrl(url)) {
        this.blocks.push(createImage(url, imageMatch[1]))
      } else {
        this.blocks.push(createParagraph(line))
      }
      return i
    }

    // Bookmark/Embed [bookmark](url) or [embed](url)
    const bookmarkMatch = line.match(BOOKMARK_REGEX)
    if (bookmarkMatch) {
      const type = bookmarkMatch[1].toLowerCase()
      const url = bookmarkMatch[2]
      if (isSafeUrl(url)) {
        if (type === 'embed') {
          this.blocks.push(createEmbed(url))
        } else {
          this.blocks.push(createBookmark(url))
        }
      } else {
        this.blocks.push(createParagraph(line))
      }
      return i
    }

    // Toggle <details><summary>Title</summary>
    if (trimmedLine === '<details>' || trimmedLine.startsWith('<details>')) {
      const toggleData = parseToggle(this.lines, i)
      this.blocks.push(createToggle(toggleData.title, toggleData.children))
      return toggleData.endIndex
    }

    // Column layout :::columns
    if (trimmedLine === ':::columns') {
      const columnData = parseColumns(this.lines, i)
      this.blocks.push(createColumnList(columnData.columns, columnData.widthRatios))
      return columnData.endIndex
    }

    // Table (pipe-delimited)
    if (line.includes('|') && trimmedLine.startsWith('|')) {
      const tableData = parseTable(this.lines, i)
      if (tableData) {
        this.blocks.push(createTable(tableData.headers, tableData.rows, tableData.hasHeader))
        return tableData.endIndex
      }
    }

    // Heading
    if (line.startsWith('# ')) {
      this.blocks.push(createHeading(1, line.slice(2)))
    } else if (line.startsWith('## ')) {
      this.blocks.push(createHeading(2, line.slice(3)))
    } else if (line.startsWith('### ')) {
      this.blocks.push(createHeading(3, line.slice(4)))
    }

    // Code block
    else if (line.startsWith('```')) {
      const codeData = parseCodeBlock(this.lines, i, line)
      this.blocks.push(codeData.block)
      return codeData.endIndex
    }

    // Task list / Checkbox list - [ ] or - [x]
    else if (CHECKED_LIST_REGEX.test(line)) {
      const checked = line[3] !== ' '
      const text = line.replace(CHECKED_LIST_REGEX, '')
      this.currentListType = 'bulleted'
      this.currentList.push(createTodoItem(text, checked))
    }
    // Bulleted list
    else if (BULLETED_LIST_REGEX.test(line)) {
      const text = line.replace(BULLETED_LIST_REGEX, '')
      this.currentListType = 'bulleted'
      this.currentList.push(createBulletedListItem(text))
    }
    // Numbered list
    else if (NUMBERED_LIST_REGEX.test(line)) {
      const text = line.replace(NUMBERED_LIST_REGEX, '')
      this.currentListType = 'numbered'
      this.currentList.push(createNumberedListItem(text))
    }
    // Quote
    else if (line.startsWith('> ')) {
      this.blocks.push(createQuote(line.slice(2)))
    }
    // Divider
    else if (DIVIDER_REGEX.test(line)) {
      this.blocks.push(createDivider())
    }
    // Regular paragraph
    else {
      this.blocks.push(createParagraph(line))
    }

    return i
  }
}
export function markdownToBlocks(markdown: string): NotionBlock[] {
  const parser = new MarkdownParser(markdown)
  return parser.parse()
}

export interface ParseResult {
  block: NotionBlock
  endIndex: number
}

export function parseCalloutBlock(lines: string[], startIndex: number, match: RegExpMatchArray): ParseResult {
  const calloutType = match[1].toUpperCase()
  const contentLines: string[] = match[2] ? [match[2]] : []
  let i = startIndex

  // Collect continuation lines (lines starting with >)
  while (i + 1 < lines.length && lines[i + 1].startsWith('> ')) {
    i++
    contentLines.push(lines[i].slice(2))
  }

  const icon = getCalloutIcon(calloutType)
  const color = getCalloutColor(calloutType)
  const calloutContent = contentLines.join('\n')
  return { block: createCallout(calloutContent || calloutType, icon, color), endIndex: i }
}

export function parseCodeBlock(lines: string[], startIndex: number, line: string): ParseResult {
  const language = line.slice(3).trim()
  const codeLines: string[] = []
  let i = startIndex + 1
  while (i < lines.length && !lines[i].startsWith('```')) {
    codeLines.push(lines[i])
    i++
  }
  return { block: createCodeBlock(codeLines.join('\n'), language), endIndex: i }
}

export function parseEquationBlock(lines: string[], startIndex: number, trimmedLine: string): ParseResult {
  if (trimmedLine.endsWith('$$') && trimmedLine.length > 4) {
    // Single line equation: $$expression$$
    const expression = trimmedLine.slice(2, -2).trim()
    return { block: createEquation(expression), endIndex: startIndex }
  }
  // Multi-line equation
  const eqLines: string[] = []
  let i = startIndex + 1
  while (i < lines.length && !lines[i].trim().startsWith('$$')) {
    eqLines.push(lines[i])
    i++
  }
  return { block: createEquation(eqLines.join('\n')), endIndex: i }
}
// ============================================================
// Table parsing
// ============================================================

export interface TableParseResult {
  headers: string[]
  rows: string[][]
  hasHeader: boolean
  endIndex: number
}

export function parseTable(lines: string[], startIndex: number): TableParseResult | null {
  const tableLines: string[] = []
  let i = startIndex

  // Collect all consecutive pipe-delimited lines
  while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].includes('|')) {
    tableLines.push(lines[i])
    i++
  }

  if (tableLines.length < 1) return null

  // Optimization: use a single-pass manual loop instead of chained .map().filter().
  // This reduces array allocations and closure creation in a hot path when parsing markdown tables.
  const parsedRows: string[][] = new Array(tableLines.length)
  for (let r = 0; r < tableLines.length; r++) {
    const line = tableLines[r]
    const split = line.split('|')
    const len = split.length
    if (len < 3) {
      parsedRows[r] = []
      continue
    }
    const cells: string[] = new Array(len - 2)
    for (let c = 1; c < len - 1; c++) {
      cells[c - 1] = split[c].trim()
    }
    parsedRows[r] = cells
  }

  // Check for separator row (contains ---)
  let hasHeader = false
  let headerRow: string[] = []
  const dataRows: string[][] = []

  if (parsedRows.length >= 2) {
    const possibleSeparator = parsedRows[1]
    const isSeparator = possibleSeparator.every((cell: string) => /^[-:]+$/.test(cell.trim()))

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

export interface ToggleParseResult {
  title: string
  children: NotionBlock[]
  endIndex: number
}

export function parseToggle(lines: string[], startIndex: number): ToggleParseResult {
  let i = startIndex
  let title = ''
  const childLines: string[] = []

  const detailsLine = lines[i].trim()

  // Try to extract <summary>...</summary> from the <details> line itself
  const inlineSummaryMatch = detailsLine.match(/^<details>\s*<summary>(.*?)<\/summary>(.*?)(<\/details>)?$/)

  if (inlineSummaryMatch) {
    // All-on-one-line or inline summary: <details><summary>Title</summary>[Content][</details>]
    title = inlineSummaryMatch[1]
    const afterSummary = inlineSummaryMatch[2].trim()
    const closedOnSameLine = !!inlineSummaryMatch[3]

    if (closedOnSameLine) {
      // Entire toggle on one line: <details><summary>Title</summary>Content</details>
      if (afterSummary) {
        childLines.push(afterSummary)
      }
      const childContent = childLines.join('\n').trim()
      const children = childContent ? markdownToBlocks(childContent) : []
      return { title, children, endIndex: i }
    }

    // Inline summary but content continues on subsequent lines
    if (afterSummary) {
      childLines.push(afterSummary)
    }
    i++
  } else {
    // Standard multi-line: <details> on its own line
    i++

    // Look for <summary>...</summary> on the next line
    if (i < lines.length) {
      const summaryMatch = lines[i].match(/<summary>(.*?)<\/summary>/)
      if (summaryMatch) {
        title = summaryMatch[1]
        i++
      }
    }
  }

  // Collect content until matching </details>, tracking nesting depth
  let depth = 1
  while (i < lines.length && depth > 0) {
    const trimmed = lines[i].trim()

    // Check for <details> opens BEFORE </details> closes so that
    // a single-line nested toggle (opens+closes on same line) doesn't
    // prematurely terminate the outer loop.
    if (trimmed.startsWith('<details>') || trimmed === '<details>') {
      depth++
    }
    if (trimmed === '</details>' || trimmed.endsWith('</details>')) {
      depth--
      if (depth === 0) break
    }

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

export interface ColumnParseResult {
  columns: NotionBlock[][]
  widthRatios: (number | undefined)[]
  endIndex: number
}

export function parseColumns(lines: string[], startIndex: number): ColumnParseResult {
  let i = startIndex + 1 // Skip :::columns
  const columns: NotionBlock[][] = []
  const widthRatios: (number | undefined)[] = []
  let currentColumnLines: string[] = []
  let inColumn = false

  while (i < lines.length) {
    const line = lines[i].trim()

    if (line === ':::end') {
      // Flush last column
      if (inColumn) {
        columns.push(markdownToBlocks(currentColumnLines.join('\n').trim()))
        currentColumnLines = []
      }
      break
    }

    const columnMatch = line.match(/^:::column(?:\{width=([\d.]+)\})?$/)
    if (columnMatch) {
      // Flush previous column (even if empty)
      if (inColumn) {
        columns.push(markdownToBlocks(currentColumnLines.join('\n').trim()))
        currentColumnLines = []
      }
      inColumn = true
      widthRatios.push(columnMatch[1] ? Number.parseFloat(columnMatch[1]) : undefined)
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

  return { columns, widthRatios, endIndex: i }
}

// ============================================================
// Callout helpers
// ============================================================
