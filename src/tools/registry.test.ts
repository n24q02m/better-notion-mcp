import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerTools } from './registry.js'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: class {
      handlers = new Map()
      setRequestHandler(schema: any, handler: any) {
        this.handlers.set(schema, handler)
      }
      connect() {}
    }
  }
})

vi.mock('@notionhq/client', () => ({
  Client: class {
    // Removed useless constructor
  }
}))

// Mock fs to avoid reading real files
vi.mock('node:fs', () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.includes('pages.md')) return '# Pages Docs'
    throw new Error(`File not found: ${path}`)
  })
}))

describe('registerTools Security', () => {
  let server: any
  let callToolHandler: any

  beforeEach(() => {
    vi.clearAllMocks()

    // @ts-expect-error - Mocked Server constructor doesn't match strict type
    server = new Server()

    // Call registerTools
    registerTools(server, 'fake-token')

    // Get the handler for CallToolRequestSchema
    // We need to access the handlers map from our mock
    // @ts-expect-error - handlers property exists on our mock but not on real Server type
    callToolHandler = server.handlers.get(CallToolRequestSchema)
  })

  it('should prevent path traversal in help tool', async () => {
    const request = {
      params: {
        name: 'help',
        arguments: { tool_name: '../../README' }
      }
    }

    const response = await callToolHandler(request)

    expect(response.isError).toBe(true)
    expect(response.content[0].text).toContain('Invalid tool name')
    expect(response.content[0].text).toContain('../../README')
  })

  it('should allow valid tool names', async () => {
    // We mocked readFileSync to return '# Pages Docs' for 'pages.md'
    const request = {
      params: {
        name: 'help',
        arguments: { tool_name: 'pages' }
      }
    }

    const response = await callToolHandler(request)

    expect(response.content[0].text).toContain('# Pages Docs')
  })

  it('should block unknown tool names', async () => {
    const request = {
      params: {
        name: 'help',
        arguments: { tool_name: 'unknown_tool' }
      }
    }

    const response = await callToolHandler(request)

    expect(response.isError).toBe(true)
    expect(response.content[0].text).toContain('Invalid tool name')
    expect(response.content[0].text).toContain('unknown_tool')
  })
})
