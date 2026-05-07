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
describe('blocksToMarkdown', () => {
  describe('headings', () => {
    it('should convert heading_1 to # markdown', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: [plainRichText('Title')], color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('# Title')
    })

    it('should convert heading_2 to ## markdown', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [plainRichText('Sub')], color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('## Sub')
    })

    it('should convert heading_3 to ### markdown', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'heading_3',
          heading_3: { rich_text: [plainRichText('Deep')], color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('### Deep')
    })
  })

  describe('paragraphs', () => {
    it('should convert paragraph to plain text', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [plainRichText('Hello world')], color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('Hello world')
    })
  })

  describe('bulleted lists', () => {
    it('should convert bulleted_list_item to - prefixed line', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: [plainRichText('Item')], color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('- Item')
    })
  })

  describe('numbered lists', () => {
    it('should convert numbered_list_item to 1. prefixed line', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: { rich_text: [plainRichText('Step')], color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('1. Step')
    })
  })

  describe('todo items', () => {
    it('should convert unchecked to_do to - [ ] format', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'to_do',
          to_do: { rich_text: [plainRichText('Task')], checked: false, color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('- [ ] Task')
    })

    it('should convert checked to_do to - [x] format', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'to_do',
          to_do: { rich_text: [plainRichText('Done')], checked: true, color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('- [x] Done')
    })
  })

  describe('code blocks', () => {
    it('should convert code block with language', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'code',
          code: { rich_text: [plainRichText('const x = 1')], language: 'javascript' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('```javascript\nconst x = 1\n```')
    })

    it('should convert code block without language', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'code',
          code: { rich_text: [plainRichText('hello')], language: '' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('```\nhello\n```')
    })
  })

  describe('quotes', () => {
    it('should convert quote block to > format', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'quote',
          quote: { rich_text: [plainRichText('Wise words')], color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('> Wise words')
    })
  })

  describe('dividers', () => {
    it('should convert divider to ---', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'divider',
          divider: {}
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('---')
    })
  })

  describe('callouts', () => {
    it('should convert callout to > [!TYPE] format', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [plainRichText('Important info')],
            icon: { type: 'emoji', emoji: '\u2757' },
            color: 'purple_background'
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      expect(md).toMatch(/^> \[!IMPORTANT\] Important info$/)
    })

    it('should default to NOTE for unknown icon', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [plainRichText('Some text')],
            icon: { type: 'emoji', emoji: '\u{1F600}' },
            color: 'gray_background'
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      expect(md).toContain('[!NOTE]')
    })
  })

  describe('toggles', () => {
    it('should convert toggle to <details> HTML', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [plainRichText('Toggle title')],
            color: 'default',
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [plainRichText('Hidden text')], color: 'default' }
              }
            ]
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      expect(md).toContain('<details>')
      expect(md).toContain('<summary>Toggle title</summary>')
      expect(md).toContain('Hidden text')
      expect(md).toContain('</details>')
    })

    it('should convert toggle without children', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [plainRichText('Empty toggle')],
            color: 'default',
            children: []
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      expect(md).toBe('<details>\n<summary>Empty toggle</summary>\n</details>')
    })
  })

  describe('images', () => {
    it('should convert external image to ![alt](url)', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: { url: 'https://example.com/img.png' },
            caption: [plainRichText('Alt text')]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('![Alt text](https://example.com/img.png)')
    })

    it('should handle image without caption', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: { url: 'https://example.com/img.png' },
            caption: []
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('![](https://example.com/img.png)')
    })
  })

  describe('bookmarks', () => {
    it('should convert bookmark to [bookmark](url)', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'bookmark',
          bookmark: { url: 'https://example.com', caption: [] }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[bookmark](https://example.com)')
    })
  })

  describe('embeds', () => {
    it('should convert embed to [embed](url)', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'embed',
          embed: { url: 'https://youtube.com/watch?v=abc' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[embed](https://youtube.com/watch?v=abc)')
    })
  })

  describe('equations', () => {
    it('should convert equation to $$expression$$', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'equation',
          equation: { expression: 'E = mc^2' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('$$E = mc^2$$')
    })
  })

  describe('tables', () => {
    it('should convert table with header to pipe-delimited format', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'table',
          table: {
            table_width: 2,
            has_column_header: true,
            has_row_header: false,
            children: [
              {
                object: 'block',
                type: 'table_row',
                table_row: { cells: [[plainRichText('H1')], [plainRichText('H2')]] }
              },
              {
                object: 'block',
                type: 'table_row',
                table_row: { cells: [[plainRichText('A')], [plainRichText('B')]] }
              }
            ]
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      const lines = md.split('\n')
      expect(lines[0]).toBe('| H1 | H2 |')
      expect(lines[1]).toBe('| --- | --- |')
      expect(lines[2]).toBe('| A | B |')
    })

    it('should convert table without header (no separator row)', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'table',
          table: {
            table_width: 2,
            has_column_header: false,
            has_row_header: false,
            children: [
              {
                object: 'block',
                type: 'table_row',
                table_row: { cells: [[plainRichText('A')], [plainRichText('B')]] }
              },
              {
                object: 'block',
                type: 'table_row',
                table_row: { cells: [[plainRichText('C')], [plainRichText('D')]] }
              }
            ]
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      const lines = md.split('\n')
      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe('| A | B |')
      expect(lines[1]).toBe('| C | D |')
    })
  })

  describe('column_list', () => {
    it('should convert column_list to :::columns format', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'column_list',
          column_list: {
            children: [
              {
                object: 'block',
                type: 'column',
                column: {
                  children: [
                    {
                      object: 'block',
                      type: 'paragraph',
                      paragraph: { rich_text: [plainRichText('Left')], color: 'default' }
                    }
                  ]
                }
              },
              {
                object: 'block',
                type: 'column',
                column: {
                  children: [
                    {
                      object: 'block',
                      type: 'paragraph',
                      paragraph: { rich_text: [plainRichText('Right')], color: 'default' }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      expect(md).toContain(':::columns')
      expect(md).toContain(':::column')
      expect(md).toContain('Left')
      expect(md).toContain('Right')
      expect(md).toContain(':::end')
    })

    it('should emit width ratio on columns', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'column_list',
          column_list: {
            children: [
              {
                object: 'block',
                type: 'column',
                column: {
                  children: [
                    {
                      object: 'block',
                      type: 'paragraph',
                      paragraph: { rich_text: [plainRichText('Wide')], color: 'default' }
                    }
                  ],
                  format: { column_ratio: 0.7 }
                }
              },
              {
                object: 'block',
                type: 'column',
                column: {
                  children: [
                    {
                      object: 'block',
                      type: 'paragraph',
                      paragraph: { rich_text: [plainRichText('Narrow')], color: 'default' }
                    }
                  ],
                  format: { column_ratio: 0.3 }
                }
              }
            ]
          }
        }
      ]
      const md = blocksToMarkdown(blocks)
      expect(md).toContain(':::column{width=0.7}')
      expect(md).toContain(':::column{width=0.3}')
    })

    it('should round-trip columns with width ratios', () => {
      const md = ':::columns\n:::column{width=0.7}\nWide content\n:::column{width=0.3}\nNarrow content\n:::end'
      const blocks = markdownToBlocks(md)
      const result = blocksToMarkdown(blocks)
      expect(result).toContain(':::column{width=0.7}')
      expect(result).toContain(':::column{width=0.3}')
      expect(result).toContain('Wide content')
      expect(result).toContain('Narrow content')
    })

    it('should round-trip columns with callout inside', () => {
      const md = ':::columns\n:::column\n> [!NOTE]\n> Important info\n:::column\nRight side\n:::end'
      const blocks = markdownToBlocks(md)
      const result = blocksToMarkdown(blocks)
      expect(result).toContain(':::columns')
      expect(result).toContain('> [!NOTE]')
      expect(result).toContain('Right side')
      expect(result).toContain(':::end')
    })
  })

  describe('table_of_contents', () => {
    it('should convert table_of_contents to [toc]', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'table_of_contents',
          table_of_contents: { color: 'default' }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[toc]')
    })
  })

  describe('breadcrumb', () => {
    it('should convert breadcrumb to [breadcrumb]', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'breadcrumb',
          breadcrumb: {}
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[breadcrumb]')
    })
  })

  describe('nested children', () => {
    it('should render nested bulleted list items with indentation', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [plainRichText('Parent')],
            color: 'default',
            children: [
              {
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: [plainRichText('Child 1')], color: 'default' }
              },
              {
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: [plainRichText('Child 2')], color: 'default' }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('- Parent\n  - Child 1\n  - Child 2')
    })

    it('should render nested numbered list items with indentation', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [plainRichText('Step 1')],
            color: 'default',
            children: [
              {
                object: 'block',
                type: 'numbered_list_item',
                numbered_list_item: { rich_text: [plainRichText('Sub-step')], color: 'default' }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('1. Step 1\n  1. Sub-step')
    })

    it('should render nested to_do items with indentation', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [plainRichText('Main task')],
            checked: false,
            color: 'default',
            children: [
              {
                object: 'block',
                type: 'to_do',
                to_do: { rich_text: [plainRichText('Sub-task')], checked: true, color: 'default' }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('- [ ] Main task\n  - [x] Sub-task')
    })

    it('should render quote with nested children', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [plainRichText('Quote text')],
            color: 'default',
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [plainRichText('Nested paragraph')], color: 'default' }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('> Quote text\n> Nested paragraph')
    })

    it('should render callout with nested children', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [plainRichText('Important')],
            icon: { type: 'emoji', emoji: '\u2757' },
            color: 'red_background',
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [plainRichText('Details here')], color: 'default' }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('> [!IMPORTANT] Important\n> Details here')
    })

    it('should render heading with nested children', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [plainRichText('Section')],
            color: 'default',
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [plainRichText('Content under heading')], color: 'default' }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('# Section\nContent under heading')
    })

    it('should handle deeply nested bulleted lists', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [plainRichText('Level 1')],
            color: 'default',
            children: [
              {
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                  rich_text: [plainRichText('Level 2')],
                  color: 'default',
                  children: [
                    {
                      object: 'block',
                      type: 'bulleted_list_item',
                      bulleted_list_item: { rich_text: [plainRichText('Level 3')], color: 'default' }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('- Level 1\n  - Level 2\n    - Level 3')
    })
  })

  describe('media blocks', () => {
    it('should render file block as link', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'file',
          file: { file: { url: 'https://example.com/doc.pdf' }, name: 'document.pdf', caption: [] }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[document.pdf](https://example.com/doc.pdf)')
    })

    it('should render pdf block as link', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'pdf',
          pdf: { external: { url: 'https://example.com/report.pdf' }, caption: [] }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[pdf](https://example.com/report.pdf)')
    })

    it('should render video block as link', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'video',
          video: { external: { url: 'https://youtube.com/watch?v=123' }, caption: [] }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[video](https://youtube.com/watch?v=123)')
    })

    it('should render audio block as link', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'audio',
          audio: { file: { url: 'https://example.com/song.mp3' }, caption: [] }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[audio](https://example.com/song.mp3)')
    })

    it('should use caption as name when name is absent', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'file',
          file: {
            file: { url: 'https://example.com/f.zip' },
            caption: [
              {
                type: 'text',
                text: { content: 'My archive' },
                annotations: {
                  bold: false,
                  italic: false,
                  strikethrough: false,
                  underline: false,
                  code: false,
                  color: 'default'
                }
              }
            ]
          }
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[My archive](https://example.com/f.zip)')
    })
  })

  describe('child page and database blocks', () => {
    it('should render child_page as link', () => {
      const blocks: NotionBlock[] = [
        { object: 'block', type: 'child_page', id: 'page-123', child_page: { title: 'My Sub Page' } }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[My Sub Page](page-123)')
    })

    it('should render child_database as link', () => {
      const blocks: NotionBlock[] = [
        { object: 'block', type: 'child_database', id: 'db-456', child_database: { title: 'Tasks DB' } }
      ]
      expect(blocksToMarkdown(blocks)).toBe('[Tasks DB](db-456)')
    })
  })

  describe('unsupported block types', () => {
    it('should skip unknown block types', () => {
      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'unsupported',
          unsupported: {}
        }
      ]
      expect(blocksToMarkdown(blocks)).toBe('')
    })
  })
})

// ============================================================
// parseRichText
// ============================================================

describe('parseRichText', () => {
  it('should parse plain text', () => {
    const result = parseRichText('Hello')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('Hello')
    expect(result[0].annotations.bold).toBe(false)
    expect(result[0].annotations.italic).toBe(false)
  })

  it('should parse bold text', () => {
    const result = parseRichText('**bold**')
    const boldPart = result.find((rt) => rt.annotations.bold)
    expect(boldPart).toBeDefined()
    expect(boldPart!.text.content).toBe('bold')
  })

  it('should parse italic text', () => {
    const result = parseRichText('*italic*')
    const italicPart = result.find((rt) => rt.annotations.italic)
    expect(italicPart).toBeDefined()
    expect(italicPart!.text.content).toBe('italic')
  })

  it('should parse inline code', () => {
    const result = parseRichText('`code`')
    const codePart = result.find((rt) => rt.annotations.code)
    expect(codePart).toBeDefined()
    expect(codePart!.text.content).toBe('code')
  })

  it('should parse strikethrough text', () => {
    const result = parseRichText('~~deleted~~')
    const strikePart = result.find((rt) => rt.annotations.strikethrough)
    expect(strikePart).toBeDefined()
    expect(strikePart!.text.content).toBe('deleted')
  })

  it('should parse link', () => {
    const result = parseRichText('[click here](https://example.com)')
    const linkPart = result.find((rt) => rt.text.link)
    expect(linkPart).toBeDefined()
    expect(linkPart!.text.content).toBe('click here')
    expect(linkPart!.text.link!.url).toBe('https://example.com')
  })

  it('should parse mixed plain and bold text', () => {
    const result = parseRichText('Hello **world** end')
    expect(result).toHaveLength(3)
    expect(result[0].text.content).toBe('Hello ')
    expect(result[0].annotations.bold).toBe(false)
    expect(result[1].text.content).toBe('world')
    expect(result[1].annotations.bold).toBe(true)
    expect(result[2].text.content).toBe(' end')
    expect(result[2].annotations.bold).toBe(false)
  })

  it('should parse text with multiple formatting types', () => {
    const result = parseRichText('**bold** and *italic*')
    const boldPart = result.find((rt) => rt.annotations.bold)
    const italicPart = result.find((rt) => rt.annotations.italic)
    expect(boldPart).toBeDefined()
    expect(italicPart).toBeDefined()
    expect(boldPart!.text.content).toBe('bold')
    expect(italicPart!.text.content).toBe('italic')
  })

  it('should return rich text with empty content for empty string', () => {
    const result = parseRichText('')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('')
  })

  it('should set underline to false always', () => {
    const result = parseRichText('text')
    expect(result[0].annotations.underline).toBe(false)
  })

  it('should set color to default', () => {
    const result = parseRichText('text')
    expect(result[0].annotations.color).toBe('default')
  })

  it('should set link to null for non-link text', () => {
    const result = parseRichText('plain')
    expect(result[0].text.link).toBeNull()
  })

  describe('page mentions', () => {
    it('should parse @[Title](page-id) as mention rich text', () => {
      const result = parseRichText('@[My Page](abc123def456)')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('mention')
      expect((result[0] as any).mention).toEqual({ page: { id: 'abc123def456' } })
      expect(result[0].plain_text).toBe('My Page')
    })

    it('should parse mention with UUID page id', () => {
      const result = parseRichText('@[Test](a1b2c3d4-e5f6-7890-abcd-ef1234567890)')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('mention')
      expect((result[0] as any).mention).toEqual({ page: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } })
    })

    it('should parse mention with Notion URL and extract page id', () => {
      const result = parseRichText('@[My Page](https://www.notion.so/My-Page-abc123def456abc123def456abc123de)')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('mention')
      expect((result[0] as any).mention).toEqual({ page: { id: 'abc123def456abc123def456abc123de' } })
    })

    it('should parse mention mixed with plain text', () => {
      const result = parseRichText('See @[My Page](abc123) for details')
      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('text')
      expect(result[0].text.content).toBe('See ')
      expect(result[1].type).toBe('mention')
      expect((result[1] as any).mention).toEqual({ page: { id: 'abc123' } })
      expect(result[1].plain_text).toBe('My Page')
      expect(result[2].type).toBe('text')
      expect(result[2].text.content).toBe(' for details')
    })

    it('should not confuse regular links with mentions', () => {
      const result = parseRichText('[click](https://example.com)')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('text')
      expect(result[0].text.link!.url).toBe('https://example.com')
    })
  })
})

// ============================================================
// richTextToMarkdown (via blocksToMarkdown)
// ============================================================

describe('richTextToMarkdown mention handling', () => {
  it('should serialize page mention to @[Title](id)', () => {
    const blocks: NotionBlock[] = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'mention',
              mention: { page: { id: 'abc123' } },
              plain_text: 'My Page',
              href: 'https://www.notion.so/abc123',
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            }
          ],
          color: 'default'
        }
      }
    ]
    expect(blocksToMarkdown(blocks)).toBe('@[My Page](abc123)')
  })

  it('should serialize mention alongside plain text', () => {
    const blocks: NotionBlock[] = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            plainRichText('See '),
            {
              type: 'mention',
              mention: { page: { id: 'abc123' } },
              plain_text: 'My Page',
              href: 'https://www.notion.so/abc123',
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            },
            plainRichText(' for details')
          ],
          color: 'default'
        }
      }
    ]
    expect(blocksToMarkdown(blocks)).toBe('See @[My Page](abc123) for details')
  })

  it('should not drop mention elements silently', () => {
    const blocks: NotionBlock[] = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'mention',
              mention: { page: { id: 'xyz789' } },
              plain_text: 'Referenced Page',
              href: null,
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            }
          ],
          color: 'default'
        }
      }
    ]
    const result = blocksToMarkdown(blocks)
    expect(result).not.toBe('')
    expect(result).toContain('Referenced Page')
    expect(result).toContain('xyz789')
  })

  it('should handle database mention gracefully', () => {
    const blocks: NotionBlock[] = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'mention',
              mention: { database: { id: 'db123' } },
              plain_text: 'My Database',
              href: 'https://www.notion.so/db123',
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default'
              }
            }
          ],
          color: 'default'
        }
      }
    ]
    const result = blocksToMarkdown(blocks)
    expect(result).toContain('My Database')
  })
})

// ============================================================
// extractPlainText
// ============================================================

describe('extractPlainText', () => {
  it('should extract plain text from single rich text element', () => {
    const richText: RichText[] = [plainRichText('Hello')]
    expect(extractPlainText(richText)).toBe('Hello')
  })

  it('should concatenate text from multiple rich text elements', () => {
    const richText: RichText[] = [plainRichText('Hello '), plainRichText('world')]
    expect(extractPlainText(richText)).toBe('Hello world')
  })

  it('should ignore annotations and return raw content', () => {
    const richText: RichText[] = [
      {
        type: 'text',
        text: { content: 'bold text', link: null },
        annotations: {
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }
    ]
    expect(extractPlainText(richText)).toBe('bold text')
  })

  it('should return empty string for empty array', () => {
    expect(extractPlainText([])).toBe('')
  })
})

// ============================================================
// Round-trip conversion
// ============================================================

describe('round-trip conversion', () => {
  it('should preserve heading_1 content', () => {
    const md = '# Hello World'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve heading_2 content', () => {
    const md = '## Section'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve heading_3 content', () => {
    const md = '### Subsection'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve paragraph content', () => {
    const md = 'Just a paragraph'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve bulleted list items', () => {
    const md = '- First\n- Second'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should normalize asterisk bullets to dash on round-trip', () => {
    const input = '* Item'
    const output = blocksToMarkdown(markdownToBlocks(input))
    expect(output).toBe('- Item')
  })

  it('should preserve numbered list items (always outputs 1.)', () => {
    const md = '1. First\n1. Second'
    const input = '1. First\n2. Second'
    expect(blocksToMarkdown(markdownToBlocks(input))).toBe(md)
  })

  it('should preserve unchecked todo', () => {
    const md = '- [ ] Task'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve checked todo', () => {
    const md = '- [x] Done'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve code block with language', () => {
    const md = '```python\nprint("hi")\n```'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should convert code block without language to plain text on round-trip', () => {
    const input = '```\ncode\n```'
    const output = blocksToMarkdown(markdownToBlocks(input))
    expect(output).toBe('```plain text\ncode\n```')
  })

  it('should preserve quote', () => {
    const md = '> Quoted text'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should normalize *** divider to --- on round-trip', () => {
    const input = '***'
    const output = blocksToMarkdown(markdownToBlocks(input))
    expect(output).toBe('---')
  })

  it('should preserve --- divider', () => {
    const md = '---'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve single-line equation', () => {
    const md = '$$x^2 + 1$$'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should flatten multi-line equation to single-line on round-trip', () => {
    const input = '$$\na + b\n$$'
    const output = blocksToMarkdown(markdownToBlocks(input))
    expect(output).toBe('$$a + b$$')
  })

  it('should preserve bookmark', () => {
    const md = '[bookmark](https://example.com)'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve embed', () => {
    const md = '[embed](https://youtube.com/watch?v=abc)'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve image with alt text', () => {
    const md = '![photo](https://example.com/img.png)'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve image without alt text', () => {
    const md = '![](https://example.com/img.png)'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should preserve [toc]', () => {
    const md = '[toc]'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should normalize [TOC] to [toc] on round-trip', () => {
    const input = '[TOC]'
    const output = blocksToMarkdown(markdownToBlocks(input))
    expect(output).toBe('[toc]')
  })

  it('should preserve [breadcrumb]', () => {
    const md = '[breadcrumb]'
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md)
  })

  it('should normalize [BREADCRUMB] to [breadcrumb] on round-trip', () => {
    const input = '[BREADCRUMB]'
    const output = blocksToMarkdown(markdownToBlocks(input))
    expect(output).toBe('[breadcrumb]')
  })

  it('should preserve table with header through round-trip', () => {
    const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |'
    const output = blocksToMarkdown(markdownToBlocks(md))
    const lines = output.split('\n')
    expect(lines[0]).toBe('| Name | Age |')
    expect(lines[1]).toBe('| --- | --- |')
    expect(lines[2]).toBe('| Alice | 30 |')
  })

  it('should preserve callout type through round-trip', () => {
    const md = '> [!WARNING] Watch out'
    const output = blocksToMarkdown(markdownToBlocks(md))
    expect(output).toContain('[!WARNING]')
    expect(output).toContain('Watch out')
  })

  it('should preserve toggle through round-trip', () => {
    const md = '<details>\n<summary>FAQ</summary>\n\nAnswer here\n</details>'
    const output = blocksToMarkdown(markdownToBlocks(md))
    expect(output).toContain('<details>')
    expect(output).toContain('<summary>FAQ</summary>')
    expect(output).toContain('Answer here')
    expect(output).toContain('</details>')
  })

  it('should preserve empty input through round-trip', () => {
    expect(blocksToMarkdown(markdownToBlocks(''))).toBe('')
  })

  it('should preserve mixed content structure', () => {
    const md = '# Title\n- Item 1\n- Item 2\n---\n> Quote'
    const blocks = markdownToBlocks(md)
    const output = blocksToMarkdown(blocks)
    expect(output).toContain('# Title')
    expect(output).toContain('- Item 1')
    expect(output).toContain('- Item 2')
    expect(output).toContain('---')
    expect(output).toContain('> Quote')
  })
})
