/**
 * Unified entry point for Better Notion MCP
 *
 * TRANSPORT_MODE selects the transport:
 *   - "stdio" (default): Local mode with NOTION_TOKEN env var, MCP SDK
 *     StdioServerTransport directly (no daemon proxy hop). See spec
 *     2026-04-30-multi-mode-stdio-http-architecture.md Task 3.1.
 *   - "http": Remote mode with OAuth 2.1 via Notion
 */

import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@notionhq/client'
import { getNotionToken, resolveCredentialState } from './credential-state.js'
import { registerTools } from './tools/registry.js'

const SERVER_NAME = 'better-notion-mcp'

function getPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkgPath = join(here, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

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
    return
  }

  // Direct MCP SDK stdio transport (no daemon proxy hop).
  // See spec 2026-04-30-multi-mode-stdio-http-architecture.md Task 3.1.
  await resolveCredentialState()

  const server = new Server(
    { name: SERVER_NAME, version: getPackageVersion() },
    { capabilities: { tools: {}, resources: {} } }
  )

  // Stdio is single-user: tokens come from NOTION_TOKEN env or local relay
  // config.enc. The factory returns a client built from whatever token is
  // currently saved in credential-state.
  const notionClientFactory = (): Client => {
    const token = getNotionToken()
    if (!token) {
      throw new Error('Notion integration token not configured. Set NOTION_TOKEN env var or run the relay setup form.')
    }
    return new Client({ auth: token, notionVersion: '2025-09-03' })
  }

  registerTools(server, notionClientFactory)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[${SERVER_NAME}] Server started in stdio mode (v${getPackageVersion()})`)
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
// Rebuild target: mcp-core 1.11.5 (P0 fork-bomb fix)
