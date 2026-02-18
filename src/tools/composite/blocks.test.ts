import { describe, expect, it, vi, beforeEach } from 'vitest'
import { blocks } from './blocks'
import type { Client } from '@notionhq/client'

// Mock dependencies
vi.mock('../helpers/pagination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../helpers/pagination')>()
  return {
    ...actual,
    autoPaginate: vi.fn(async (fn) => {
      const response = await fn(undefined, 100)
      return response.results
    })
  }
})

describe('Blocks Tool', () => {
    let mockNotion: any

    beforeEach(() => {
        mockNotion = {
            blocks: {
                children: {
                    append: vi.fn()
                },
                retrieve: vi.fn()
            }
        }
    })

    it('should append blocks in batches of 100', async () => {
        // Create a large markdown content
        // Ensure we create enough blocks. markdownToBlocks splits by newline.
        // We need 150 blocks.
        const content = Array.from({ length: 150 }, (_, i) => `Paragraph ${i}`).join('\n')

        // Mock append
        mockNotion.blocks.children.append.mockResolvedValue({})

        // Run append action
        await blocks(mockNotion as unknown as Client, {
            action: 'append',
            block_id: 'block-1',
            content: content
        })

        // Verify batching
        const appendCalls = mockNotion.blocks.children.append.mock.calls
        expect(appendCalls.length).toBeGreaterThan(1)

        let totalBlocks = 0
        for (const call of appendCalls) {
            expect(call[0].children.length).toBeLessThanOrEqual(100)
            totalBlocks += call[0].children.length
        }
        expect(totalBlocks).toBe(150)
    })
})
