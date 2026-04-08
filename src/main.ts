/**
 * Unified entry point for Better Notion MCP
 *
 * TRANSPORT_MODE selects the transport:
 *   - "stdio" (default): Local mode with NOTION_TOKEN env var
 *   - "http": Remote mode with OAuth 2.1 via Notion
 */

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
export async function bootstrap(selectedMode: string = mode, isTest = process.env.NODE_ENV === 'test') {
  if (isTest) {
    return
  }
  try {
    await startServer(selectedMode)
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Only execute bootstrap if we're NOT in a test environment.
if (process.env.NODE_ENV !== 'test') {
  bootstrap()
}
