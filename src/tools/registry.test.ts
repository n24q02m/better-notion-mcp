import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

// Mock Notion Client
vi.mock('@notionhq/client', () => {
  return {
    Client: class {}
  }
})

// Mock dependencies
vi.mock('./composite/pages.js', () => ({ pages: vi.fn() }))
vi.mock('./composite/databases.js', () => ({ databases: vi.fn() }))
vi.mock('./composite/blocks.js', () => ({ blocks: vi.fn() }))
vi.mock('./composite/users.js', () => ({ users: vi.fn() }))
vi.mock('./composite/workspace.js', () => ({ workspace: vi.fn() }))
vi.mock('./composite/comments.js', () => ({ commentsManage: vi.fn() }))
vi.mock('./composite/content.js', () => ({ contentConvert: vi.fn() }))

describe('Registry Security', () => {
  it('should prevent path traversal in help tool', async () => {
    const server = {
      setRequestHandler: vi.fn()
    } as any

    registerTools(server, 'fake-token')

    // Find the CallToolRequestSchema handler
    const callHandler = server.setRequestHandler.mock.calls.find((call: any) => call[0] === CallToolRequestSchema)[1]

    expect(callHandler).toBeDefined()

    const toolName = '../../README'

    const result = await callHandler({
      params: {
        name: 'help',
        arguments: { tool_name: toolName }
      }
    })

    // Should return an error now
    expect(result.isError).toBe(true)

    const content = result.content[0].text

    // Verify it caught the invalid tool name
    expect(content).toContain('Invalid tool name')

    // Verify it did NOT leak the README content
    expect(content).not.toContain('Better Notion MCP')
  })
})
