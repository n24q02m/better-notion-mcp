/**
 * Non-blocking credential state management for better-notion-mcp.
 *
 * State machine: awaiting_setup -> setup_in_progress -> configured
 * Reset: configured -> awaiting_setup (via reset)
 *
 * When no credentials are present, triggerRelaySetup() spawns a LOCAL HTTP
 * server (via mcp-core runLocalServer with the notion relaySchema) on a
 * random 127.0.0.1 port and returns its /authorize URL. The user pastes
 * their Notion integration token into that local form; onCredentialsSaved
 * persists it to config.enc. The stdio/HTTP server that called us then
 * reads the saved config on its next state resolve and transitions to
 * `configured`. The spawn is LOCAL-ONLY — we never hit a remote relay URL
 * and never follow the server's default mode for the stdio fallback.
 * See `~/.claude/skills/mcp-dev/references/mode-matrix.md` section
 * `stdio proxy` for the canonical rule.
 */

import { execFile } from 'node:child_process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { LocalServerHandle, RelayConfigSchema } from '@n24q02m/mcp-core'
import { deleteConfig, runLocalServer, writeConfig } from '@n24q02m/mcp-core'
import { resolveConfig } from '@n24q02m/mcp-core/storage'
import { RELAY_SCHEMA } from './relay-schema.js'
import { isSafeWebUrl } from './tools/helpers/security.js'

const SERVER_NAME = 'better-notion-mcp'
const CREDENTIAL_KEY = 'NOTION_TOKEN'
const REQUIRED_FIELDS = [CREDENTIAL_KEY]

/** Grace window so the browser renders "Connected" before the spawn closes. */
const SPAWN_CLEANUP_MS = 5_000

export type CredentialState = 'awaiting_setup' | 'setup_in_progress' | 'configured'

// Module-level state
let _state: CredentialState = 'awaiting_setup'
let _setupUrl: string | null = null
let _notionToken: string | null = null
let _activeHandle: LocalServerHandle | null = null

export function getState(): CredentialState {
  return _state
}

export function getSetupUrl(): string | null {
  return _setupUrl
}

export function getNotionToken(): string | null {
  return _notionToken
}

/**
 * Fast, synchronous-ish credential check. Called during startup.
 *
 * Checks (in order):
 * 1. ENV VARS -- NOTION_TOKEN present -> configured
 * 2. CONFIG FILE -- saved relay config has token -> configured
 * 3. NOTHING -- awaiting_setup (server starts fast, relay triggered lazily)
 *
 * Returns new state. Takes <50ms (single file read).
 */
export async function resolveCredentialState(): Promise<CredentialState> {
  // 1. Check env var (already checked by caller, but be defensive)
  const envToken = process.env.NOTION_TOKEN
  if (envToken) {
    _notionToken = envToken
    _state = 'configured'
    console.error('Notion token found in environment')
    return _state
  }

  // 2. Check saved relay config file
  try {
    const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
    if (result.config !== null) {
      _notionToken = result.config[CREDENTIAL_KEY]
      _state = 'configured'
      console.error(`Notion config loaded from ${result.source}`)
      return _state
    }
  } catch {
    // Config file read failure is non-fatal
  }

  // 3. Nothing found
  console.error('No Notion token found -- server starting in awaiting_setup mode')
  _state = 'awaiting_setup'
  return _state
}

/**
 * Lazy setup trigger. Spawns a local HTTP credential form on a random port
 * and returns its URL. Caller surfaces the URL to the user (stderr or tool
 * response). Non-blocking — the user submits the form in their browser and
 * onCredentialsSaved persists to config.enc in the background.
 */
export async function triggerRelaySetup(): Promise<string | null> {
  if (_state !== 'awaiting_setup') {
    return _setupUrl
  }

  _state = 'setup_in_progress'

  try {
    const handle = await runLocalServer(stubMcpFactory, {
      serverName: SERVER_NAME,
      port: 0,
      host: '127.0.0.1',
      relaySchema: RELAY_SCHEMA as unknown as RelayConfigSchema,
      onCredentialsSaved: async (creds) => {
        const token = creds?.[CREDENTIAL_KEY]
        if (typeof token === 'string' && token.length > 0) {
          _notionToken = token
          await writeConfig(SERVER_NAME, { [CREDENTIAL_KEY]: token })
          _state = 'configured'
          console.error('Notion config saved via local relay')
          // Close the spawn after a short grace so the browser renders the
          // "Connected" response before the server goes away.
          setTimeout(() => {
            closeActiveHandle().catch(() => {})
          }, SPAWN_CLEANUP_MS)
        }
        return null
      }
    })

    _activeHandle = handle
    _setupUrl = `http://${handle.host}:${handle.port}/`

    // Try to open browser (best-effort, non-blocking)
    tryOpenBrowser(_setupUrl)

    console.error(`\nSetup required. Open this URL to configure:\n${_setupUrl}\n`)
    console.error('Paste your Notion integration token (https://www.notion.so/my-integrations) in the form.\n')

    return _setupUrl
  } catch (err) {
    console.error(`Relay setup failed: ${err}. Server continues in awaiting_setup.`)
    _state = 'awaiting_setup'
    return null
  }
}

async function closeActiveHandle(): Promise<void> {
  const handle = _activeHandle
  if (!handle) return
  _activeHandle = null
  await handle.close().catch(() => {})
}

/**
 * Minimal MCP server factory for the setup-only spawn. The spawned server
 * exists solely to render the /authorize paste form; /mcp should never be
 * called against it (clients use the primary stdio or http transport).
 * Returning an empty McpServer keeps the types happy without wiring any
 * tools, which would require a credentialed Notion client we don't yet have.
 */
function stubMcpFactory(): McpServer {
  return new McpServer({ name: `${SERVER_NAME}-setup`, version: '0.0.0' })
}

/**
 * Try to open URL in default browser (best-effort).
 * Uses execFile (not exec) to avoid shell injection.
 */
export function tryOpenBrowser(url: string): void {
  if (!isSafeWebUrl(url)) {
    console.error(`Refused to open unsafe URL in browser: ${url}`)
    return
  }

  const platform = process.platform

  if (platform === 'darwin') {
    execFile('open', [url], () => {})
  } else if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], () => {})
  } else {
    execFile('xdg-open', [url], () => {})
  }
}

export function setState(state: CredentialState): void {
  _state = state
}

export function resetState(): void {
  _state = 'awaiting_setup'
  _setupUrl = null
  _notionToken = null
  closeActiveHandle().catch(() => {})
  deleteConfig(SERVER_NAME).catch(() => {})
}

// Cleanup active local spawn on process exit
const handleExit = async () => {
  await closeActiveHandle()
  process.exit()
}

process.on('SIGINT', handleExit)
process.on('SIGTERM', handleExit)
