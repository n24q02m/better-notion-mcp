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

vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_req: any, _res: any, next: any) => next())
}))

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
    const mockLog = vi.spyOn(console, 'info').mockImplementation(() => {})
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
    expect(app.post).toHaveBeenCalledWith(
      '/mcp',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.any(Function)
    )
    expect(app.get).toHaveBeenCalledWith('/mcp', expect.anything(), expect.anything(), expect.any(Function))
    expect(app.delete).toHaveBeenCalledWith('/mcp', expect.anything(), expect.anything(), expect.any(Function))

    // Listen called
    expect(app.listen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function))

    mockLog.mockRestore()
  })

  it('should use createNotionOAuthProvider with config', async () => {
    const mockLog = vi.spyOn(console, 'info').mockImplementation(() => {})
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

  // Helper: start the server and return the registered route handlers
  async function startAndGetHandlers() {
    const mockLog = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { startHttp } = await import('./http.js')
    const express = (await import('express')).default
    await startHttp()
    const app = (express as any).mock.results[0]?.value
    mockLog.mockRestore()
    return app?._handlers as Record<string, Fn[]>
  }

  function mockRes() {
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      redirect: vi.fn()
    }
    return res
  }

  describe('health endpoint', () => {
    it('should return status ok and mode remote', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/health']?.at(-1) as Fn
      expect(handler).toBeDefined()

      const req = {}
      const res = mockRes()
      handler(req, res)

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', mode: 'remote' }))
    })
  })

  describe('callback route', () => {
    it('should return 400 when error param is present', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn
      expect(handler).toBeDefined()

      const req = { query: { error: 'access_denied' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'oauth_error',
        error_description: 'access_denied'
      })
    })

    it('should return 400 when code or state is missing', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const req = { query: { code: 'some-code' } } // missing state
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'Missing code or state'
      })
    })

    it('should return 400 when state is unknown', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const req = { query: { code: 'some-code', state: 'unknown-state' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_state',
        error_description: 'Unknown or expired state'
      })
    })

    it('should block unsafe redirect URIs to prevent XSS', async () => {
      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'notion-token',
          token_type: 'bearer'
        })
      })
      vi.stubGlobal('fetch', mockFetch)

      const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      // Get the mock instance returned by createNotionOAuthProvider
      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      const pendingAuths: Map<string, any> = providerInfo.pendingAuths

      // Insert a pending auth with an unsafe redirectURI
      pendingAuths.set('unsafe-state', {
        clientId: 'c1',
        clientRedirectUri: 'javascript:alert(1)',
        codeChallenge: 'c',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      const req = { query: { code: 'some-code', state: 'unsafe-state' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'Unsafe redirect URI'
      })
    })
  })

  describe('POST /mcp', () => {
    it('should return 400 JSON-RPC error when no session and not an initialize request', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(false)

      const handlers = await startAndGetHandlers()
      const handler = handlers['POST:/mcp']?.at(-1) as Fn
      expect(handler).toBeDefined()

      const req = { headers: {}, body: { jsonrpc: '2.0', method: 'tools/list', id: 1 }, auth: { token: 'tok' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad request: missing session ID or not an initialize request' },
        id: null
      })
    })
  })

  describe('GET /mcp', () => {
    it('should return 400 when session ID is missing', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/mcp']?.at(-1) as Fn
      expect(handler).toBeDefined()

      const req = { headers: {} }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing session' })
    })

    it('should return 400 when session ID is not recognized', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/mcp']?.at(-1) as Fn

      const req = { headers: { 'mcp-session-id': 'nonexistent-session' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing session' })
    })
  })

  describe('DELETE /mcp', () => {
    it('should return 400 when session ID is missing', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['DELETE:/mcp']?.at(-1) as Fn
      expect(handler).toBeDefined()

      const req = { headers: {} }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing session' })
    })

    it('should return 400 when session ID is not recognized', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['DELETE:/mcp']?.at(-1) as Fn

      const req = { headers: { 'mcp-session-id': 'nonexistent-session' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing session' })
    })
  })

  describe('POST /mcp session owner verification', () => {
    it('should return 403 when authenticated user does not own the session', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(true)

      const { StreamableHTTPServerTransport: MockTransport } = await import(
        '@modelcontextprotocol/sdk/server/streamableHttp.js'
      )

      // Make StreamableHTTPServerTransport constructor store config and simulate session
      let capturedConfig: any = null
      ;(MockTransport as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config
        this.sessionId = null
        this.onclose = null
        this.handleRequest = vi.fn(async () => {
          // Simulate session initialization: call onsessioninitialized
          if (capturedConfig?.onsessioninitialized && !this.sessionId) {
            this.sessionId = 'test-session-id'
            capturedConfig.onsessioninitialized('test-session-id')
          }
        })
      })

      const handlers = await startAndGetHandlers()
      const handler = handlers['POST:/mcp']?.at(-1) as Fn

      // First request: initialize the session with token-A
      const initReq = {
        headers: {},
        body: { jsonrpc: '2.0', method: 'initialize', id: 1 },
        auth: { token: 'token-A' }
      }
      const initRes = mockRes()
      await handler(initReq, initRes)

      // Second request: try to use the session with token-B (different user)
      const hijackReq = {
        headers: { 'mcp-session-id': 'test-session-id' },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 2 },
        auth: { token: 'token-B' }
      }
      const hijackRes = mockRes()
      await handler(hijackReq, hijackRes)

      expect(hijackRes.status).toHaveBeenCalledWith(403)
      expect(hijackRes.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Session belongs to a different user' },
        id: null
      })
    })
  })
})
