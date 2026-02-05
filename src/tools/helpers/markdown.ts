/**
 * Markdown to Notion Blocks Converter
 * Converts markdown text to Notion block format
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
      default:
        // Unsupported block type, skip
        break
    }
  }

  return lines.join('\n')
}

/**
 * Parse inline markdown formatting to rich text
 */
export function parseRichText(text: string): RichText[] {
  const richText: RichText[] = []
  let current = ''
  let bold = false
  let italic = false
  let code = false
  let strikethrough = false

  // Regex to find next special character
  // Note: we want to match `[` to check for links.
  const tokenRegex = /(\*\*|\*|~~|`|\[)/g

  let lastIndex = 0
  let match: RegExpExecArray | null = null

  // eslint-disable-next-line no-constant-condition
  while (true) {
    match = tokenRegex.exec(text)
    if (match === null) {
      break
    }

    const index = match.index
    const token = match[0]

    // Append text before the token
    if (index > lastIndex) {
      current += text.slice(lastIndex, index)
    }

    // Handle tokens
    if (token === '[') {
      // Potential link
      const closeBracket = text.indexOf(']', index)
      const openParen = closeBracket !== -1 ? text.indexOf('(', closeBracket) : -1
      const closeParen = openParen !== -1 ? text.indexOf(')', openParen) : -1

      if (closeBracket !== -1 && openParen === closeBracket + 1 && closeParen !== -1) {
        // Flush current text
        if (current) {
          richText.push(createRichText(current, { bold, italic, code, strikethrough }))
          current = ''
        }

        const linkText = text.slice(index + 1, closeBracket)
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

        // Advance regex
        const newIndex = closeParen + 1
        tokenRegex.lastIndex = newIndex
        lastIndex = newIndex
      } else {
        // Not a link, treat [ as text
        current += '['
        lastIndex = index + 1
      }
    } else if (token === '**') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      bold = !bold
      lastIndex = index + 2
    } else if (token === '*') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      italic = !italic
      lastIndex = index + 1
    } else if (token === '~~') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      strikethrough = !strikethrough
      lastIndex = index + 2
    } else if (token === '`') {
      if (current) {
        richText.push(createRichText(current, { bold, italic, code, strikethrough }))
        current = ''
      }
      code = !code
      lastIndex = index + 1
    }
  }

  // Append remaining text
  if (lastIndex < text.length) {
    current += text.slice(lastIndex)
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

// Helper creators
function createRichText(
  content: string,
  annotations: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean } = {}
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
      color: 'default'
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

function isListItem(line: string): boolean {
  return line.match(/^[-*]\s/) !== null || line.match(/^\d+\.\s/) !== null
}
