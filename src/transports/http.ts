/**
 * HTTP Transport — Remote mode with OAuth 2.1
 * Express server with Notion OAuth callback relay, Streamable HTTP transport, and session management
 */

import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { createNotionOAuthProvider, requestContext } from '../auth/notion-oauth-provider.js'
import { setupCallbackRoute } from '../routes/callback.js'
import { setupHealthRoute } from '../routes/health.js'
import { setupMcpRoutes } from '../routes/mcp.js'

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

  // Trust reverse proxy headers (Caddy, CF) for express-rate-limit
  app.set('trust proxy', true)

  // Rate limit MCP endpoints per IP
  const mcpRateLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
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

  setupCallbackRoute({
    app,
    pendingAuths,
    authCodes,
    callbackUrl,
    notionBasicAuth
  })

  const authMiddleware = requireBearerAuth({ verifier: provider })
  const transports: Map<string, StreamableHTTPServerTransport> = new Map()
  const sessionOwners: Map<string, string> = new Map()

  setupMcpRoutes({
    app,
    mcpRateLimit,
    authMiddleware,
    transports,
    sessionOwners
  })

  setupHealthRoute(app)

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Remote MCP server listening on port ${config.port}`)
    console.log(`Public URL: ${config.publicUrl}`)
  })
}
