/**
 * Better Notion MCP Server — Entry point
 *
 * Transport selection:
 *  - stdio (backward compat): `--stdio`, `MCP_TRANSPORT=stdio`, or `TRANSPORT_MODE=stdio`
 *  - http (default): local mode via `@n24q02m/mcp-core` runLocalServer
 *
 * HTTP mode uses the local OAuth 2.1 AS from `mcp-core` which serves the
 * credential form (user pastes Notion integration token) on /authorize and
 * issues a local JWT for /mcp Bearer auth. Remote mode (delegated upstream
 * Notion OAuth) is intentionally not wired here -- per L2 migration scope,
 * remote mode is deferred and will be re-added once multi-user per-user token
 * storage is in place.
 */

export async function initServer() {
  const isStdio =
    process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio' || process.env.TRANSPORT_MODE === 'stdio'

  if (isStdio) {
    const { startStdio } = await import('./transports/stdio.js')
    await startStdio()
    return
  }

  const { startHttp } = await import('./transports/http.js')
  await startHttp()
}
