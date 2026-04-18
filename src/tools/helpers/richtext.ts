/**
 * Rich Text Utilities
 * Helpers for working with Notion's rich text format
 */

export interface RichTextItem {
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

export type Color = 'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

const DEFAULT_ANNOTATIONS: RichTextItem['annotations'] = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: 'default'
}

/**
 * Create simple rich text
 */
export function text(content: string): RichTextItem {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: { ...DEFAULT_ANNOTATIONS }
  }
}

/**
 * Create bold text
 */
export function bold(content: string): RichTextItem {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: { ...DEFAULT_ANNOTATIONS, bold: true }
  }
}

/**
 * Create italic text
 */
export function italic(content: string): RichTextItem {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: { ...DEFAULT_ANNOTATIONS, italic: true }
  }
}

/**
 * Create code text
 */
export function code(content: string): RichTextItem {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: { ...DEFAULT_ANNOTATIONS, code: true }
  }
}

/**
 * Create link text
 */
export function link(content: string, url: string): RichTextItem {
  return {
    type: 'text',
    text: { content, link: { url } },
    annotations: { ...DEFAULT_ANNOTATIONS }
  }
}

/**
 * Create colored text
 */
export function colored(content: string, color: Color): RichTextItem {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: { ...DEFAULT_ANNOTATIONS, color }
  }
}

/**
 * Apply multiple formatting styles
 */
export function formatText(
  content: string,
  options: {
    bold?: boolean
    italic?: boolean
    code?: boolean
    strikethrough?: boolean
    underline?: boolean
    color?: Color
    link?: string
  } = {}
): RichTextItem {
  return {
    type: 'text',
    text: {
      content,
      link: options.link ? { url: options.link } : null
    },
    annotations: {
      bold: options.bold || false,
      italic: options.italic || false,
      strikethrough: options.strikethrough || false,
      underline: options.underline || false,
      code: options.code || false,
      color: options.color || 'default'
    }
  }
}

/**
 * Extract plain text from rich text array
 * Optimized string accumulation avoids creating intermediate arrays
 * and reduces garbage collection pressure in hot paths.
 */
export function extractPlainText(richText: RichTextItem[] | undefined | null): string {
  if (!richText || !Array.isArray(richText)) return ''
  let result = ''
  for (let i = 0; i < richText.length; i++) {
    result += richText[i].plain_text ?? richText[i].text?.content ?? ''
  }
  return result
}

/**
 * Merge multiple rich text items
 */
export function mergeRichText(...items: RichTextItem[]): RichTextItem[] {
  return items.flat()
}

/**
 * Convert string array to rich text
 */
export function fromStrings(strings: string[]): RichTextItem[] {
  return strings.map((s) => text(s))
}

/**
 * Check if rich text is empty
 */
export function isEmpty(richText: RichTextItem[] | undefined | null): boolean {
  if (!richText || !Array.isArray(richText)) return true
  return richText.length === 0 || extractPlainText(richText).trim().length === 0
}

/**
 * Truncate rich text to max length
 */
export function truncate(richText: RichTextItem[], maxLength: number): RichTextItem[] {
  const plainText = extractPlainText(richText)
  if (plainText.length <= maxLength) {
    return richText
  }

  if (maxLength < 3) {
    return [text(plainText.slice(0, maxLength))]
  }

  const truncated = `${plainText.slice(0, maxLength - 3)}...`
  return [text(truncated)]
}
