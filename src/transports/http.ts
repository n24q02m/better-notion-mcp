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
    dcrSecret: process.env.DCR_SERVER_SECRET!
  }
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

  // Trust exactly 2 reverse proxies (Cloudflare + Caddy) for correct req.ip
  app.set('trust proxy', 2)
  app.disable('x-powered-by')

  // Rate limit MCP endpoints per IP
  const mcpRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  })

  // Rate limit OAuth endpoints per IP to prevent abuse/brute-force
  const authRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 20, // Strict limit for auth endpoints
    standardHeaders: 'draft-7',
    legacyHeaders: false
  })

  // Propagate request IP via AsyncLocalStorage for IP-scoped pending binds
  app.use((req, _res, next) => {
    const ip = req.ip || req.socket.remoteAddress || undefined
    requestContext.run({ ip }, next)
  })

  // OAuth endpoints (/.well-known/*, /authorize, /token, /register)
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl: serverUrl,
      serviceDocumentationUrl: new URL('https://github.com/n24q02m/better-notion-mcp'),
      scopesSupported: ['notion:read', 'notion:write'],
      resourceName: 'Better Notion MCP Server'
    })
  )

  // Notion OAuth callback relay
  // Notion redirects here after user authorizes. We exchange the code,
  // store the token, issue our own auth code, and redirect to MCP client.
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

    // Look up the pending auth
    const pending = pendingAuths.get(state)
    if (!pending) {
      res.status(400).json({ error: 'invalid_state', error_description: 'Unknown or expired state' })
      return
    }
    pendingAuths.delete(state)

    try {
      // Exchange Notion's auth code for a Notion token
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

      // Issue our own auth code and store the Notion token + PKCE challenge for verification
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

      // Redirect back to the MCP client's original redirect_uri
      const clientRedirect = new URL(pending.clientRedirectUri)

      // Prevent XSS and Open Redirect vulnerabilities via unsafe protocols
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

  const authMiddleware = requireBearerAuth({ verifier: provider })
  const jsonParser = express.json()
  const transports: Map<string, StreamableHTTPServerTransport> = new Map()
  // Session owner binding — prevents cross-user session hijacking
  const sessionOwners: Map<string, string> = new Map() // sessionId → notionToken

  // MCP endpoint — POST (new session or existing)
  app.post('/mcp', mcpRateLimit, jsonParser, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // Existing session — verify the authenticated user owns this session
    if (sessionId && transports.has(sessionId)) {
      const authInfo = (req as any).auth
      const ownerToken = sessionOwners.get(sessionId)
      if (ownerToken && authInfo?.token !== ownerToken) {
        res.status(403).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Session belongs to a different user' },
          id: null
        })
        return
      }
      await transports.get(sessionId)!.handleRequest(req, res, req.body)
      return
    }

    // New session — must be initialize request
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

      // Per-session MCP server with the user's Notion token
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

  // Verify session ownership for GET/DELETE endpoints
  function verifySessionOwner(req: express.Request, res: express.Response, sessionId: string): boolean {
    const authInfo = (req as any).auth
    const ownerToken = sessionOwners.get(sessionId)
    if (ownerToken && authInfo?.token !== ownerToken) {
      res.status(403).json({ error: 'Session belongs to a different user' })
      return false
    }
    return true
  }

  // MCP endpoint — GET (SSE streaming for existing session)
  app.get('/mcp', mcpRateLimit, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      if (!verifySessionOwner(req, res, sessionId)) return
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
  })

  // MCP endpoint — DELETE (close session)
  app.delete('/mcp', mcpRateLimit, authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    if (sessionId && transports.has(sessionId)) {
      if (!verifySessionOwner(req, res, sessionId)) return
      await transports.get(sessionId)!.handleRequest(req, res)
    } else {
      res.status(400).json({ error: 'Invalid or missing session' })
    }
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
