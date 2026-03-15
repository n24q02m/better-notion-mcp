import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { Client } from '@notionhq/client'
import express from 'express'
import { createMCPServer } from '../create-server.js'

export interface McpRoutesDeps {
  app: express.Express
  mcpRateLimit: express.RequestHandler
  authMiddleware: express.RequestHandler
  transports: Map<string, StreamableHTTPServerTransport>
  sessionOwners: Map<string, string>
}

export function setupMcpRoutes({ app, mcpRateLimit, authMiddleware, transports, sessionOwners }: McpRoutesDeps) {
  const jsonParser = express.json()

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
}
