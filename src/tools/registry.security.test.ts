import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

vi.mock('@modelcontextprotocol/sdk/server/index.js')
vi.mock('@notionhq/client')

describe('Registry Security', () => {
  let serverMock: any
  let callToolHandler: any

  beforeEach(() => {
    serverMock = {
      setRequestHandler: vi.fn((schema, handler) => {
        if (schema === CallToolRequestSchema) {
          callToolHandler = handler
        }
      })
    }
  })

  it('should prevent path traversal in help tool', async () => {
    registerTools(serverMock as unknown as Server, 'fake-token')

    const maliciousArgs = {
      name: 'help',
      arguments: {
        tool_name: '../../README'
      }
    }

    const result = await callToolHandler({ params: maliciousArgs })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unknown tool')
  })
})
