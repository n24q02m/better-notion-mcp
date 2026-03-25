import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initServer } from './init-server.js'

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: class MockServer {
      connect = vi.fn().mockResolvedValue(undefined)
      setRequestHandler = vi.fn()
    }
  }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class MockStdioServerTransport {}
  }
})

vi.mock('./tools/registry.js', () => ({
  registerTools: vi.fn()
}))

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({ name: '@n24q02m/better-notion-mcp', version: '1.0.0' }))
}))

vi.mock('@notionhq/client', () => ({
  Client: vi.fn()
}))

vi.mock('./relay-setup.js', () => ({
  ensureConfig: vi.fn().mockResolvedValue(null)
}))

describe('initServer (delegates to startStdio)', () => {
  const originalEnv = process.env
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should start server without NOTION_TOKEN and log warning', async () => {
    delete process.env.NOTION_TOKEN

    const server = await initServer()

    expect(server.connect).toHaveBeenCalledWith(expect.any(StdioServerTransport))
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('NOTION_TOKEN not set'))
  })

  it('should initialize server successfully with NOTION_TOKEN', async () => {
    process.env.NOTION_TOKEN = 'secret_token'

    const server = await initServer()

    expect(server.connect).toHaveBeenCalledWith(expect.any(StdioServerTransport))
  })
})
