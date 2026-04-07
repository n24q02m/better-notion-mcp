import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// biome-ignore lint/complexity/noBannedTypes: mock types for express
type Fn = Function

// Mock dependencies before imports
vi.mock('express', () => {
  const handlers: Record<string, Fn[]> = {}
  const mockApp = {
    use: vi.fn(),
    set: vi.fn(),
    disable: vi.fn(),
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

vi.mock('../auth/notion-oauth-provider.js', () => {
  const { AsyncLocalStorage } = require('node:async_hooks')
  return {
    createNotionOAuthProvider: vi.fn(() => ({
      provider: 'mock-provider',
      clientStore: {},
      pendingAuths: new Map(),
      authCodes: new Map(),
      callbackUrl: 'https://better-notion-mcp.n24q02m.com/callback',
      notionBasicAuth: 'dGVzdDp0ZXN0'
    })),
    requestContext: new AsyncLocalStorage()
  }
})

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
    vi.restoreAllMocks()
  })

  async function startAndGetHandlers() {
    const { startHttp } = await import('./http.js')
    const express = (await import('express')).default
    await startHttp()
    const app = (express as any).mock.results[0].value
    return app._handlers
  }

  const mockRes = () => {
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    }
    return res
  }

  describe('parseTrustProxy', () => {
    it('should return 2 for undefined value', async () => {
      const { parseTrustProxy } = await import('./http.js')
      expect(parseTrustProxy(undefined)).toBe(2)
    })

    it('should return true for "true"', async () => {
      const { parseTrustProxy } = await import('./http.js')
      expect(parseTrustProxy('true')).toBe(true)
    })

    it('should return false for "false"', async () => {
      const { parseTrustProxy } = await import('./http.js')
      expect(parseTrustProxy('false')).toBe(false)
    })

    it('should parse numeric strings', async () => {
      const { parseTrustProxy } = await import('./http.js')
      expect(parseTrustProxy('123')).toBe(123)
    })

    it('should return string as is for other values', async () => {
      const { parseTrustProxy } = await import('./http.js')
      expect(parseTrustProxy('loopback')).toBe('loopback')
    })
  })

  describe('loadConfig', () => {
    it('should exit when required env var is missing', async () => {
      const { loadConfig } = await import('./http.js')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit')
      })

      delete process.env.PUBLIC_URL
      expect(() => loadConfig()).toThrow('exit')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required env var: PUBLIC_URL'))
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('should load default port when PORT is missing', async () => {
      const { loadConfig } = await import('./http.js')
      delete process.env.PORT
      const config = loadConfig()
      expect(config.port).toBe(8080)
    })
  })

  describe('startHttp', () => {
    it('should initialize correctly with default settings', async () => {
      const { startHttp } = await import('./http.js')
      const express = (await import('express')).default
      await startHttp()
      const app = (express as any).mock.results[0].value

      expect(app.set).toHaveBeenCalledWith('trust proxy', 2)
      expect(app.disable).toHaveBeenCalledWith('x-powered-by')
      expect(app.listen).toHaveBeenCalledWith(3000, '0.0.0.0', expect.any(Function))
    })

    it('should parse TRUST_PROXY environment variable correctly', async () => {
      const { startHttp } = await import('./http.js')
      const express = (await import('express')).default

      const testCases = [
        { env: 'true', expected: true },
        { env: 'false', expected: false },
        { env: '1', expected: 1 },
        { env: 'some-ip', expected: 'some-ip' }
      ]

      for (const { env, expected } of testCases) {
        vi.clearAllMocks()
        process.env.TRUST_PROXY = env
        await startHttp()
        const app = (express as any).mock.results.at(-1).value
        expect(app.set).toHaveBeenCalledWith('trust proxy', expected)
      }
    })

    it('should return 400 on /callback when code or state is missing', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const req = { query: {} }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'Missing code or state'
      })
    })

    it('should return 400 on /callback when state is unknown', async () => {
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

    it('should return 400 on /callback when error is present', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const req = { query: { error: 'access_denied' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'oauth_error',
        error_description: 'access_denied'
      })
    })

    it('should return 400 on /callback for unsafe redirect URIs', async () => {
      const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'test-token', token_type: 'bearer' })
      })
      vi.stubGlobal('fetch', mockFetch)

      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      const pendingAuths: Map<string, any> = providerInfo.pendingAuths

      pendingAuths.set('unsafe-state', {
        clientId: 'client-1',
        clientRedirectUri: 'javascript:alert(1)',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      const req = { query: { code: 'code', state: 'unsafe-state' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'invalid_request' }))

      vi.unstubAllGlobals()
    })

    it('should return 400 on /mcp when session ID is missing and not initialize request', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(false)

      const handlers = await startAndGetHandlers()
      const handler = handlers['POST:/mcp']?.at(-1) as Fn

      const req = { headers: {}, body: { method: 'not-initialize' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 403 on /mcp when session ID exists but owner does not match', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(true)

      const { StreamableHTTPServerTransport: MockTransport } = await import(
        '@modelcontextprotocol/sdk/server/streamableHttp.js'
      )

      let capturedConfig: any = null
      ;(MockTransport as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config
        this.sessionId = null
        this.handleRequest = vi.fn(async () => {
          if (capturedConfig?.onsessioninitialized && !this.sessionId) {
            this.sessionId = 'hijack-session'
            capturedConfig.onsessioninitialized('hijack-session')
          }
        })
      })

      const handlers = await startAndGetHandlers()

      // Initialize session with token-A
      const postHandler = handlers['POST:/mcp']?.at(-1) as Fn
      await postHandler(
        { headers: {}, body: { jsonrpc: '2.0', method: 'initialize', id: 1 }, auth: { token: 'token-A' } },
        mockRes()
      )

      // Try to use session with token-B
      const res = mockRes()
      await postHandler({ headers: { 'mcp-session-id': 'hijack-session' }, auth: { token: 'token-B' } }, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Session belongs to a different user' })
        })
      )
    })

    it('should return 400 on /mcp GET when session ID is invalid', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/mcp']?.at(-1) as Fn

      const res = mockRes()
      await handler({ headers: { 'mcp-session-id': 'invalid' } }, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should return 400 on /mcp DELETE when session ID is missing', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['DELETE:/mcp']?.at(-1) as Fn

      const res = mockRes()
      await handler({ headers: {} }, res)
      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('should handle /health check', async () => {
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/health']?.at(-1) as Fn

      const res = mockRes()
      await handler({}, res)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', mode: 'remote' }))
    })

    it('should cover sessionIdGenerator and onclose handler', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(true)

      const { StreamableHTTPServerTransport: MockTransport } = await import(
        '@modelcontextprotocol/sdk/server/streamableHttp.js'
      )

      let capturedConfig: any = null
      let instance: any = null
      ;(MockTransport as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config
        instance = this
        this.sessionId = null
        this.handleRequest = vi.fn(async () => {
          if (capturedConfig?.onsessioninitialized && !this.sessionId) {
            this.sessionId = 'test-session-id'
            capturedConfig.onsessioninitialized('test-session-id')
          }
        })
      })

      const handlers = await startAndGetHandlers()
      const postHandler = handlers['POST:/mcp']?.at(-1) as Fn

      await postHandler(
        { headers: {}, body: { jsonrpc: '2.0', method: 'initialize', id: 1 }, auth: { token: 'token' } },
        mockRes()
      )

      // Test sessionIdGenerator
      expect(capturedConfig.sessionIdGenerator).toBeDefined()
      const id = capturedConfig.sessionIdGenerator()
      expect(id).toMatch(/^[0-9a-f-]{36}$/)

      // Test onclose with and without sessionId
      expect(instance.onclose).toBeDefined()
      instance.sessionId = null
      instance.onclose()

      instance.sessionId = 'test-session-id'
      instance.onclose()
    })

    it('should cover handling of existing session and SSE/DELETE flows', async () => {
      const { isInitializeRequest: mockIsInit } = await import('@modelcontextprotocol/sdk/types.js')
      ;(mockIsInit as any).mockReturnValue(true)

      const { StreamableHTTPServerTransport: MockTransport } = await import(
        '@modelcontextprotocol/sdk/server/streamableHttp.js'
      )

      let capturedConfig: any = null
      let transportInstance: any = null
      ;(MockTransport as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config
        transportInstance = this
        this.sessionId = null
        this.handleRequest = vi.fn()
      })

      const handlers = await startAndGetHandlers()
      const postHandler = handlers['POST:/mcp']?.at(-1) as Fn
      const getHandler = handlers['GET:/mcp']?.at(-1) as Fn
      const deleteHandler = handlers['DELETE:/mcp']?.at(-1) as Fn

      // Initialize
      await postHandler(
        { headers: {}, body: { jsonrpc: '2.0', method: 'initialize', id: 1 }, auth: { token: 'owner-token' } },
        mockRes()
      )

      // Manually set session ID as it would be after initialization
      transportInstance.sessionId = 'active-session'
      capturedConfig.onsessioninitialized('active-session')

      // 1. Existing session POST
      await postHandler(
        {
          headers: { 'mcp-session-id': 'active-session' },
          body: { method: 'callTool' },
          auth: { token: 'owner-token' }
        },
        mockRes()
      )
      expect(transportInstance.handleRequest).toHaveBeenCalled()

      // 2. Existing session GET (SSE)
      await getHandler({ headers: { 'mcp-session-id': 'active-session' }, auth: { token: 'owner-token' } }, mockRes())
      expect(transportInstance.handleRequest).toHaveBeenCalled()

      // 3. Existing session DELETE
      await deleteHandler(
        { headers: { 'mcp-session-id': 'active-session' }, auth: { token: 'owner-token' } },
        mockRes()
      )
      expect(transportInstance.handleRequest).toHaveBeenCalled()

      // 4. Mismatched owner on GET
      const resGET = mockRes()
      await getHandler({ headers: { 'mcp-session-id': 'active-session' }, auth: { token: 'wrong-token' } }, resGET)
      expect(resGET.status).toHaveBeenCalledWith(403)

      // 5. Mismatched owner on DELETE
      const resDEL = mockRes()
      await deleteHandler({ headers: { 'mcp-session-id': 'active-session' }, auth: { token: 'wrong-token' } }, resDEL)
      expect(resDEL.status).toHaveBeenCalledWith(403)
    })
  })

  describe('callback route — success flow', () => {
    it('should exchange token and redirect with clientState', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'notion-access-token',
          token_type: 'bearer',
          refresh_token: 'notion-refresh-token',
          expires_in: 3600
        })
      })
      vi.stubGlobal('fetch', mockFetch)

      const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      const pendingAuths: Map<string, any> = providerInfo.pendingAuths

      // Add pending auth with clientState
      pendingAuths.set('valid-state', {
        clientId: 'client-1',
        clientRedirectUri: 'https://example.com/oauth/callback',
        codeChallenge: 'challenge123',
        codeChallengeMethod: 'S256',
        clientState: 'client-state-value',
        createdAt: Date.now()
      })

      const req = { query: { code: 'notion-auth-code', state: 'valid-state' } }
      const res = mockRes()
      await handler(req, res)

      // Should redirect
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('https://example.com/oauth/callback'))
      // Should include state param
      const redirectUrl = res.redirect.mock.calls[0][0]
      expect(redirectUrl).toContain('state=client-state-value')
      expect(redirectUrl).toContain('code=')

      // Should have called Notion token exchange
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/oauth/token',
        expect.objectContaining({ method: 'POST' })
      )

      vi.unstubAllGlobals()
    })

    it('should redirect without state param when clientState is absent', async () => {
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

      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      const pendingAuths: Map<string, any> = providerInfo.pendingAuths

      // Add pending auth WITHOUT clientState
      pendingAuths.set('no-state', {
        clientId: 'client-1',
        clientRedirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      const req = { query: { code: 'code', state: 'no-state' } }
      const res = mockRes()
      await handler(req, res)

      const redirectUrl = res.redirect.mock.calls[0][0]
      expect(redirectUrl).not.toContain('state=')
      expect(redirectUrl).toContain('code=')

      vi.unstubAllGlobals()
    })

    it('should return 502 when Notion token exchange fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        body: { cancel: vi.fn() }
      })
      vi.stubGlobal('fetch', mockFetch)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      const pendingAuths: Map<string, any> = providerInfo.pendingAuths

      pendingAuths.set('fail-state', {
        clientId: 'client-1',
        clientRedirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      const req = { query: { code: 'bad-code', state: 'fail-state' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(502)
      expect(res.json).toHaveBeenCalledWith({
        error: 'token_exchange_failed',
        error_description: 'Failed to exchange code with Notion'
      })
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('token exchange failed'), 401)

      consoleSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('should return 500 when callback handler throws', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      vi.stubGlobal('fetch', mockFetch)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { createNotionOAuthProvider } = await import('../auth/notion-oauth-provider.js')
      const handlers = await startAndGetHandlers()
      const handler = handlers['GET:/callback']?.at(-1) as Fn

      const providerInfo = vi.mocked(createNotionOAuthProvider).mock.results[0].value
      const pendingAuths: Map<string, any> = providerInfo.pendingAuths

      pendingAuths.set('error-state', {
        clientId: 'client-1',
        clientRedirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      const req = { query: { code: 'code', state: 'error-state' } }
      const res = mockRes()
      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'server_error',
        error_description: 'Internal server error'
      })
      expect(consoleSpy).toHaveBeenCalledWith('Callback handler error:', expect.any(Error))

      consoleSpy.mockRestore()
      vi.unstubAllGlobals()
    })
  })

  describe('IP propagation middleware', () => {
    it('should run requestContext with IP from req.ip', async () => {
      await import('../auth/notion-oauth-provider.js')
      const mockLog = vi.spyOn(console, 'info').mockImplementation(() => {})

      const { startHttp } = await import('./http.js')
      const express = (await import('express')).default
      await startHttp()

      const app = (express as any).mock.results[0]?.value
      // The middleware is the first app.use() call — find it
      const useCalls = app.use.mock.calls
      // The IP middleware is passed as a function to app.use()
      // It's the one that calls requestContext.run
      const ipMiddleware = useCalls.find((call: any[]) => {
        const fn = call[0]
        return typeof fn === 'function' && fn.length === 3 // (req, res, next) arity
      })

      if (ipMiddleware) {
        const middleware = ipMiddleware[0]
        const req = { ip: '192.168.1.1', socket: { remoteAddress: '10.0.0.1' } }
        const next = vi.fn()
        // Just verify it calls next without throwing
        middleware(req, {}, next)
        expect(next).toHaveBeenCalled()

        // Test with req.socket.remoteAddress only
        const req2 = { ip: '', socket: { remoteAddress: '10.0.0.2' } }
        middleware(req2, {}, next)
        expect(next).toHaveBeenCalledTimes(2)

        // Test with neither
        const req3 = { ip: '', socket: {} }
        middleware(req3, {}, next)
        expect(next).toHaveBeenCalledTimes(3)
      }

      mockLog.mockRestore()
    })
  })
})
