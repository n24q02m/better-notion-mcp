import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startHttpMock = vi.fn()
const resolveCredentialStateMock = vi.fn().mockResolvedValue(undefined)
const setRequestHandlerMock = vi.fn()

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('./credential-state.js', () => ({
  resolveCredentialState: resolveCredentialStateMock,
  getNotionToken: vi.fn().mockReturnValue('ntn_test_token')
}))

// Mock MCP SDK and other heavy dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class {
    connect = vi.fn().mockResolvedValue(undefined)
    setRequestHandler = setRequestHandlerMock
  }
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {}
}))

vi.mock('@notionhq/client', () => ({
  Client: class {}
}))

describe('initServer Integration', () => {
  const originalEnv = process.env
  const originalArgv = process.argv

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    process.argv = [...originalArgv]
    delete process.env.MCP_TRANSPORT
    delete process.env.TRANSPORT_MODE
    delete process.env.NOTION_TOKEN
  })

  afterEach(() => {
    process.env = originalEnv
    process.argv = originalArgv
  })

  it('boots the HTTP server correctly via initServer', async () => {
    process.env.TRANSPORT_MODE = 'http'
    const { initServer } = await import('./init-server.js')
    await initServer()

    expect(startHttpMock).toHaveBeenCalled()
  })

  it('boots the stdio server correctly via initServer', async () => {
    process.env.NOTION_TOKEN = 'ntn_test_token'
    const { initServer } = await import('./init-server.js')
    await initServer()

    expect(resolveCredentialStateMock).toHaveBeenCalled()
    expect(setRequestHandlerMock).toHaveBeenCalled()
  })
})
