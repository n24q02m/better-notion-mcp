/**
 * Unified entry point for Better Notion MCP
 *
 * TRANSPORT_MODE selects the transport:
 *   - "stdio" (default): Local mode with NOTION_TOKEN env var
 *   - "http": Remote mode with OAuth 2.1 via Notion
 */

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Checks if the current module is the main entry point.
 */
export function isMain(importMetaUrl: string): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) return false

  try {
    return realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(entrypoint)
  } catch {
    return false
  }
}

/**
 * Validates and returns the transport mode from the environment.
 */
export function getTransportMode(env: NodeJS.ProcessEnv = process.env): string {
  return env.TRANSPORT_MODE ?? 'stdio'
}

/**
 * Dynamically imports and starts the server for the specified mode.
 */
export async function startServer(mode: string): Promise<void> {
  if (mode === 'http') {
    const { startHttp } = await import('./transports/http.js')
    await startHttp()
  } else {
    const { startStdio } = await import('./transports/stdio.js')
    await startStdio()
  }
}

// Global state for the selected mode
export const mode = getTransportMode()

/**
 * Bootstrap function to start the server with error handling.
 */
export async function bootstrap(selectedMode: string = mode) {
  try {
    await startServer(selectedMode)
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Only execute bootstrap if we're the main module.
if (isMain(import.meta.url)) {
  bootstrap()
}
