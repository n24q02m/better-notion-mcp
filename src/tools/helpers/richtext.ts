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

/**
 * Create simple rich text
 */
export function text(content: string): RichTextItem {
  return {
    type: 'text',
    text: { content, link: null },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default'
    }
  }
}

/**
 * Create bold text
 */
export function bold(content: string): RichTextItem {
  return {
    ...text(content),
    annotations: { ...text(content).annotations, bold: true }
  }
}

/**
 * Create italic text
 */
export function italic(content: string): RichTextItem {
  return {
    ...text(content),
    annotations: { ...text(content).annotations, italic: true }
  }
}

/**
 * Create code text
 */
export function code(content: string): RichTextItem {
  return {
    ...text(content),
    annotations: { ...text(content).annotations, code: true }
  }
}

/**
 * Create link text
 */
export function link(content: string, url: string): RichTextItem {
  return {
    type: 'text',
    text: { content, link: { url } },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default'
    }
  }
}

/**
 * Create colored text
 */
export function colored(content: string, color: Color): RichTextItem {
  return {
    ...text(content),
    annotations: { ...text(content).annotations, color }
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
 */
export function extractPlainText(richText: RichTextItem[]): string {
  return richText.map((rt) => rt.text.content).join('')
}

/**
 * Split text into chunks (max 2000 chars per rich text item)
 */
export function splitText(content: string, maxLength: number = 2000): RichTextItem[] {
  if (content.length <= maxLength) {
    return [text(content)]
  }

  const chunks: RichTextItem[] = []
  let remaining = content

  while (remaining.length > 0) {
    const chunk = remaining.slice(0, maxLength)
    chunks.push(text(chunk))
    remaining = remaining.slice(maxLength)
  }

  return chunks
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
export function isEmpty(richText: RichTextItem[]): boolean {
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

  const truncated = `${plainText.slice(0, maxLength - 3)}...`
  return [text(truncated)]
}
