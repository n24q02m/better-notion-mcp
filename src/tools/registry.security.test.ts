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

// Mock node:fs
vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue('# Mock content')
}))

// Mock @notionhq/client
vi.mock('@notionhq/client', () => ({
  Client: MockClient
}))

import { readFileSync } from 'node:fs'
import { registerTools } from './registry'

function createMockServer() {
  const handlers: ((...args: any[]) => any)[] = []
  return {
    setRequestHandler: vi.fn((_schema: any, handler: (...args: any[]) => any) => {
      handlers.push(handler)
    }),
    getHandler: (index: number) => handlers[index]
  }
}

describe('Security: registerTools', () => {
  let server: ReturnType<typeof createMockServer>

  beforeEach(() => {
    vi.clearAllMocks()
    server = createMockServer()
    registerTools(server as any, 'test-notion-token')
  })

  describe('Path Traversal in help tool', () => {
    it('should REJECT path traversal in tool_name', async () => {
      const handler = server.getHandler(3) // CallToolRequestSchema is the 4th handler (index 3)

      const maliciousToolName = '../../README'

      const result = await handler({
        params: { name: 'help', arguments: { tool_name: maliciousToolName } }
      })

      // Expect an error response
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid tool name')

      // Ensure readFileSync was NOT called with the traversed path
      // In fact, it should not be called at all if validation fails early
      expect(readFileSync).not.toHaveBeenCalled()
    })

    it('should ALLOW valid tool names', async () => {
      const handler = server.getHandler(3)

      const result = await handler({
        params: { name: 'help', arguments: { tool_name: 'pages' } }
      })

      expect(result.isError).toBeUndefined()
      expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('pages.md'), 'utf-8')
    })
  })
})
