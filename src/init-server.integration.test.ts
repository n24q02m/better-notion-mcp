import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initServer } from './init-server.js'

// Mock sub-dependencies of main.ts to verify the boot logic
// without actually starting a real network/stdio server.
const startHttpMock = vi.fn()
const stdioConnectMock = vi.fn().mockResolvedValue(undefined)
const stdioServerCtor = vi.fn()
const stdioTransportCtor = vi.fn()

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  class MockServer {
    constructor(...args: any[]) {
      stdioServerCtor(...args)
    }
    connect = stdioConnectMock
  }
  return { Server: MockServer }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  class MockStdioServerTransport {
    constructor(...args: any[]) {
      stdioTransportCtor(...args)
    }
  }
  return { StdioServerTransport: MockStdioServerTransport }
})

vi.mock('./credential-state.js', () => ({
  resolveCredentialState: vi.fn().mockResolvedValue(undefined),
  getNotionToken: vi.fn().mockReturnValue('ntn_test_token'),
  setState: vi.fn(),
  setSubjectTokenResolver: vi.fn()
}))

vi.mock('./tools/registry.js', () => ({
  registerTools: vi.fn()
}))

// Mock process.exit and stderr to test failure conditions
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

describe('initServer integration', () => {
  const originalEnv = process.env
  const originalArgv = process.argv

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    process.argv = [...originalArgv]
    delete process.env.MCP_TRANSPORT
    delete process.env.TRANSPORT_MODE
  })

  afterEach(() => {
    process.env = originalEnv
    process.argv = originalArgv
  })

  it('boots http mode correctly from entry point', async () => {
    process.argv = [process.argv[0], 'main.js', '--http']
    await initServer()
    expect(startHttpMock).toHaveBeenCalled()
  })

  it('boots stdio mode correctly from entry point', async () => {
    process.env.NOTION_TOKEN = 'ntn_test_token'
    await initServer()
    expect(stdioConnectMock).toHaveBeenCalled()
    expect(stdioServerCtor).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'better-notion-mcp' }),
      expect.any(Object)
    )
  })

  it('handles and propagates boot failures (stdio missing token)', async () => {
    delete process.env.NOTION_TOKEN
    await initServer()
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('NOTION_TOKEN required'))
  })
})
