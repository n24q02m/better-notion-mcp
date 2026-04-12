import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('./credential-state.js', () => ({
  resolveCredentialState: vi.fn().mockResolvedValue('awaiting_setup'),
  getNotionToken: vi.fn().mockReturnValue(null),
  getState: vi.fn().mockReturnValue('awaiting_setup'),
  getSetupUrl: vi.fn().mockReturnValue(null),
  triggerRelaySetup: vi.fn().mockResolvedValue(null)
}))

describe('initServer', () => {
  const originalEnv = process.env
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, MCP_TRANSPORT: 'stdio' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should start server without NOTION_TOKEN and log warning', async () => {
    delete process.env.NOTION_TOKEN

    const { initServer } = await import('./init-server.js')
    await initServer()

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('NOTION_TOKEN not set'))
  })

  it('should initialize server successfully with NOTION_TOKEN', async () => {
    process.env.NOTION_TOKEN = 'secret_token'

    const { resolveCredentialState, getNotionToken } = await import('./credential-state.js')
    vi.mocked(resolveCredentialState).mockResolvedValue('configured')
    vi.mocked(getNotionToken).mockReturnValue('secret_token')

    const { initServer } = await import('./init-server.js')
    await initServer()

    // Server started in stdio mode (no error thrown)
    expect(StdioServerTransport).toBeDefined()
  })
})
