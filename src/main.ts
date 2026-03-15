/**
 * Unified entry point for Better Notion MCP
 *
 * TRANSPORT_MODE selects the transport:
 *   - "stdio" (default): Local mode with NOTION_TOKEN env var
 *   - "http": Remote mode with OAuth 2.1 via Notion
 */

export const mode = process.env.TRANSPORT_MODE ?? 'stdio'

if (mode === 'http') {
  const { startHttp } = await import('./transports/http.js')
  await startHttp()
} else {
  const { startStdio } = await import('./transports/stdio.js')
  await startStdio()
}
