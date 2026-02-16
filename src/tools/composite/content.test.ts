import { describe, it, expect } from 'vitest'
import { contentConvert } from './content.js'

describe('content tool', () => {
  it('should convert markdown to blocks', async () => {
    const result = await contentConvert({
      direction: 'markdown-to-blocks',
      content: '# Hello'
    })

    expect(result.blocks).toBeDefined()
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].heading_1).toBeDefined()
  })

  it('should convert blocks to markdown', async () => {
    const blocks = [{
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', text: { content: 'Hello' }, plain_text: 'Hello' }]
      }
    }]

    const result = await contentConvert({
      direction: 'blocks-to-markdown',
      content: blocks
    })

    expect(result.markdown).toContain('# Hello')
  })
})
