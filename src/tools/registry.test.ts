import { readFileSync } from 'node:fs'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js')
vi.mock('@notionhq/client')
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs')
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue('MOCKED CONTENT')
  }
})

describe('Path Traversal Vulnerability in Help Tool', () => {
  let server: any
  let handler: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock server
    server = {
      setRequestHandler: vi.fn()
    }

    // Register tools
    registerTools(server as unknown as Server, 'fake-token')

    // Get the handler
    const calls = server.setRequestHandler.mock.calls
    const callToolCall = calls.find((call: any[]) => call[0] === CallToolRequestSchema)
    handler = callToolCall[1]
  })

  it('should prevent path traversal and return validation error', async () => {
    // This test simulates a malicious request bypassing schema validation
    const request = {
      params: {
        name: 'help',
        arguments: {
          tool_name: '../../../README'
        }
      }
    }

    // Execute handler
    const result = await handler(request)

    // Verify it returns an error
    expect(result.isError).toBe(true)
    const text = result.content[0].text
    expect(text).toContain('Invalid tool name')
    // We check for the suggestion which lists available tools
    expect(text).toContain('Available tools')

    // Verify readFileSync was NOT called
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('should allow valid tool names', async () => {
    const request = {
      params: {
        name: 'help',
        arguments: {
          tool_name: 'pages'
        }
      }
    }

    // Execute handler
    const result = await handler(request)

    // Verify it does not error
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('pages')
    expect(result.content[0].text).toContain('MOCKED CONTENT')

    // Verify readFileSync WAS called
    expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('pages.md'), 'utf-8')
  })
})
