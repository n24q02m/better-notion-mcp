
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { registerTools } from './registry.js'
import { readFileSync } from 'node:fs'

// Mock fs to track calls
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    readFileSync: vi.fn().mockImplementation((path, encoding) => {
        if (path.includes('README.md')) {
            return 'SECRET CONTENT'
        }
        throw new Error(`File not found: ${path}`)
    })
  }
})

describe('Security: Path Traversal in help tool', () => {
  let server: Server
  let requestHandler: any

  beforeEach(() => {
    server = new Server(
      { name: 'test-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    )

    // Mock setRequestHandler to capture the handler
    server.setRequestHandler = vi.fn().mockImplementation((schema, handler) => {
      if (schema === CallToolRequestSchema) {
        requestHandler = handler
      }
    })

    registerTools(server, 'fake-token')
  })

  it('should prevent path traversal and return error for invalid tool name', async () => {
    const toolName = '../README'

    const response = await requestHandler({
      params: {
        name: 'help',
        arguments: { tool_name: toolName }
      }
    })

    expect(response.isError).toBe(true)
    expect(response.content[0].text).toContain('Invalid tool name')
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('should allow valid tool names', async () => {
    const toolName = 'pages'

    // We need to mock readFileSync to succeed for valid tools
    vi.mocked(readFileSync).mockReturnValueOnce('Pages documentation')

    const response = await requestHandler({
      params: {
        name: 'help',
        arguments: { tool_name: toolName }
      }
    })

    expect(response.isError).toBeUndefined()
    expect(response.content[0].text).toContain('Pages documentation')
    expect(readFileSync).toHaveBeenCalled()
  })
})
