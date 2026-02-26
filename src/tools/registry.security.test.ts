import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
const { MockClient } = vi.hoisted(() => ({
  MockClient: vi.fn()
}))

vi.mock('./composite/pages.js', () => ({ pages: vi.fn() }))
vi.mock('./composite/databases.js', () => ({ databases: vi.fn() }))
vi.mock('./composite/blocks.js', () => ({ blocks: vi.fn() }))
vi.mock('./composite/comments.js', () => ({ commentsManage: vi.fn() }))
vi.mock('./composite/content.js', () => ({ contentConvert: vi.fn() }))
vi.mock('./composite/users.js', () => ({ users: vi.fn() }))
vi.mock('./composite/workspace.js', () => ({ workspace: vi.fn() }))
vi.mock('./composite/file-uploads.js', () => ({ fileUploads: vi.fn() }))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    readFileSync: vi.fn().mockReturnValue('mock content')
  }
})

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
    registerTools(server as any, 'test-token')
  })

  it('should BLOCK path traversal in help tool', async () => {
    const handler = server.getHandler(3) // CallToolRequestSchema

    // Attempt path traversal
    const maliciousToolName = '../../../../etc/passwd'

    // Call the handler
    const result = await handler({
      params: { name: 'help', arguments: { tool_name: maliciousToolName } }
    })

    // Expect an error response
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Invalid tool name')

    // Ensure readFileSync was NOT called with the malicious path
    expect(readFileSync).not.toHaveBeenCalledWith(expect.stringContaining('passwd'), expect.any(String))
  })

  it('should allow valid tool names', async () => {
    const handler = server.getHandler(3) // CallToolRequestSchema

    // Valid tool
    const validToolName = 'pages'

    await handler({
      params: { name: 'help', arguments: { tool_name: validToolName } }
    })

    expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('pages.md'), 'utf-8')
  })
})
