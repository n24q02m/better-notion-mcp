import { describe, expect, it } from 'vitest'
import type { NotionBlock, RichText } from './markdown.js'
import { blocksToMarkdown, extractPlainText, markdownToBlocks, parseRichText } from './markdown.js'

// ============================================================
// Helpers
// ============================================================

function plainRichText(content: string): RichText {
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

function getRichTextContent(block: NotionBlock): string {
  const key = block.type
  const richText: RichText[] = block[key]?.rich_text ?? []
  return richText.map((rt: RichText) => rt.text.content).join('')
}

// ============================================================
// markdownToBlocks
// ============================================================

describe('markdownToBlocks', () => {
  describe('empty input', () => {
    it('should return empty array for empty string', () => {
      expect(markdownToBlocks('')).toEqual([])
    })

    it('should return empty array for whitespace-only input', () => {
      expect(markdownToBlocks('   \n  \n  ')).toEqual([])
    })
  })

  describe('headings', () => {
    it('should parse heading level 1', () => {
      const blocks = markdownToBlocks('# Hello')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('heading_1')
      expect(getRichTextContent(blocks[0])).toBe('Hello')
    })

    it('should parse heading level 2', () => {
      const blocks = markdownToBlocks('## World')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('heading_2')
      expect(getRichTextContent(blocks[0])).toBe('World')
    })

    it('should parse heading level 3', () => {
      const blocks = markdownToBlocks('### Subtitle')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('heading_3')
      expect(getRichTextContent(blocks[0])).toBe('Subtitle')
    })

    it('should set color to default', () => {
      const blocks = markdownToBlocks('# Title')
      expect(blocks[0].heading_1.color).toBe('default')
    })
  })

  describe('paragraphs', () => {
    it('should parse plain text as paragraph', () => {
      const blocks = markdownToBlocks('Hello world')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('paragraph')
      expect(getRichTextContent(blocks[0])).toBe('Hello world')
    })

    it('should skip empty lines between paragraphs', () => {
      const blocks = markdownToBlocks('First\n\nSecond')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('paragraph')
      expect(blocks[1].type).toBe('paragraph')
      expect(getRichTextContent(blocks[0])).toBe('First')
      expect(getRichTextContent(blocks[1])).toBe('Second')
    })
  })

  describe('bulleted lists', () => {
    it('should parse dash-prefixed items', () => {
      const blocks = markdownToBlocks('- First\n- Second')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('bulleted_list_item')
      expect(blocks[1].type).toBe('bulleted_list_item')
      expect(getRichTextContent(blocks[0])).toBe('First')
      expect(getRichTextContent(blocks[1])).toBe('Second')
    })

    it('should parse asterisk-prefixed items', () => {
      const blocks = markdownToBlocks('* Item A\n* Item B')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('bulleted_list_item')
      expect(getRichTextContent(blocks[0])).toBe('Item A')
    })
  })

  describe('numbered lists', () => {
    it('should parse numbered items', () => {
      const blocks = markdownToBlocks('1. First\n2. Second\n3. Third')
      expect(blocks).toHaveLength(3)
      for (const block of blocks) {
        expect(block.type).toBe('numbered_list_item')
      }
      expect(getRichTextContent(blocks[0])).toBe('First')
      expect(getRichTextContent(blocks[2])).toBe('Third')
    })
  })

  describe('todo / checkbox', () => {
    it('should parse unchecked todo item', () => {
      const blocks = markdownToBlocks('- [ ] Buy milk')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('to_do')
      expect(blocks[0].to_do.checked).toBe(false)
      expect(getRichTextContent(blocks[0])).toBe('Buy milk')
    })

    it('should parse checked todo item with lowercase x', () => {
      const blocks = markdownToBlocks('- [x] Done task')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].to_do.checked).toBe(true)
      expect(getRichTextContent(blocks[0])).toBe('Done task')
    })

    it('should parse checked todo item with uppercase X', () => {
      const blocks = markdownToBlocks('- [X] Also done')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].to_do.checked).toBe(true)
    })

    it('should handle mixed checked and unchecked items', () => {
      const blocks = markdownToBlocks('- [ ] Pending\n- [x] Complete')
      expect(blocks).toHaveLength(2)
      expect(blocks[0].to_do.checked).toBe(false)
      expect(blocks[1].to_do.checked).toBe(true)
    })
  })

  describe('code blocks', () => {
    it('should parse code block with language', () => {
      const blocks = markdownToBlocks('```typescript\nconst x = 1\n```')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('code')
      expect(blocks[0].code.language).toBe('typescript')
      expect(blocks[0].code.rich_text[0].text.content).toBe('const x = 1')
    })

    it('should parse code block without language as plain text', () => {
      const blocks = markdownToBlocks('```\nhello\n```')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].code.language).toBe('plain text')
    })

    it('should preserve multi-line code content', () => {
      const code = '```js\nline1\nline2\nline3\n```'
      const blocks = markdownToBlocks(code)
      expect(blocks[0].code.rich_text[0].text.content).toBe('line1\nline2\nline3')
    })
  })

  describe('quotes', () => {
    it('should parse blockquote', () => {
      const blocks = markdownToBlocks('> This is a quote')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('quote')
      expect(getRichTextContent(blocks[0])).toBe('This is a quote')
    })
  })

  describe('dividers', () => {
    it('should parse triple dash divider', () => {
      const blocks = markdownToBlocks('---')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('divider')
      expect(blocks[0].divider).toEqual({})
    })

    it('should parse triple asterisk divider', () => {
      const blocks = markdownToBlocks('***')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('divider')
    })

    it('should parse longer dash dividers', () => {
      const blocks = markdownToBlocks('-----')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('divider')
    })
  })

  describe('callouts', () => {
    it('should parse NOTE callout', () => {
      const blocks = markdownToBlocks('> [!NOTE] This is a note')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('callout')
      expect(getRichTextContent(blocks[0])).toBe('This is a note')
      expect(blocks[0].callout.color).toBe('blue_background')
    })

    it('should parse TIP callout', () => {
      const blocks = markdownToBlocks('> [!TIP] Helpful tip')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].callout.color).toBe('green_background')
    })

    it('should parse WARNING callout', () => {
      const blocks = markdownToBlocks('> [!WARNING] Be careful')
      expect(blocks[0].callout.color).toBe('yellow_background')
    })

    it('should parse IMPORTANT callout', () => {
      const blocks = markdownToBlocks('> [!IMPORTANT] Critical info')
      expect(blocks[0].callout.color).toBe('purple_background')
    })

    it('should parse CAUTION callout', () => {
      const blocks = markdownToBlocks('> [!CAUTION] Danger zone')
      expect(blocks[0].callout.color).toBe('red_background')
    })

    it('should parse INFO callout', () => {
      const blocks = markdownToBlocks('> [!INFO] Information')
      expect(blocks[0].callout.color).toBe('blue_background')
    })

    it('should parse SUCCESS callout', () => {
      const blocks = markdownToBlocks('> [!SUCCESS] All passed')
      expect(blocks[0].callout.color).toBe('green_background')
    })

    it('should parse ERROR callout', () => {
      const blocks = markdownToBlocks('> [!ERROR] Something failed')
      expect(blocks[0].callout.color).toBe('red_background')
    })

    it('should have emoji icon', () => {
      const blocks = markdownToBlocks('> [!NOTE] Text')
      expect(blocks[0].callout.icon).toBeDefined()
      expect(blocks[0].callout.icon.type).toBe('emoji')
      expect(blocks[0].callout.icon.emoji).toBeTruthy()
    })

    it('should use correct Unicode emoji for each callout type', () => {
      const cases: [string, string][] = [
        ['NOTE', '\u2139\ufe0f'],
        ['TIP', '\u{1f4a1}'],
        ['IMPORTANT', '\u2757'],
        ['WARNING', '\u26a0\ufe0f'],
        ['CAUTION', '\u{1f6d1}'],
        ['INFO', '\u2139\ufe0f'],
        ['SUCCESS', '\u2705'],
        ['ERROR', '\u274c']
      ]
      for (const [type, expectedEmoji] of cases) {
        const blocks = markdownToBlocks(`> [!${type}] Text`)
        expect(blocks[0].callout.icon.emoji).toBe(expectedEmoji)
      }
    })

    it('should round-trip TIP callout', () => {
      const blocks = markdownToBlocks('> [!TIP] Helpful tip')
      const md = blocksToMarkdown(blocks)
      expect(md).toContain('[!TIP]')
      expect(md).toContain('Helpful tip')
    })

    it('should round-trip CAUTION callout', () => {
      const blocks = markdownToBlocks('> [!CAUTION] Danger zone')
      const md = blocksToMarkdown(blocks)
      expect(md).toContain('[!CAUTION]')
      expect(md).toContain('Danger zone')
    })

    it('should handle multi-line callout with continuation lines', () => {
      const md = '> [!NOTE] First line\n> Second line\n> Third line'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('callout')
      expect(getRichTextContent(blocks[0])).toBe('First line\nSecond line\nThird line')
    })

    it('should handle callout with no inline text', () => {
      const blocks = markdownToBlocks('> [!WARNING]')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('callout')
      expect(getRichTextContent(blocks[0])).toBe('WARNING')
    })

    it('should be case-insensitive for callout type', () => {
      const blocks = markdownToBlocks('> [!note] lowercase')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('callout')
    })
  })

  describe('toggles', () => {
    it('should parse toggle with content', () => {
      const md = '<details>\n<summary>Click me</summary>\n\nHidden content\n</details>'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('toggle')
      expect(getRichTextContent(blocks[0])).toBe('Click me')
      expect(blocks[0].toggle.children).toHaveLength(1)
      expect(blocks[0].toggle.children[0].type).toBe('paragraph')
    })

    it('should parse toggle with empty content', () => {
      const md = '<details>\n<summary>Empty toggle</summary>\n</details>'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].toggle.children).toHaveLength(0)
    })

    it('should parse toggle with nested block content', () => {
      const md = '<details>\n<summary>Details</summary>\n\n# Heading inside\n\n- List item\n</details>'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      const children = blocks[0].toggle.children
      expect(children).toHaveLength(2)
      expect(children[0].type).toBe('heading_1')
      expect(children[1].type).toBe('bulleted_list_item')
    })

    it('should preserve title when summary is inline with details tag', () => {
      const md = '<details><summary>Title</summary>\nContent\n</details>'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('toggle')
      expect(getRichTextContent(blocks[0])).toBe('Title')
      expect(blocks[0].toggle.children).toHaveLength(1)
      expect(blocks[0].toggle.children[0].type).toBe('paragraph')
    })

    it('should parse all-on-one-line toggle', () => {
      const md = '<details><summary>Title</summary>Content here</details>'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('toggle')
      expect(getRichTextContent(blocks[0])).toBe('Title')
      expect(blocks[0].toggle.children).toHaveLength(1)
      expect(blocks[0].toggle.children[0].type).toBe('paragraph')
    })

    it('should parse sequential toggles as siblings', () => {
      const md =
        '<details>\n<summary>First</summary>\n\nContent 1\n</details>\n\n<details>\n<summary>Second</summary>\n\nContent 2\n</details>'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('toggle')
      expect(getRichTextContent(blocks[0])).toBe('First')
      expect(blocks[0].toggle.children).toHaveLength(1)
      expect(blocks[1].type).toBe('toggle')
      expect(getRichTextContent(blocks[1])).toBe('Second')
      expect(blocks[1].toggle.children).toHaveLength(1)
    })

    it('should parse nested toggles correctly', () => {
      const md =
        '<details>\n<summary>Outer</summary>\n\n<details>\n<summary>Inner</summary>\n\nInner content\n</details>\n\n</details>'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(getRichTextContent(blocks[0])).toBe('Outer')
      const outerChildren = blocks[0].toggle.children
      expect(outerChildren).toHaveLength(1)
      expect(outerChildren[0].type).toBe('toggle')
      expect(getRichTextContent(outerChildren[0])).toBe('Inner')
      expect(outerChildren[0].toggle.children).toHaveLength(1)
    })

    it('should round-trip toggle blocks preserving title and children', () => {
      const md = '<details>\n<summary>Round Trip</summary>\n\nSome content\n</details>'
      const blocks = markdownToBlocks(md)
      const output = blocksToMarkdown(blocks)
      const reparsed = markdownToBlocks(output)
      expect(reparsed).toHaveLength(1)
      expect(reparsed[0].type).toBe('toggle')
      expect(getRichTextContent(reparsed[0])).toBe('Round Trip')
      expect(reparsed[0].toggle.children).toHaveLength(1)
    })
  })

  describe('tables', () => {
    it('should parse table with header separator', () => {
      const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('table')
      expect(blocks[0].table.has_column_header).toBe(true)
      expect(blocks[0].table.table_width).toBe(2)
      expect(blocks[0].table.children).toHaveLength(2)
    })

    it('should parse table without header separator', () => {
      const md = '| A | B |\n| C | D |'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].table.has_column_header).toBe(false)
      expect(blocks[0].table.children).toHaveLength(2)
    })

    it('should parse table with multiple data rows', () => {
      const md = '| H1 | H2 |\n| --- | --- |\n| r1c1 | r1c2 |\n| r2c1 | r2c2 |'
      const blocks = markdownToBlocks(md)
      // header row + 2 data rows = 3 table_row children
      expect(blocks[0].table.children).toHaveLength(3)
    })

    it('should extract cell text correctly', () => {
      const md = '| Name | Value |\n| --- | --- |\n| key | 42 |'
      const blocks = markdownToBlocks(md)
      const headerCells = blocks[0].table.children[0].table_row.cells
      expect(headerCells[0][0].text.content).toBe('Name')
      expect(headerCells[1][0].text.content).toBe('Value')
      const dataCells = blocks[0].table.children[1].table_row.cells
      expect(dataCells[0][0].text.content).toBe('key')
      expect(dataCells[1][0].text.content).toBe('42')
    })

    it('should parse bold text in table cells', () => {
      const md = '| Header |\n| --- |\n| **bold** |'
      const blocks = markdownToBlocks(md)
      const cell = blocks[0].table.children[1].table_row.cells[0]
      expect(cell).toHaveLength(1)
      expect(cell[0].text.content).toBe('bold')
      expect(cell[0].annotations.bold).toBe(true)
    })

    it('should parse italic text in table cells', () => {
      const md = '| Header |\n| --- |\n| *italic* |'
      const blocks = markdownToBlocks(md)
      const cell = blocks[0].table.children[1].table_row.cells[0]
      expect(cell[0].text.content).toBe('italic')
      expect(cell[0].annotations.italic).toBe(true)
    })

    it('should parse inline code in table cells', () => {
      const md = '| Header |\n| --- |\n| `code` |'
      const blocks = markdownToBlocks(md)
      const cell = blocks[0].table.children[1].table_row.cells[0]
      expect(cell[0].text.content).toBe('code')
      expect(cell[0].annotations.code).toBe(true)
    })

    it('should parse links in table cells', () => {
      const md = '| Header |\n| --- |\n| [click](https://example.com) |'
      const blocks = markdownToBlocks(md)
      const cell = blocks[0].table.children[1].table_row.cells[0]
      expect(cell[0].text.content).toBe('click')
      expect(cell[0].text.link).toEqual({ url: 'https://example.com' })
    })

    it('should parse mixed formatting in table cells', () => {
      const md = '| Header |\n| --- |\n| **bold** and *italic* |'
      const blocks = markdownToBlocks(md)
      const cell = blocks[0].table.children[1].table_row.cells[0]
      // Should have multiple rich text segments
      expect(cell.length).toBeGreaterThan(1)
      const boldSegment = cell.find((rt: any) => rt.annotations?.bold)
      expect(boldSegment).toBeDefined()
      expect(boldSegment.text.content).toBe('bold')
    })

    it('should parse rich text in header cells', () => {
      const md = '| **Bold Header** |\n| --- |\n| data |'
      const blocks = markdownToBlocks(md)
      const headerCell = blocks[0].table.children[0].table_row.cells[0]
      expect(headerCell[0].text.content).toBe('Bold Header')
      expect(headerCell[0].annotations.bold).toBe(true)
    })
  })

  describe('images', () => {
    it('should parse image with alt text', () => {
      const blocks = markdownToBlocks('![A cat](https://example.com/cat.png)')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('image')
      expect(blocks[0].image.external.url).toBe('https://example.com/cat.png')
      expect(blocks[0].image.caption[0].text.content).toBe('A cat')
    })

    it('should parse image without alt text', () => {
      const blocks = markdownToBlocks('![](https://example.com/img.png)')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].image.external.url).toBe('https://example.com/img.png')
      expect(blocks[0].image.caption).toHaveLength(0)
    })
  })

  describe('bookmarks', () => {
    it('should parse bookmark link', () => {
      const blocks = markdownToBlocks('[bookmark](https://example.com)')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('bookmark')
      expect(blocks[0].bookmark.url).toBe('https://example.com')
    })
  })

  describe('embeds', () => {
    it('should parse embed link', () => {
      const blocks = markdownToBlocks('[embed](https://youtube.com/watch?v=abc)')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('embed')
      expect(blocks[0].embed.url).toBe('https://youtube.com/watch?v=abc')
    })
  })

  describe('equations', () => {
    it('should parse single-line equation', () => {
      const blocks = markdownToBlocks('$$E = mc^2$$')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('equation')
      expect(blocks[0].equation.expression).toBe('E = mc^2')
    })

    it('should parse multi-line equation', () => {
      const md = '$$\nx^2 + y^2 = z^2\n$$'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('equation')
      expect(blocks[0].equation.expression).toBe('x^2 + y^2 = z^2')
    })

    it('should preserve newlines in multi-line equations', () => {
      const md = '$$\na = 1\nb = 2\nc = a + b\n$$'
      const blocks = markdownToBlocks(md)
      expect(blocks[0].equation.expression).toBe('a = 1\nb = 2\nc = a + b')
    })
  })

  describe('columns', () => {
    it('should parse column layout', () => {
      const md = ':::columns\n:::column\nLeft content\n:::column\nRight content\n:::end'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('column_list')
      const columns = blocks[0].column_list.children
      expect(columns).toHaveLength(2)
      expect(columns[0].type).toBe('column')
      expect(columns[1].type).toBe('column')
    })

    it('should parse column children as blocks', () => {
      const md = ':::columns\n:::column\n# Left heading\n:::column\n- List item\n:::end'
      const blocks = markdownToBlocks(md)
      const col1Children = blocks[0].column_list.children[0].column.children
      const col2Children = blocks[0].column_list.children[1].column.children
      expect(col1Children[0].type).toBe('heading_1')
      expect(col2Children[0].type).toBe('bulleted_list_item')
    })

    it('should handle columns with multiple blocks per column', () => {
      const md = ':::columns\n:::column\n# Title\nParagraph text\n:::column\n- Item 1\n- Item 2\n:::end'
      const blocks = markdownToBlocks(md)
      const col1Children = blocks[0].column_list.children[0].column.children
      const col2Children = blocks[0].column_list.children[1].column.children
      expect(col1Children).toHaveLength(2)
      expect(col2Children).toHaveLength(2)
    })

    it('should parse callout inside column', () => {
      const md = ':::columns\n:::column\n> [!NOTE]\n> Important info\n:::column\nRight side\n:::end'
      const blocks = markdownToBlocks(md)
      const col1Children = blocks[0].column_list.children[0].column.children
      expect(col1Children[0].type).toBe('callout')
    })

    it('should parse toggle inside column', () => {
      const md =
        ':::columns\n:::column\n<details><summary>Click me</summary>\nHidden content\n</details>\n:::column\nRight side\n:::end'
      const blocks = markdownToBlocks(md)
      const col1Children = blocks[0].column_list.children[0].column.children
      expect(col1Children[0].type).toBe('toggle')
      expect(col1Children[0].toggle.children).toHaveLength(1)
    })

    it('should parse three columns', () => {
      const md = ':::columns\n:::column\nCol 1\n:::column\nCol 2\n:::column\nCol 3\n:::end'
      const blocks = markdownToBlocks(md)
      const columns = blocks[0].column_list.children
      expect(columns).toHaveLength(3)
    })

    it('should handle empty column content', () => {
      const md = ':::columns\n:::column\n:::column\nRight side\n:::end'
      const blocks = markdownToBlocks(md)
      const columns = blocks[0].column_list.children
      expect(columns).toHaveLength(2)
      // Empty column should still exist but with no children
      expect(columns[0].column.children).toHaveLength(0)
    })

    it('should parse width ratio on columns', () => {
      const md = ':::columns\n:::column{width=0.7}\nWide column\n:::column{width=0.3}\nNarrow column\n:::end'
      const blocks = markdownToBlocks(md)
      const columns = blocks[0].column_list.children
      expect(columns[0].column.format?.column_ratio).toBe(0.7)
      expect(columns[1].column.format?.column_ratio).toBe(0.3)
    })

    it('should parse columns without width ratio (default)', () => {
      const md = ':::columns\n:::column\nLeft\n:::column\nRight\n:::end'
      const blocks = markdownToBlocks(md)
      const columns = blocks[0].column_list.children
      expect(columns[0].column.format).toBeUndefined()
      expect(columns[1].column.format).toBeUndefined()
    })
  })

  describe('table of contents', () => {
    it('should parse [toc]', () => {
      const blocks = markdownToBlocks('[toc]')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('table_of_contents')
    })

    it('should parse [TOC] (uppercase)', () => {
      const blocks = markdownToBlocks('[TOC]')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('table_of_contents')
    })
  })

  describe('breadcrumb', () => {
    it('should parse [breadcrumb]', () => {
      const blocks = markdownToBlocks('[breadcrumb]')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('breadcrumb')
    })

    it('should parse [BREADCRUMB] (uppercase)', () => {
      const blocks = markdownToBlocks('[BREADCRUMB]')
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('breadcrumb')
    })
  })

  describe('mixed content', () => {
    it('should parse headings + lists + paragraphs together', () => {
      const md = '# Title\n\nSome text\n\n- Item 1\n- Item 2\n\n## Subtitle\n\n1. First\n2. Second'
      const blocks = markdownToBlocks(md)
      expect(blocks[0].type).toBe('heading_1')
      expect(blocks[1].type).toBe('paragraph')
      expect(blocks[2].type).toBe('bulleted_list_item')
      expect(blocks[3].type).toBe('bulleted_list_item')
      expect(blocks[4].type).toBe('heading_2')
      expect(blocks[5].type).toBe('numbered_list_item')
      expect(blocks[6].type).toBe('numbered_list_item')
    })

    it('should flush list items when switching to non-list content', () => {
      const md = '- Item A\n- Item B\nParagraph after list'
      const blocks = markdownToBlocks(md)
      expect(blocks[0].type).toBe('bulleted_list_item')
      expect(blocks[1].type).toBe('bulleted_list_item')
      expect(blocks[2].type).toBe('paragraph')
    })

    it('should flush remaining list items at end of input', () => {
      const md = '- Last item 1\n- Last item 2'
      const blocks = markdownToBlocks(md)
      expect(blocks).toHaveLength(2)
      expect(blocks[0].type).toBe('bulleted_list_item')
      expect(blocks[1].type).toBe('bulleted_list_item')
    })
  })
})
