import { describe, expect, it } from 'vitest'
import { markdownToBlocks } from './markdown.js'

describe('MarkdownParser Refactor Verification', () => {
  it('should handle complex mixed content correctly', () => {
    const markdown =
      `# Heading 1
[toc]

## Heading 2
- [ ] Todo item
- Bulleted item
1. Numbered item

> Quote line
---

` +
      '```typescript' +
      `
const x = 1
` +
      '```' +
      `

| Header 1 | Header 2 |
| --- | --- |
| Row 1 Col 1 | Row 1 Col 2 |

:::columns
:::column{width=0.5}
Left column
:::column{width=0.5}
Right column
:::end

<details>
<summary>Toggle Title</summary>
Toggle content
</details>

![alt](https://example.com/image.png)
[bookmark](https://example.com)
$$e=mc^2$$`
    const blocks = markdownToBlocks(markdown)

    expect(blocks.map((b) => b.type)).toEqual([
      'heading_1',
      'table_of_contents',
      'heading_2',
      'to_do',
      'bulleted_list_item',
      'numbered_list_item',
      'quote',
      'divider',
      'code',
      'table',
      'column_list',
      'toggle',
      'image',
      'bookmark',
      'equation'
    ])
  })

  it('should handle list flushing correctly', () => {
    const markdown = `- Item 1\n\n- Item 2`
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('bulleted_list_item')
    expect(blocks[1].type).toBe('bulleted_list_item')
  })

  it('should handle empty lines between blocks', () => {
    const markdown = `# Heading\n\nParagraph`
    const blocks = markdownToBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('heading_1')
    expect(blocks[1].type).toBe('paragraph')
  })
})
