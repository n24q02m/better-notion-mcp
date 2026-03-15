import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  readFileSync: vi.fn().mockReturnValue('# Mock documentation content')
}))

import { readFileSync } from 'node:fs'
import { blocks } from './composite/blocks.js'
import { commentsManage } from './composite/comments.js'
import { contentConvert } from './composite/content.js'
import { databases } from './composite/databases.js'
import { fileUploads } from './composite/file-uploads.js'
import { pages } from './composite/pages.js'
import { users } from './composite/users.js'
import { workspace } from './composite/workspace.js'
import { NotionMCPError } from './helpers/errors.js'
import { registerTools } from './registry.js'

const EXPECTED_TOOL_NAMES = [
  'pages',
  'databases',
  'blocks',
  'users',
  'workspace',
  'comments',
  'content_convert',
  'file_uploads',
  'help'
]

const EXPECTED_RESOURCE_URIS = [
  'notion://docs/pages',
  'notion://docs/databases',
  'notion://docs/blocks',
  'notion://docs/users',
  'notion://docs/workspace',
  'notion://docs/comments',
  'notion://docs/content_convert',
  'notion://docs/file_uploads'
]

/**
 * Create a mock MCP Server that captures registered handlers by registration order
 *
 * Registration order in registry.ts:
 *   0 - ListToolsRequestSchema
 *   1 - ListResourcesRequestSchema
 *   2 - ReadResourceRequestSchema
 *   3 - CallToolRequestSchema
 */
function createMockServer() {
  const handlers: ((...args: any[]) => any)[] = []
  return {
    setRequestHandler: vi.fn((_schema: any, handler: (...args: any[]) => any) => {
      handlers.push(handler)
    }),
    getHandler: (index: number) => handlers[index]
  }
}

describe('registerTools', () => {
  let server: ReturnType<typeof createMockServer>
  const mockNotionClient = {} as any
  const mockClientFactory = vi.fn(() => mockNotionClient)

  beforeEach(() => {
    vi.clearAllMocks()
    server = createMockServer()
    registerTools(server as any, mockClientFactory)
  })

  describe('registration', () => {
    it('should register exactly 4 request handlers', () => {
      expect(server.setRequestHandler).toHaveBeenCalledTimes(4)
    })

    it('should not call client factory at registration time', () => {
      expect(mockClientFactory).not.toHaveBeenCalled()
    })
  })

  describe('ListTools handler', () => {
    it('should return exactly 9 tools', async () => {
      const handler = server.getHandler(0)
      const result = await handler()

      expect(result.tools).toHaveLength(9)
    })

    it('should return all expected tool names', async () => {
      const handler = server.getHandler(0)
      const result = await handler()
      const names = result.tools.map((t: any) => t.name)

      expect(names).toEqual(EXPECTED_TOOL_NAMES)
    })

    it('should have required schema properties on each tool', async () => {
      const handler = server.getHandler(0)
      const result = await handler()

      for (const tool of result.tools) {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('inputSchema')
        expect(tool).toHaveProperty('annotations')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.inputSchema).toHaveProperty('properties')
        expect(tool.inputSchema).toHaveProperty('required')
      }
    })

    it('should have correct annotation properties on each tool', async () => {
      const handler = server.getHandler(0)
      const result = await handler()

      for (const tool of result.tools) {
        expect(tool.annotations).toHaveProperty('title')
        expect(tool.annotations).toHaveProperty('readOnlyHint')
        expect(tool.annotations).toHaveProperty('destructiveHint')
        expect(tool.annotations).toHaveProperty('idempotentHint')
        expect(tool.annotations).toHaveProperty('openWorldHint')
        expect(typeof tool.annotations.title).toBe('string')
      }
    })

    it('should mark readonly tools correctly', async () => {
      const handler = server.getHandler(0)
      const result = await handler()
      const toolMap = new Map<string, any>(result.tools.map((t: any) => [t.name, t]))

      expect(toolMap.get('users').annotations.readOnlyHint).toBe(true)
      expect(toolMap.get('workspace').annotations.readOnlyHint).toBe(true)
      expect(toolMap.get('content_convert').annotations.readOnlyHint).toBe(true)
      expect(toolMap.get('help').annotations.readOnlyHint).toBe(true)
      expect(toolMap.get('pages').annotations.readOnlyHint).toBe(false)
      expect(toolMap.get('databases').annotations.readOnlyHint).toBe(false)
    })

    it('should require action for most tools', async () => {
      const handler = server.getHandler(0)
      const result = await handler()
      const toolMap = new Map<string, any>(result.tools.map((t: any) => [t.name, t]))

      expect(toolMap.get('pages').inputSchema.required).toContain('action')
      expect(toolMap.get('databases').inputSchema.required).toContain('action')
      expect(toolMap.get('blocks').inputSchema.required).toContain('action')
      expect(toolMap.get('help').inputSchema.required).toContain('tool_name')
    })
  })

  describe('ListResources handler', () => {
    it('should return exactly 8 resources', async () => {
      const handler = server.getHandler(1)
      const result = await handler()

      expect(result.resources).toHaveLength(8)
    })

    it('should return all expected resource URIs', async () => {
      const handler = server.getHandler(1)
      const result = await handler()
      const uris = result.resources.map((r: any) => r.uri)

      expect(uris).toEqual(EXPECTED_RESOURCE_URIS)
    })

    it('should have uri, name, and mimeType on each resource', async () => {
      const handler = server.getHandler(1)
      const result = await handler()

      for (const resource of result.resources) {
        expect(resource).toHaveProperty('uri')
        expect(resource).toHaveProperty('name')
        expect(resource).toHaveProperty('mimeType')
        expect(resource.mimeType).toBe('text/markdown')
        expect(resource.uri).toMatch(/^notion:\/\/docs\//)
        expect(resource.name).toMatch(/Docs$/)
      }
    })
  })

  describe('ReadResource handler', () => {
    it('should return doc content for a valid URI', async () => {
      const handler = server.getHandler(2)
      const result = await handler({
        params: { uri: 'notion://docs/pages' }
      })

      expect(result.contents).toHaveLength(1)
      expect(result.contents[0]).toEqual({
        uri: 'notion://docs/pages',
        mimeType: 'text/markdown',
        text: '# Mock documentation content'
      })
      expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('pages.md'), 'utf-8')
    })

    it('should read the correct file for each resource', async () => {
      const handler = server.getHandler(2)

      for (const uri of EXPECTED_RESOURCE_URIS) {
        vi.mocked(readFileSync).mockReturnValue(`# Doc for ${uri}`)
        const result = await handler({ params: { uri } })

        expect(result.contents[0].uri).toBe(uri)
        expect(result.contents[0].text).toBe(`# Doc for ${uri}`)
      }
    })

    it('should throw NotionMCPError for unknown URI', async () => {
      const handler = server.getHandler(2)

      await expect(handler({ params: { uri: 'notion://docs/nonexistent' } })).rejects.toThrow(NotionMCPError)

      await expect(handler({ params: { uri: 'notion://docs/nonexistent' } })).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND'
      })
    })

    it('should throw NotionMCPError with DOC_NOT_FOUND when readFileSync throws', async () => {
      const handler = server.getHandler(2)
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      const promise = handler({ params: { uri: 'notion://docs/pages' } })
      await expect(promise).rejects.toThrow(NotionMCPError)
      await expect(promise).rejects.toMatchObject({
        code: 'DOC_NOT_FOUND',
        suggestion: expect.any(String)
      })
    })

    it('should include available resources in error message', async () => {
      const handler = server.getHandler(2)

      try {
        await handler({ params: { uri: 'notion://docs/invalid' } })
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(NotionMCPError)
        const mcpError = error as NotionMCPError
        expect(mcpError.suggestion).toContain('notion://docs/pages')
        expect(mcpError.suggestion).toContain('notion://docs/file_uploads')
      }
    })
  })

  describe('CallTool handler', () => {
    it('should return error when no arguments provided', async () => {
      const handler = server.getHandler(3)
      const result = await handler({
        params: { name: 'pages', arguments: undefined }
      })

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: No arguments provided' }],
        isError: true
      })
    })

    it('should route pages tool correctly', async () => {
      const handler = server.getHandler(3)
      const mockResult = {
        action: 'get',
        page_id: 'page-123',
        title: 'Test',
        url: 'https://notion.so/page-123',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-02T00:00:00.000Z',
        archived: false,
        properties: {},
        content: '# Test Content',
        block_count: 5
      } as any
      vi.mocked(pages).mockResolvedValue(mockResult)

      const result = await handler({
        params: { name: 'pages', arguments: { action: 'get', page_id: 'page-123' } }
      })

      expect(pages).toHaveBeenCalledWith(expect.any(Object), { action: 'get', page_id: 'page-123' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      expect(result.content[0].text).toContain('<untrusted_notion_content>')
      expect(result.content[0].text).toContain('[SECURITY:')
    })

    it('should route databases tool correctly', async () => {
      const handler = server.getHandler(3)

      const mockResult = {
        action: 'query' as const,
        database_id: 'db-1',
        data_source_id: 'ds-1',
        total: 0,
        results: []
      }
      vi.mocked(databases).mockResolvedValue(mockResult)

      const result = await handler({
        params: { name: 'databases', arguments: { action: 'query', database_id: 'db-1' } }
      })

      expect(databases).toHaveBeenCalledWith(expect.any(Object), { action: 'query', database_id: 'db-1' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      expect(result.content[0].text).toContain('<untrusted_notion_content>')
    })

    it('should route blocks tool correctly', async () => {
      const handler = server.getHandler(3)
      const mockResult = { action: 'get', block_id: 'block-1', type: 'paragraph' }
      vi.mocked(blocks).mockResolvedValue(mockResult)

      const result = await handler({
        params: { name: 'blocks', arguments: { action: 'get', block_id: 'block-1' } }
      })

      expect(blocks).toHaveBeenCalledWith(expect.any(Object), { action: 'get', block_id: 'block-1' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      expect(result.content[0].text).toContain('<untrusted_notion_content>')
    })

    it('should route users tool correctly', async () => {
      const handler = server.getHandler(3)
      const mockResult = { action: 'me', user: { id: 'user-1' } }
      vi.mocked(users).mockResolvedValue(mockResult)

      const result = await handler({
        params: { name: 'users', arguments: { action: 'me' } }
      })

      expect(users).toHaveBeenCalledWith(expect.any(Object), { action: 'me' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      expect(result.content[0].text).toContain('<untrusted_notion_content>')
    })

    it('should route workspace tool correctly', async () => {
      const handler = server.getHandler(3)
      const mockResult = { action: 'search', results: [] }
      vi.mocked(workspace).mockResolvedValue(mockResult)

      const result = await handler({
        params: { name: 'workspace', arguments: { action: 'search', query: 'test' } }
      })

      expect(workspace).toHaveBeenCalledWith(expect.any(Object), { action: 'search', query: 'test' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      expect(result.content[0].text).toContain('<untrusted_notion_content>')
    })

    it('should route comments tool correctly', async () => {
      const handler = server.getHandler(3)
      const mockResult = { action: 'list', comments: [] }
      vi.mocked(commentsManage).mockResolvedValue(mockResult)

      const result = await handler({
        params: { name: 'comments', arguments: { action: 'list', page_id: 'page-1' } }
      })

      expect(commentsManage).toHaveBeenCalledWith(expect.any(Object), { action: 'list', page_id: 'page-1' })
      expect(result.content[0].text).toContain(JSON.stringify(mockResult, null, 2))
      expect(result.content[0].text).toContain('<untrusted_notion_content>')
    })

    it('should route content_convert tool without notion client', async () => {
      const handler = server.getHandler(3)
      const mockResult = { direction: 'markdown-to-blocks', blocks: [] }
      vi.mocked(contentConvert).mockResolvedValue(mockResult)

      const result = await handler({
        params: {
          name: 'content_convert',
          arguments: { direction: 'markdown-to-blocks', content: '# Hello' }
        }
      })

      // contentConvert is called without notion client
      expect(contentConvert).toHaveBeenCalledWith({
        direction: 'markdown-to-blocks',
        content: '# Hello'
      })
      expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))
    })

    it('should route file_uploads tool correctly', async () => {
      const handler = server.getHandler(3)
      const mockResult = { action: 'list', uploads: [] }
      vi.mocked(fileUploads).mockResolvedValue(mockResult)

      const result = await handler({
        params: { name: 'file_uploads', arguments: { action: 'list' } }
      })

      expect(fileUploads).toHaveBeenCalledWith(expect.any(Object), { action: 'list' })
      expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2))
    })

    it('should route help tool and read documentation file', async () => {
      const handler = server.getHandler(3)
      vi.mocked(readFileSync).mockReturnValue('# Pages Documentation\n\nFull docs here.')

      const result = await handler({
        params: { name: 'help', arguments: { tool_name: 'pages' } }
      })

      expect(readFileSync).toHaveBeenCalledWith(expect.stringContaining('pages.md'), 'utf-8')
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.tool).toBe('pages')
      expect(parsed.documentation).toBe('# Pages Documentation\n\nFull docs here.')
    })

    it('should return isError for help tool when doc file is missing', async () => {
      const handler = server.getHandler(3)
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      const result = await handler({
        params: { name: 'help', arguments: { tool_name: 'pages' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Documentation not found for: pages')
    })

    it('should return error for unknown tool', async () => {
      const handler = server.getHandler(3)
      const result = await handler({
        params: { name: 'nonexistent_tool', arguments: { action: 'get' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: nonexistent_tool')
      expect(result.content[0].text).toContain('Available tools:')
    })

    it('should wrap NotionMCPError in isError response', async () => {
      const handler = server.getHandler(3)
      vi.mocked(pages).mockRejectedValue(new NotionMCPError('Page not found', 'NOT_FOUND', 'Check the ID'))

      const result = await handler({
        params: { name: 'pages', arguments: { action: 'get', page_id: 'bad-id' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Error: Page not found')
      expect(result.content[0].text).toContain('Suggestion: Check the ID')
    })

    it('should wrap generic errors in isError response with TOOL_ERROR code', async () => {
      const handler = server.getHandler(3)
      vi.mocked(databases).mockRejectedValue(new Error('Something unexpected broke'))

      const result = await handler({
        params: { name: 'databases', arguments: { action: 'query', database_id: 'db-1' } }
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error: Something unexpected broke')
      expect(result.content[0].text).toContain('Suggestion: Check the error details and try again')
    })

    it('should return well-formed success response structure', async () => {
      const handler = server.getHandler(3)
      vi.mocked(pages).mockResolvedValue({ ok: true } as any)

      const result = await handler({
        params: { name: 'pages', arguments: { action: 'get', page_id: 'p-1' } }
      })

      expect(result.content[0].text).toContain(JSON.stringify({ ok: true }, null, 2))
      expect(result.content[0].text).toContain('<untrusted_notion_content>')
      expect(result.isError).toBeUndefined()
    })
  })
})
