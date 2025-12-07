/**
 * Better Notion MCP Server Starter
 * Simplified to use composite tools only
 */

import { initServer } from '../src/init-server.js'

async function startServer() {
  try {
    await initServer()

    // Keep process running
    process.on('SIGINT', () => {
      console.error('\nShutting down Better Notion MCP Server')
      process.exit(0)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
