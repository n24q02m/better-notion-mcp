import type { NotionBlock, RichText } from './markdown.types.js'
import { isSafeUrl } from './security.js'

export function createMention(
  mentionData: RichText['mention'],
  title: string,
  formatting: { bold: boolean; italic: boolean; code: boolean; strikethrough: boolean }
): RichText {
  return {
    type: 'mention',
    mention: mentionData,
    plain_text: title,
    annotations: {
      bold: formatting.bold,
      italic: formatting.italic,
      strikethrough: formatting.strikethrough,
      underline: false,
      code: formatting.code,
      color: 'default'
    }
  } as RichText
}

export const CALLOUT_REGEX = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|SUCCESS|ERROR)\]\s*(.*)/i
export const IMAGE_REGEX = /^!\[([^\]]*)\]\(([^)]+)\)$/
export const BOOKMARK_REGEX = /^\[(bookmark|embed)\]\(([^)]+)\)$/i
export const CHECKED_LIST_REGEX = /^[-*]\s\[([ xX])\]\s/
export const BULLETED_LIST_REGEX = /^[-*]\s/
export const NUMBERED_LIST_REGEX = /^\d+\.\s/
export const DIVIDER_REGEX = /^[-*]{3,}$/
export class InlineParser {
  private richText: RichText[] = []
  private current = ''
  private bold = false
  private italic = false
  private code = false
  private strikethrough = false
  private noMoreCloseBrackets = false
  private noMoreMentionCloseBrackets = false
  private i = 0

  constructor(private readonly text: string) {}

  private flushCurrent(): void {
    if (this.current) {
      this.richText.push(
        createRichText(this.current, {
          bold: this.bold,
          italic: this.italic,
          code: this.code,
          strikethrough: this.strikethrough
        })
      )
      this.current = ''
    }
  }

  private tryParseMention(): boolean {
    const char = this.text[this.i]
    const next = this.text[this.i + 1]

    // Page mention @[Title](page-id-or-url) — must come before link handling
    // ⚡ Bolt: Added algorithmic short-circuiting to prevent O(N^2) lookaheads on pathological inputs
    // with many `@[` but no `]`.
    if (char === '@' && next === '[' && !this.noMoreMentionCloseBrackets) {
      const closeBracket = this.text.indexOf(']', this.i + 2)
      if (closeBracket === -1) {
        this.noMoreMentionCloseBrackets = true
      } else if (closeBracket + 1 < this.text.length && this.text[closeBracket + 1] === '(') {
        const closeParen = this.text.indexOf(')', closeBracket + 2)
        if (closeParen !== -1) {
          this.flushCurrent()

          const mentionTitle = this.text.slice(this.i + 2, closeBracket)
          const mentionTarget = this.text.slice(closeBracket + 2, closeParen)

          // Extract 32-char hex page ID from Notion URL or use as-is
          const idMatch = mentionTarget.match(/([a-f0-9]{32})/)
          const pageId = idMatch ? idMatch[1] : mentionTarget

          this.richText.push(
            createMention({ page: { id: pageId } }, mentionTitle, {
              bold: this.bold,
              italic: this.italic,
              code: this.code,
              strikethrough: this.strikethrough
            })
          )

          this.i = closeParen
          return true
        }
      }
    }
    return false
  }

  private tryParseLink(): boolean {
    const char = this.text[this.i]

    // Link [text](url) — optimized to avoid O(N²) on pathological inputs
    if (char === '[' && !this.noMoreCloseBrackets) {
      const closeBracket = this.text.indexOf(']', this.i + 1)
      if (closeBracket === -1) {
        // No more ] in the rest of the string, skip future indexOf calls
        this.noMoreCloseBrackets = true
      } else if (closeBracket + 1 < this.text.length && this.text[closeBracket + 1] === '(') {
        const closeParen = this.text.indexOf(')', closeBracket + 2)

        if (closeParen !== -1) {
          this.flushCurrent()

          const linkText = this.text.slice(this.i + 1, closeBracket)
          const linkUrl = this.text.slice(closeBracket + 2, closeParen)
          const isSafe = isSafeUrl(linkUrl)

          this.richText.push({
            type: 'text',
            text: { content: linkText, link: isSafe ? { url: linkUrl } : null },
            annotations: {
              bold: this.bold,
              italic: this.italic,
              strikethrough: this.strikethrough,
              underline: false,
              code: this.code,
              color: 'default'
            }
          })

          this.i = closeParen
          return true
        }
      }
    }
    return false
  }

  private tryParseFormatting(): boolean {
    const char = this.text[this.i]
    const next = this.text[this.i + 1]

    // Bold **text**
    if (char === '*' && next === '*') {
      this.flushCurrent()
      this.bold = !this.bold
      this.i++ // Skip next *
      return true
    }
    // Italic *text*
    if (char === '*' && next !== '*') {
      this.flushCurrent()
      this.italic = !this.italic
      return true
    }
    // Code `text`
    if (char === '`') {
      this.flushCurrent()
      this.code = !this.code
      return true
    }
    // Strikethrough ~~text~~
    if (char === '~' && next === '~') {
      this.flushCurrent()
      this.strikethrough = !this.strikethrough
      this.i++ // Skip next ~
      return true
    }

    return false
  }

  public parse(): RichText[] {
    for (this.i = 0; this.i < this.text.length; this.i++) {
      const char = this.text[this.i]

      // Fast path: skip parsing functions if character isn't a potential formatting trigger
      if (char === '@' || char === '[' || char === '*' || char === '`' || char === '~') {
        if (this.tryParseMention()) continue
        if (this.tryParseLink()) continue
        if (this.tryParseFormatting()) continue
      }

      this.current += char
    }

    this.flushCurrent()

    return this.richText.length > 0 ? this.richText : [createRichText(this.text)]
  }
}

export function parseRichText(text: string): RichText[] {
  return new InlineParser(text).parse()
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

export function extractPlainText(richText: RichText[]): string {
  if (!richText || !Array.isArray(richText)) return ''
  let result = ''
  const len = richText.length
  for (let i = 0; i < len; i++) {
    const rt = richText[i]
    result += rt.plain_text || rt.text?.content || ''
  }
  return result
}

// ============================================================
// Block Parsing Helpers
// ============================================================
export const CALLOUT_ICONS: Record<string, string> = {
  NOTE: 'ℹ️',
  TIP: '💡',
  IMPORTANT: '❗',
  WARNING: '⚠️',
  CAUTION: '🛑',
  INFO: 'ℹ️',
  SUCCESS: '✅',
  ERROR: '❌'
}

export const CALLOUT_COLORS: Record<string, string> = {
  NOTE: 'blue_background',
  TIP: 'green_background',
  IMPORTANT: 'purple_background',
  WARNING: 'yellow_background',
  CAUTION: 'red_background',
  INFO: 'blue_background',
  SUCCESS: 'green_background',
  ERROR: 'red_background'
}

export const CALLOUT_ICON_MAP: Record<string, string> = {
  ℹ️: 'NOTE',
  '💡': 'TIP',
  '❗': 'IMPORTANT',
  '⚠️': 'WARNING',
  '🛑': 'CAUTION',
  '✅': 'SUCCESS',
  '❌': 'ERROR'
}
export function getCalloutIcon(type: string): string {
  return CALLOUT_ICONS[type] || 'ℹ️'
}

export function getCalloutColor(type: string): string {
  return CALLOUT_COLORS[type] || 'gray_background'
}

export function getCalloutTypeFromIcon(icon: string): string {
  return CALLOUT_ICON_MAP[icon] || 'NOTE'
}

// ============================================================
// Block creators
// ============================================================
export function createRichText(
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

export function createHeading(level: 1 | 2 | 3, text: string): NotionBlock {
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

export function createParagraph(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

export function createBulletedListItem(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

export function createNumberedListItem(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

export function createTodoItem(text: string, checked: boolean): NotionBlock {
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

export function createCodeBlock(code: string, language: string): NotionBlock {
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [createRichText(code)],
      language: language || 'plain text'
    }
  }
}

export function createQuote(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'quote',
    quote: {
      rich_text: parseRichText(text),
      color: 'default'
    }
  }
}

export function createDivider(): NotionBlock {
  return {
    object: 'block',
    type: 'divider',
    divider: {}
  }
}

export function createCallout(text: string, icon: string, color: string): NotionBlock {
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

export function createToggle(text: string, children: NotionBlock[] = []): NotionBlock {
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

export function createImage(url: string, caption: string = ''): NotionBlock {
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

export function createBookmark(url: string): NotionBlock {
  return {
    object: 'block',
    type: 'bookmark',
    bookmark: { url, caption: [] }
  }
}

export function createEmbed(url: string): NotionBlock {
  return {
    object: 'block',
    type: 'embed',
    embed: { url }
  }
}

export function createEquation(expression: string): NotionBlock {
  return {
    object: 'block',
    type: 'equation',
    equation: { expression }
  }
}

export function createTable(headers: string[], rows: string[][], hasHeader: boolean): NotionBlock {
  const tableWidth = headers.length
  const allRows: NotionBlock[] = []

  // Header row
  allRows.push({
    object: 'block',
    type: 'table_row',
    table_row: {
      cells: headers.map((h) => parseRichText(h))
    }
  })

  // Data rows
  for (const row of rows) {
    const cells = []
    for (let c = 0; c < tableWidth; c++) {
      cells.push(parseRichText(row[c] || ''))
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

export function createColumnList(columns: NotionBlock[][], widthRatios?: (number | undefined)[]): NotionBlock {
  const columnBlocks = columns.map((children, i) => {
    const col: any = { children }
    const ratio = widthRatios?.[i]
    if (ratio !== undefined) {
      col.format = { column_ratio: ratio }
    }
    return {
      object: 'block' as const,
      type: 'column',
      column: col
    }
  })

  return {
    object: 'block',
    type: 'column_list',
    column_list: {
      children: columnBlocks
    }
  }
}

export function createTableOfContents(): NotionBlock {
  return {
    object: 'block',
    type: 'table_of_contents',
    table_of_contents: { color: 'default' }
  }
}

export function createBreadcrumb(): NotionBlock {
  return {
    object: 'block',
    type: 'breadcrumb',
    breadcrumb: {}
  }
}
export function isListItem(line: string): boolean {
  return BULLETED_LIST_REGEX.test(line) || NUMBERED_LIST_REGEX.test(line)
}
