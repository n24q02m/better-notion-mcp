/**
 * Better Notion MCP Server - Entry point
 * Defaults to HTTP mode, --stdio for backward compat
 */

export async function initServer() {
  const isStdio =
    process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio' || process.env.TRANSPORT_MODE === 'stdio'

  if (isStdio) {
    const { startStdio } = await import('./transports/stdio.js')
    await startStdio()
    return
  }

  // Default: HTTP mode with OAuth 2.1
  const { startHttp } = await import('./transports/http.js')
  await startHttp()
}
