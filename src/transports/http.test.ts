import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// biome-ignore lint/complexity/noBannedTypes: mock types for express
type Fn = Function

// Mock dependencies before imports
vi.mock('express', () => {
  const handlers: Record<string, Fn[]> = {}
  const mockApp = {
    use: vi.fn(),
    set: vi.fn(),
    get: vi.fn((path: string, ...fns: Fn[]) => {
      handlers[`GET:${path}`] = fns
    }),
    post: vi.fn((path: string, ...fns: Fn[]) => {
      handlers[`POST:${path}`] = fns
    }),
    delete: vi.fn((path: string, ...fns: Fn[]) => {
      handlers[`DELETE:${path}`] = fns
    }),
    listen: vi.fn((_port: number, _host: string, cb?: Fn) => (cb as (() => void) | undefined)?.()),
    _handlers: handlers
  }
  const expressFn = vi.fn(() => mockApp) as any
  expressFn.json = vi.fn(() => (_req: any, _res: any, next: any) => next())
  return { default: expressFn }
})

vi.mock('@modelcontextprotocol/sdk/server/auth/router.js', () => ({
  mcpAuthRouter: vi.fn(() => 'mock-auth-router')
}))

vi.mock('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js', () => ({
  requireBearerAuth: vi.fn(() => (_req: any, _res: any, next: any) => next())
}))

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn()
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class MockServer {
    connect = vi.fn()
  }
}))

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: vi.fn()
}))

vi.mock('../auth/notion-oauth-provider.js', () => ({
  createNotionOAuthProvider: vi.fn(() => ({
    provider: 'mock-provider',
    clientStore: {},
    pendingAuths: new Map(),
    authCodes: new Map(),
    callbackUrl: 'https://better-notion-mcp.n24q02m.com/callback',
    notionBasicAuth: 'dGVzdDp0ZXN0'
  }))
}))

vi.mock('../create-server.js', () => ({
  createMCPServer: vi.fn(() => ({ connect: vi.fn() }))
}))

vi.mock('@notionhq/client', () => ({
  Client: vi.fn()
}))

vi.mock('../tools/registry.js', () => ({
  registerTools: vi.fn()
}))

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '2.14.0' }))
}))

describe('startHttp', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      PUBLIC_URL: 'https://better-notion-mcp.n24q02m.com',
      NOTION_OAUTH_CLIENT_ID: 'test-client-id',
      NOTION_OAUTH_CLIENT_SECRET: 'test-secret',
      DCR_SERVER_SECRET: 'test-dcr-secret',
      PORT: '3000'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should exit if PUBLIC_URL is missing', async () => {
    delete process.env.PUBLIC_URL
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as any)
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { startHttp } = await import('./http.js')
    await expect(startHttp()).rejects.toThrow('process.exit')

    expect(mockError).toHaveBeenCalledWith('Missing required env var: PUBLIC_URL')
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('should register OAuth router, health, and MCP endpoints', async () => {
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { startHttp } = await import('./http.js')
    const express = (await import('express')).default

    await startHttp()

    const app = (express as any).mock.results[0]?.value
    if (!app) return // express may have been called in previous test

    // OAuth router mounted
    expect(app.use).toHaveBeenCalled()

    // Callback endpoint registered
    expect(app.get).toHaveBeenCalledWith('/callback', expect.any(Function))

    // Health endpoint registered
    expect(app.get).toHaveBeenCalledWith('/health', expect.any(Function))

    // MCP endpoints registered (POST with rateLimit + jsonParser + authMiddleware, GET/DELETE with rateLimit + authMiddleware)
    expect(app.post).toHaveBeenCalledWith('/mcp', expect.anything(), expect.anything(), expect.anything(), expect.any(Function))
    expect(app.get).toHaveBeenCalledWith('/mcp', expect.anything(), expect.anything(), expect.any(Function))
    expect(app.delete).toHaveBeenCalledWith('/mcp', expect.anything(), expect.anything(), expect.any(Function))

    // Listen called
    expect(app.listen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function))

    mockLog.mockRestore()
  })

  it('should use createNotionOAuthProvider with config', async () => {
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')

    const { startHttp } = await import('./http.js')
    await startHttp()

    expect(createNotionOAuthProvider).toHaveBeenCalledWith({
      notionClientId: 'test-client-id',
      notionClientSecret: 'test-secret',
      dcrSecret: 'test-dcr-secret',
      publicUrl: 'https://better-notion-mcp.n24q02m.com'
    })

    mockLog.mockRestore()
  })
})
