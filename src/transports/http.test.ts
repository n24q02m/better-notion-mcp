import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
vi.mock('express', () => {
  const mockApp = {
    set: vi.fn(),
    disable: vi.fn(),
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    listen: vi.fn((_port, _host, cb) => cb?.())
  }
  const mockExpress: any = vi.fn(() => mockApp)
  mockExpress.json = vi.fn(() => (_req: any, _res: any, next: any) => next?.())
  return { default: mockExpress }
})

vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_req: any, _res: any, next: any) => next?.())
}))

vi.mock('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js', () => ({
  requireBearerAuth: vi.fn(() => (_req: any, _res: any, next: any) => next?.())
}))

vi.mock('@modelcontextprotocol/sdk/server/auth/router.js', () => ({
  mcpAuthRouter: vi.fn(() => (_req: any, _res: any, next: any) => next?.())
}))

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn()
}))

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: vi.fn()
}))

vi.mock('@notionhq/client', () => ({
  Client: vi.fn()
}))

vi.mock('../auth/notion-oauth-provider.js', () => ({
  createNotionOAuthProvider: vi.fn(() => ({
    provider: {},
    pendingAuths: new Map(),
    authCodes: new Map(),
    callbackUrl: 'http://localhost/callback',
    notionBasicAuth: 'basic-auth'
  })),
  requestContext: {
    run: vi.fn((_ctx, next) => next?.())
  }
}))

vi.mock('../create-server.js', () => ({
  createMCPServer: vi.fn(() => ({
    connect: vi.fn()
  }))
}))

describe('HTTP Transport', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      PUBLIC_URL: 'http://localhost:8080',
      NOTION_OAUTH_CLIENT_ID: 'client-id',
      NOTION_OAUTH_CLIENT_SECRET: 'client-secret',
      DCR_SERVER_SECRET: 'dcr-secret'
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  async function startAndGetHandlers() {
    const { startHttp } = await import('./http.js')
    const express = (await import('express')).default
    await startHttp()
    return (express as any).mock.results[0].value
  }

  const mockRes = () =>
    ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    }) as any

  it('should exit when required environment variables are missing', async () => {
    delete process.env.PUBLIC_URL
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { startHttp } = await import('./http.js')
    try {
      await startHttp()
    } catch {
      // Catch URL parsing error because PUBLIC_URL is missing
    }

    expect(mockExit).toHaveBeenCalledWith(1)
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Missing required env var'))

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('should register OAuth router, health, and MCP endpoints with default trust proxy', async () => {
    const mockLog = vi.spyOn(console, 'info').mockImplementation(() => {})
    const app = await startAndGetHandlers()

    // Trust proxy defaults to 2
    expect(app.set).toHaveBeenCalledWith('trust proxy', 2)
    expect(app.disable).toHaveBeenCalledWith('x-powered-by')

    // Endpoints
    expect(app.get).toHaveBeenCalledWith('/callback', expect.anything(), expect.anything())
    expect(app.get).toHaveBeenCalledWith('/health', expect.anything())
    expect(app.post).toHaveBeenCalledWith(
      '/mcp',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )

    mockLog.mockRestore()
  })

  describe('TRUST_PROXY configuration', () => {
    const testTrustProxy = async (envValue: string | undefined, expectedValue: any) => {
      if (envValue === undefined) {
        delete process.env.TRUST_PROXY
      } else {
        process.env.TRUST_PROXY = envValue
      }
      const app = await startAndGetHandlers()
      expect(app.set).toHaveBeenCalledWith('trust proxy', expectedValue)
    }

    it('should use numeric TRUST_PROXY', async () => {
      await testTrustProxy('5', 5)
    })

    it('should use boolean TRUST_PROXY (true)', async () => {
      await testTrustProxy('true', true)
    })

    it('should use boolean TRUST_PROXY (false)', async () => {
      await testTrustProxy('false', false)
    })

    it('should use string TRUST_PROXY (IP)', async () => {
      await testTrustProxy('127.0.0.1', '127.0.0.1')
    })

    it('should use default value when TRUST_PROXY is not set', async () => {
      await testTrustProxy(undefined, 2)
    })
  })

  describe('MCP endpoints', () => {
    type Fn = (...args: any[]) => any

    it('should return 400 on POST when no session ID and NOT an initialize request', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(false)

      const app = await startAndGetHandlers()
      const calls = (app.post as any).mock.calls
      const handler = calls.find((call: any[]) => call[0] === '/mcp')!.at(-1) as Fn

      const res = mockRes()
      await handler({ headers: {}, body: {} }, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should create new session on POST with initialize request', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(true)

      const { StreamableHTTPServerTransport: MockTransport } = await import(
        '@modelcontextprotocol/sdk/server/streamableHttp.js'
      )

      let capturedConfig: any = null
      ;(MockTransport as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config
        this.sessionId = null
        this.onclose = null
        this.handleRequest = vi.fn(async () => {
          if (capturedConfig?.onsessioninitialized && !this.sessionId) {
            this.sessionId = 'test-session-id'
            capturedConfig.onsessioninitialized('test-session-id')
          }
        })
        this.connect = vi.fn()
      })

      const app = await startAndGetHandlers()
      const calls = (app.post as any).mock.calls
      const handler = calls.find((call: any[]) => call[0] === '/mcp')!.at(-1) as Fn

      const req = {
        headers: {},
        body: { jsonrpc: '2.0', method: 'initialize', id: 1 },
        auth: { token: 'test-token' }
      }
      const res = mockRes()
      await handler(req, res)

      expect(MockTransport).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalledWith(400)
    })

    it('should verify session owner on GET /mcp', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(true)

      const { StreamableHTTPServerTransport: MockTransport } = await import(
        '@modelcontextprotocol/sdk/server/streamableHttp.js'
      )

      let capturedConfig: any = null
      ;(MockTransport as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config
        this.sessionId = null
        this.onclose = null
        this.handleRequest = vi.fn(async () => {
          if (capturedConfig?.onsessioninitialized && !this.sessionId) {
            this.sessionId = 'session-123'
            capturedConfig.onsessioninitialized('session-123')
          }
        })
      })

      const app = await startAndGetHandlers()

      // 1. Create session with token-1
      const postCalls = (app.post as any).mock.calls
      const postHandler = postCalls.find((call: any[]) => call[0] === '/mcp')!.at(-1) as Fn
      await postHandler(
        { headers: {}, body: { jsonrpc: '2.0', method: 'initialize', id: 1 }, auth: { token: 'token-1' } },
        mockRes()
      )

      // 2. Access with token-2 -> 403
      const getCalls = (app.get as any).mock.calls
      const getHandler = getCalls.find((call: any[]) => call[0] === '/mcp')!.at(-1) as Fn
      const res = mockRes()
      await getHandler({ headers: { 'mcp-session-id': 'session-123' }, auth: { token: 'token-2' } }, res)

      expect(res.status).toHaveBeenCalledWith(403)
    })
  })

  describe('callback route', () => {
    type Fn = (...args: any[]) => any

    it('should redirect back to client on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'notion-token',
          token_type: 'bearer'
        })
      })
      vi.stubGlobal('fetch', mockFetch)

      const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')
      const app = await startAndGetHandlers()
      const calls = (app.get as any).mock.calls
      const handler = calls.find((call: any[]) => call[0] === '/callback')!.at(-1) as Fn

      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      providerInfo.pendingAuths.set('state123', {
        clientId: 'c1',
        clientRedirectUri: 'https://client.example.com/cb',
        codeChallenge: 'ch',
        codeChallengeMethod: 'S256',
        clientState: 's1',
        createdAt: Date.now()
      })

      const res = mockRes()
      await handler({ query: { code: 'c', state: 'state123' } }, res)

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('https://client.example.com/cb'))
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('state=s1'))

      vi.unstubAllGlobals()
    })

    it('should prevent open redirect to unsafe protocols', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 't' })
      })
      vi.stubGlobal('fetch', mockFetch)

      const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')
      const app = await startAndGetHandlers()
      const calls = (app.get as any).mock.calls
      const handler = calls.find((call: any[]) => call[0] === '/callback')!.at(-1) as Fn

      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      providerInfo.pendingAuths.set('unsafe', {
        clientRedirectUri: 'javascript:alert(1)',
        createdAt: Date.now()
      })

      const res = mockRes()
      await handler({ query: { code: 'c', state: 'unsafe' } }, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error_description: 'Unsafe redirect URI' }))

      vi.unstubAllGlobals()
    })
  })
})
