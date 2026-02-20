import { beforeEach, describe, expect, it, vi } from 'vitest'

const { MockClient, readFileSyncMock } = vi.hoisted(() => ({
  MockClient: vi.fn(),
  readFileSyncMock: vi.fn()
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
  readFileSync: readFileSyncMock
}))

// Mock @notionhq/client
vi.mock('@notionhq/client', () => ({
  Client: MockClient
}))

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

describe('Security: Path Traversal in help tool', () => {
  let server: ReturnType<typeof createMockServer>

  beforeEach(() => {
    vi.clearAllMocks()
    readFileSyncMock.mockReturnValue('# Mock content')
    server = createMockServer()
    registerTools(server as any, 'test-token')
  })

  it('test_help_invalidToolName_returnsError', async () => {
    const handler = server.getHandler(3)
    const maliciousInput = '../../README'

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: maliciousInput }
      }
    })

    // Verify that readFileSync was NOT called
    expect(readFileSyncMock).not.toHaveBeenCalled()

    // Verify error response
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Invalid tool name')
    expect(result.content[0].text).toContain('../../README')
  })

  it('test_help_validToolName_returnsDocumentation', async () => {
    const handler = server.getHandler(3)
    const validInput = 'pages'

    const result = await handler({
      params: {
        name: 'help',
        arguments: { tool_name: validInput }
      }
    })

    // Verify successful read
    expect(readFileSyncMock).toHaveBeenCalledWith(expect.stringContaining('pages.md'), 'utf-8')

    // Verify success response
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.tool).toBe('pages')
    expect(parsed.documentation).toBe('# Mock content')
    expect(result.isError).toBeFalsy()
  })
})
