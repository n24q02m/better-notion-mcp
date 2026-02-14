
import { describe, it, expect, vi } from 'vitest'
import { registerTools } from './registry.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// Mock SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: class MockServer {
      requestHandlers = new Map()
      constructor() {}
      setRequestHandler(schema: any, handler: any) {
        this.requestHandlers.set(schema, handler)
      }
      connect() {}
    }
  }
})

vi.mock('@notionhq/client', () => ({
    Client: class MockClient {
        constructor() {}
    }
}))

describe('Security: Tool Registry', () => {
  it('should prevent path traversal in help tool', async () => {
    const server = new Server({ name: 'test', version: '1.0' }, { capabilities: {} })
    registerTools(server as any, 'fake-token')

    const handler = (server as any).requestHandlers.get(CallToolRequestSchema)
    expect(handler).toBeDefined()

    const request = {
      params: {
        name: 'help',
        arguments: {
            tool_name: '../../package.json' // Try to traverse up
        }
      }
    }

    const result = await handler(request)

    // Expect error
    expect(result.isError).toBe(true)
    const errorText = result.content[0].text
    expect(errorText).toContain('Invalid tool name: ../../package.json')
  })

  it('should allow valid tool names', async () => {
    const server = new Server({ name: 'test', version: '1.0' }, { capabilities: {} })
    registerTools(server as any, 'fake-token')

    const handler = (server as any).requestHandlers.get(CallToolRequestSchema)

    const request = {
      params: {
        name: 'help',
        arguments: {
            tool_name: 'pages'
        }
      }
    }

    const result = await handler(request)
    // If it fails, it should not be due to invalid tool name
    if (result.isError) {
         expect(result.content[0].text).not.toContain('Invalid tool name')
    }
  })
})
