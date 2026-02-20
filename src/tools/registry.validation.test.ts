import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerTools } from './registry.js'

// Mock the dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class {
    setRequestHandler(schema: any, handler: any) {
      if (schema === CallToolRequestSchema) {
        this.callToolHandler = handler
      }
    }
    callToolHandler: any
  }
}))

vi.mock('@notionhq/client', () => ({
  Client: class {}
}))

// Mock the tool implementations
vi.mock('./composite/pages.js', () => ({
  pages: vi.fn().mockResolvedValue({ object: 'page' })
}))
vi.mock('./composite/databases.js', () => ({
  databases: vi.fn().mockResolvedValue({ object: 'database' })
}))
vi.mock('./composite/blocks.js', () => ({
  blocks: vi.fn().mockResolvedValue({ object: 'block' })
}))
vi.mock('./composite/users.js', () => ({
  users: vi.fn().mockResolvedValue({ object: 'user' })
}))
vi.mock('./composite/workspace.js', () => ({
  workspace: vi.fn().mockResolvedValue({ object: 'workspace' })
}))
vi.mock('./composite/comments.js', () => ({
  commentsManage: vi.fn().mockResolvedValue({ object: 'comment' })
}))
vi.mock('./composite/content.js', () => ({
  contentConvert: vi.fn().mockResolvedValue({ object: 'content' })
}))

describe('Tool Registry Validation', () => {
  let server: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const ServerClass = (await import('@modelcontextprotocol/sdk/server/index.js')).Server as any
    server = new ServerClass()
    registerTools(server, 'fake-token')
  })

  it('should fail when calling pages tool with invalid action', async () => {
    const response = await server.callToolHandler({
      params: {
        name: 'pages',
        arguments: {
          action: 'invalid_action',
          page_id: '123'
        }
      }
    })

    // Expect validation error
    expect(response.isError).toBe(true)
    expect(response.content[0].text).toContain('invalid_value')
    expect(response.content[0].text).toContain('action')

    // Ensure tool was NOT called
    const { pages } = await import('./composite/pages.js')
    expect(pages).not.toHaveBeenCalled()
  })

  it('should fail when calling blocks tool missing required block_id', async () => {
    const response = await server.callToolHandler({
      params: {
        name: 'blocks',
        arguments: {
          action: 'get'
          // missing block_id
        }
      }
    })

    expect(response.isError).toBe(true)
    expect(response.content[0].text).toContain('invalid_type')
    expect(response.content[0].text).toContain('block_id')

    const { blocks } = await import('./composite/blocks.js')
    expect(blocks).not.toHaveBeenCalled()
  })

  it('should succeed when calling pages tool with valid arguments', async () => {
    const response = await server.callToolHandler({
      params: {
        name: 'pages',
        arguments: {
          action: 'get',
          page_id: '123'
        }
      }
    })

    expect(response.isError).toBeFalsy()

    const { pages } = await import('./composite/pages.js')
    expect(pages).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'get', page_id: '123' }))
  })
})
