import { beforeEach, describe, expect, it, vi } from 'vitest'

const { MockClient } = vi.hoisted(() => ({
  MockClient: vi.fn()
}))

// Mock all composite tools
vi.mock('./composite/pages.js', () => ({ pages: vi.fn() }))
vi.mock('./composite/databases.js', () => ({ databases: vi.fn() }))
vi.mock('./composite/blocks.js', () => ({ blocks: vi.fn() }))
vi.mock('./composite/comments.js', () => ({ commentsManage: vi.fn() }))
vi.mock('./composite/content.js', () => ({ contentConvert: vi.fn() }))
vi.mock('./composite/users.js', () => ({ users: vi.fn() }))
vi.mock('./composite/workspace.js', () => ({ workspace: vi.fn() }))
vi.mock('./composite/file-uploads.js', () => ({ fileUploads: vi.fn() }))

// Mock node:fs to verify calls
vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue('# Mock documentation content')
}))

// Mock @notionhq/client
vi.mock('@notionhq/client', () => ({
  Client: MockClient
}))

import { readFileSync } from 'node:fs'
import { registerTools } from './registry.js'

function createMockServer() {
  const handlers: ((...args: any[]) => any)[] = []
  return {
    setRequestHandler: vi.fn((_schema: any, handler: (...args: any[]) => any) => {
      handlers.push(handler)
    }),
    getHandler: (index: number) => handlers[index]
  }
}

describe('Security: Tool Registry', () => {
  let server: ReturnType<typeof createMockServer>

  beforeEach(() => {
    vi.clearAllMocks()
    server = createMockServer()
    registerTools(server as any, 'test-notion-token')
  })

  describe('Path Traversal Prevention', () => {
    it('should prevent path traversal in help tool', async () => {
      const handler = server.getHandler(3) // CallTool handler

      const maliciousToolName = '../../README'

      const result = await handler({
        params: {
            name: 'help',
            arguments: { tool_name: maliciousToolName }
        }
      })

      // We expect an error response because the tool name is invalid/malicious
      // The current vulnerable code will return success because the mock fs allows reading the file
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toMatch(/Invalid tool name/)
    })
  })
})
