import { describe, expect, it } from 'vitest'
import { markdownToBlocks } from './markdown.js'

describe('MarkdownParser refactor parity', () => {
  const testCases = [
    {
      name: 'headers',
      md: '# H1\n## H2\n### H3'
    },
    {
      name: 'lists',
      md: '- item 1\n- item 2\n1. numbered 1\n2. numbered 2\n- [ ] todo 1\n- [x] todo 2'
    },
    {
      name: 'code blocks',
      md: '```typescript\nconst x = 1;\n```'
    },
    {
      name: 'quotes and dividers',
      md: '> quote\n\n---\n***'
    },
    {
      name: 'images and links',
      md: '![alt](https://example.com/img.png)\n[bookmark](https://example.com)\n[embed](https://example.com)'
    },
    {
      name: 'tables',
      md: '| a | b |\n|---|---|\n| 1 | 2 |'
    },
    {
      name: 'callouts',
      md: '> [!NOTE] note content\n> more content'
    },
    {
      name: 'equations',
      md: '$$x^2$$'
    },
    {
      name: 'toggles',
      md: '<details>\n<summary>summary</summary>\ncontent\n</details>'
    },
    {
      name: 'columns',
      md: ':::columns\n:::column\ncol 1\n:::column\ncol 2\n:::end'
    },
    {
      name: 'TOC and Breadcrumb',
      md: '[toc]\n[breadcrumb]'
    }
  ]

  for (const tc of testCases) {
    it(`should handle ${tc.name} identically`, () => {
      const blocks = markdownToBlocks(tc.md)
      expect(blocks).toMatchSnapshot()
    })
  }
})
