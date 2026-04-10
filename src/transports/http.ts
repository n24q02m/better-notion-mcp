/**
 * HTTP Transport — Remote mode with OAuth 2.1
 * Express server with Notion OAuth callback relay, Streamable HTTP transport, and session management
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { Client } from '@notionhq/client'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { createNotionOAuthProvider, requestContext } from '../auth/notion-oauth-provider.js'
import { createMCPServer } from '../create-server.js'

const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token'

interface HttpConfig {
  port: number
  publicUrl: string
  notionClientId: string
  notionClientSecret: string
  dcrSecret: string
  trustProxy: boolean | number | string
}

function parseTrustProxy(value?: string): boolean | number | string {
  if (!value) return false
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^\d+$/.test(value)) return parseInt(value, 10)
  return value
}

function loadConfig(): HttpConfig {
  const required = ['PUBLIC_URL', 'NOTION_OAUTH_CLIENT_ID', 'NOTION_OAUTH_CLIENT_SECRET', 'DCR_SERVER_SECRET'] as const

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`)
      process.exit(1)
    }
  }

  return {
    port: parseInt(process.env.PORT ?? '8080', 10),
    publicUrl: process.env.PUBLIC_URL!,
    notionClientId: process.env.NOTION_OAUTH_CLIENT_ID!,
    notionClientSecret: process.env.NOTION_OAUTH_CLIENT_SECRET!,
    dcrSecret: process.env.DCR_SERVER_SECRET!,
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY)
  }
}

/**
 * Configure Express middleware and rate limiting
 */
function setupMiddleware(app: express.Express, config: HttpConfig) {
  app.set('trust proxy', config.trustProxy)
  app.disable('x-powered-by')

  // Propagate request IP via AsyncLocalStorage for IP-scoped pending binds
  app.use((req, _res, next) => {
    const ip = req.ip || req.socket.remoteAddress || undefined
    requestContext.run({ ip }, next)
  })

  return {
    mcpRateLimit: rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false
    }),
    authRateLimit: rateLimit({
      windowMs: 60 * 1000,
      limit: 20,
      standardHeaders: 'draft-7',
      legacyHeaders: false
    })
  }
}

/**
 * Setup OAuth routes including MCP auth router and Notion callback relay
 */
function setupOAuthRoutes(
  app: express.Express,
  options: {
    provider: any
    serverUrl: URL
    authRateLimit: express.RequestHandler
    pendingAuths: Map<string, any>
    authCodes: Map<string, any>
    callbackUrl: string
    notionBasicAuth: string
  }
) {
  const { provider, serverUrl, authRateLimit, pendingAuths, authCodes, callbackUrl, notionBasicAuth } = options

  // OAuth endpoints (/.well-known/*, /authorize, /token, /register)
  app.use(
    authRateLimit,
    mcpAuthRouter({
      provider,
      issuerUrl: serverUrl,
      serviceDocumentationUrl: new URL('https://github.com/n24q02m/better-notion-mcp'),
      scopesSupported: ['notion:read', 'notion:write'],
      resourceName: 'Better Notion MCP Server'
    })
  )

  // Notion OAuth callback relay
  app.get('/callback', authRateLimit, async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>

    if (error) {
      res.status(400).json({ error: 'oauth_error', error_description: error })
      return
    }

    if (!code || !state) {
      res.status(400).json({ error: 'invalid_request', error_description: 'Missing code or state' })
      return
    }

    const pending = pendingAuths.get(state)
    if (!pending) {
      res.status(400).json({ error: 'invalid_state', error_description: 'Unknown or expired state' })
      return
    }
    pendingAuths.delete(state)

    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl
      })

      const tokenResponse = await globalThis.fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${notionBasicAuth}`
        },
        body: tokenParams.toString()
      })

      if (!tokenResponse.ok) {
        await tokenResponse.body?.cancel()
        console.error('Notion token exchange failed:', tokenResponse.status)
        res
          .status(502)
          .json({ error: 'token_exchange_failed', error_description: 'Failed to exchange code with Notion' })
        return
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string
        token_type: string
        expires_in?: number
        refresh_token?: string
      }

      const ourAuthCode = randomBytes(32).toString('hex')
      authCodes.set(ourAuthCode, {
        notionAccessToken: tokenData.access_token,
        notionRefreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        codeChallenge: pending.codeChallenge,
        codeChallengeMethod: pending.codeChallengeMethod,
        clientId: pending.clientId,
        createdAt: Date.now()
      })

      const clientRedirect = new URL(pending.clientRedirectUri)
      const protocol = clientRedirect.protocol.toLowerCase()
      if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(protocol)) {
        res.status(400).json({ error: 'invalid_request', error_description: 'Unsafe redirect URI' })
        return
      }

      clientRedirect.searchParams.set('code', ourAuthCode)
      if (pending.clientState) {
        clientRedirect.searchParams.set('state', pending.clientState)
      }

      res.redirect(clientRedirect.toString())
    } catch (err) {
      console.error('Callback handler error:', err)
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' })
    }
  })
}

/**
 * Setup MCP endpoints and session management
 */
function setupMcpRoutes(
  app: express.Express,
  options: {
    mcpRateLimit: express.RequestHandler
    authMiddleware: express.RequestHandler
    provider: any
  }
) {
  const { mcpRateLimit, authMiddleware } = options
  const jsonParser = express.json()
  const transports: Map<string, StreamableHTTPServerTransport> = new Map()
  const sessionOwners: Map<string, string> = new Map() // sessionId → notionToken

  function verifySessionOwner(
    req: express.Request,
    res: express.Response,
    sessionId: string,
    isJsonRpc = false
  ): boolean {
    const authInfo = (req as any).auth
    const ownerToken = sessionOwners.get(sessionId)
    if (ownerToken && authInfo?.token !== ownerToken) {
      if (isJsonRpc) {
        res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Session belongs to a different user' },
          id: null
        })
      } else {
        res.status(403).json({ error: 'Session belongs to a different user' })
      }
      return false
    }
    return true
  }

  app.post('/mcp', mcpRateLimit, jsonParser, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (sessionId && transports.has(sessionId)) {
      if (!verifySessionOwner(req, res, sessionId, true)) return
      await transports.get(sessionId)!.handleRequest(req, res, req.body)
      return
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const authInfo = (req as any).auth
      const notionToken: string = authInfo.token

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport)
          sessionOwners.set(id, notionToken)
        }
      })

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId)
          sessionOwners.delete(transport.sessionId)
        }
      }

      const server = createMCPServer(() => new Client({ auth: notionToken, notionVersion: '2025-09-03' }))
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
      return
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad request: missing session ID or not an initialize request' },
      id: null
    })
  })

  app.get('/mcp', mcpRateLimit, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      if (!verifySessionOwner(req, res, sessionId)) return
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })

  app.delete('/mcp', mcpRateLimit, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      if (!verifySessionOwner(req, res, sessionId)) return
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })
}

export async function startHttp() {
  const config = loadConfig()
  const serverUrl = new URL(config.publicUrl)

  const { provider, pendingAuths, authCodes, callbackUrl, notionBasicAuth } = createNotionOAuthProvider({
    notionClientId: config.notionClientId,
    notionClientSecret: config.notionClientSecret,
    dcrSecret: config.dcrSecret,
    publicUrl: config.publicUrl
  })

  const app = express()
  const { mcpRateLimit, authRateLimit } = setupMiddleware(app, config)

  setupOAuthRoutes(app, {
    provider,
    serverUrl,
    authRateLimit,
    pendingAuths,
    authCodes,
    callbackUrl,
    notionBasicAuth
  })

  const authMiddleware = requireBearerAuth({ verifier: provider })
  setupMcpRoutes(app, {
    mcpRateLimit,
    authMiddleware,
    provider
  })

  // Health check (no auth required)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'remote', timestamp: new Date().toISOString() })
  })

  app.listen(config.port, '0.0.0.0', () => {
    console.info(`Remote MCP server listening on port ${config.port}`)
    console.info(`Public URL: ${config.publicUrl}`)
  })
}
