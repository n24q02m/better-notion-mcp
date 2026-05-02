/**
 * Better Notion MCP Server — Entry point
 *
 * Transport selection (post stdio-pure + http-multi-user split, 2026-05-01):
 *  - stdio (default): NOTION_TOKEN env required, MCP SDK StdioServerTransport
 *    directly (no daemon proxy hop). Single-user.
 *  - http (opt-in): `--http`, `MCP_TRANSPORT=http`, or `TRANSPORT_MODE=http`.
 *    Always remote-oauth, always multi-user (per-JWT-sub Notion token store).
 *
 * Spec: 2026-05-01-stdio-pure-http-multiuser.md §5.2.1.
 */

export async function initServer() {
  const isHttp =
    process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http' || process.env.TRANSPORT_MODE === 'http'

  const { startServer } = await import('./main.js')
  await startServer(isHttp ? 'http' : 'stdio')
}
