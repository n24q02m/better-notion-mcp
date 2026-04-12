/**
 * Non-blocking credential state management for better-notion-mcp.
 *
 * State machine: awaiting_setup -> setup_in_progress -> configured
 * Reset: configured -> awaiting_setup (via reset)
 *
 * Unlike telegram (which needs relay OTP), Notion has a single token.
 * When state is AWAITING_SETUP, token-requiring tools return setup instructions with relay URL.
 * Tools that work without token (help, content_convert) always work.
 */

import { execFile } from 'node:child_process'
import type { RelaySession } from '@n24q02m/mcp-core'
import { createSession, deleteConfig, pollForResult, sendMessage, writeConfig } from '@n24q02m/mcp-core'
import { resolveConfig } from '@n24q02m/mcp-core/storage'
import { RELAY_SCHEMA } from './relay-schema.js'

const SERVER_NAME = 'better-notion-mcp'
const CREDENTIAL_KEY = 'NOTION_TOKEN'
const DEFAULT_RELAY_URL = 'https://better-notion-mcp.n24q02m.com'
const REQUIRED_FIELDS = [CREDENTIAL_KEY]

export type CredentialState = 'awaiting_setup' | 'setup_in_progress' | 'configured'

// Module-level state
let _state: CredentialState = 'awaiting_setup'
let _setupUrl: string | null = null
let _notionToken: string | null = null
let _activeSession: { relayBaseUrl: string; sessionId: string } | null = null

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
 * Start relay session (lazy trigger). Returns setup URL or null.
 *
 * Does NOT block -- returns URL immediately for the tool to include in response.
 * Background poll task applies config when user submits.
 */
export async function triggerRelaySetup(): Promise<string | null> {
  if (_state !== 'awaiting_setup') {
    return _setupUrl
  }

  _state = 'setup_in_progress'

  try {
    const relayUrl = process.env.MCP_RELAY_URL ?? DEFAULT_RELAY_URL
    let session: RelaySession

    try {
      session = await createSession(relayUrl, SERVER_NAME, RELAY_SCHEMA)
    } catch {
      console.error(
        `Cannot reach relay server at ${relayUrl}. Set NOTION_TOKEN manually.\nGet your token from https://www.notion.so/my-integrations`
      )
      _state = 'awaiting_setup'
      return null
    }

    _setupUrl = session.relayUrl
    _activeSession = { relayBaseUrl: relayUrl, sessionId: session.sessionId }

    // Try to open browser (best-effort, non-blocking)
    tryOpenBrowser(session.relayUrl)

    console.error(`\nSetup required. Open this URL to configure:\n${session.relayUrl}\n`)
    console.error(
      'This URL contains temporary setup secrets and will expire in 3 minutes. Do NOT share this link or log it in shared systems.\n'
    )

    // Start background poll (non-blocking)
    pollRelayBackground(relayUrl, session).catch(() => {
      // Background poll failure is logged inside the function
    })

    return _setupUrl
  } catch (err) {
    console.error(`Relay setup failed: ${err}. Server continues in awaiting_setup.`)
    _state = 'awaiting_setup'
    return null
  }
}

/**
 * Background task that polls relay and applies config when user submits.
 */
async function pollRelayBackground(relayBaseUrl: string, session: RelaySession): Promise<void> {
  try {
    const config = await pollForResult(relayBaseUrl, session, 2000, 180_000)

    // Save to config file for future use
    await writeConfig(SERVER_NAME, config)

    // Apply token
    _notionToken = config[CREDENTIAL_KEY]
    _state = 'configured'
    console.error('Notion config saved and applied successfully')

    // Notify relay page setup is complete
    await sendMessage(relayBaseUrl, session.sessionId, {
      type: 'complete',
      text: 'Notion token saved. Setup complete!'
    }).catch(() => {})

    // Explicit session cleanup (one-time use)
    setTimeout(() => {
      fetch(`${relayBaseUrl}/api/sessions/${session.sessionId}`, { method: 'DELETE' }).catch(() => {})
    }, 1000)
  } catch (err: any) {
    // Cleanup session on failure (except skipped)
    if (err?.message !== 'RELAY_SKIPPED') {
      await fetch(`${relayBaseUrl}/api/sessions/${session.sessionId}`, { method: 'DELETE' }).catch(() => {})
    }

    if (err?.message === 'RELAY_SKIPPED') {
      console.error('Relay setup skipped by user. Notion tools will be limited.')
    } else {
      console.error('Relay setup timed out or session expired')
    }
    _state = 'awaiting_setup'
  } finally {
    if (_activeSession?.sessionId === session.sessionId) {
      _activeSession = null
    }
  }
}

/**
 * Try to open URL in default browser (best-effort).
 * Uses execFile (not exec) to avoid shell injection.
 */
function tryOpenBrowser(url: string): void {
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
  deleteConfig(SERVER_NAME).catch(() => {})
}

// Cleanup active session on process exit
const handleExit = async () => {
  if (_activeSession) {
    const { relayBaseUrl, sessionId } = _activeSession
    _activeSession = null
    try {
      await fetch(`${relayBaseUrl}/api/sessions/${sessionId}`, { method: 'DELETE' })
    } catch {
      // Ignore cleanup errors
    }
  }
  process.exit()
}

process.on('SIGINT', handleExit)
process.on('SIGTERM', handleExit)
