import type express from 'express'

export function setupHealthRoute(app: express.Express) {
  // Health check (no auth required)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'remote', timestamp: new Date().toISOString() })
  })
}
