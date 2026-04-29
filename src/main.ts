/**
 * Unified entry point for Better Notion MCP
 *
 * TRANSPORT_MODE selects the transport:
 *   - "stdio" (default): Local mode with NOTION_TOKEN env var
 *   - "http": Remote mode with OAuth 2.1 via Notion
 */

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runSmartStdioProxy } from '@n24q02m/mcp-core/transport'

/**
 * Checks if the current module is the main entry point.
 */
export function isMain(importMetaUrl: string): boolean {
  const entrypoint = process.argv[1]
  if (!entrypoint) return false

  try {
    const mainPath = realpathSync(fileURLToPath(importMetaUrl))
    const entryPath = realpathSync(entrypoint)

    if (process.platform === 'win32') {
      // Normalize slashes and casing for Windows
      const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase()
      return normalize(mainPath) === normalize(entryPath)
    }

    return mainPath === entryPath
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
    const { RELAY_SCHEMA } = await import('./relay-schema.js')
    const daemonCmd = [process.execPath, process.argv[1]!]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exitCode = await runSmartStdioProxy('better-notion-mcp', daemonCmd, {
      env: { TRANSPORT_MODE: 'http', MCP_MODE: 'local-relay' },
      eagerRelaySchema: RELAY_SCHEMA as any
    })
    process.exit(exitCode)
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

// Only execute bootstrap if we're the main module and not in a test environment.
if (isMain(import.meta.url) && process.env.NODE_ENV !== 'test') {
  bootstrap()
}
