/**
 * Non-blocking credential state management for better-notion-mcp.
 *
 * State machine: awaiting_setup -> configured
 * Reset: configured -> awaiting_setup (via reset)
 *
 * Post stdio-pure + http-multi-user split (2026-05-01): the daemon-bridge
 * relay setup spawn is gone. In stdio mode the server fails fast with a
 * clear stderr message when NOTION_TOKEN is missing (see main.ts). In HTTP
 * mode the OAuth 2.1 AS in mcp-core serves the credential form directly at
 * /authorize on the same port as /mcp -- no separate spawn, no random port.
 *
 * This module is the single source of truth for "is the server configured?"
 * It supports two token resolution strategies:
 *  - stdio / single-user: module-global ``_notionToken`` from env or
 *    config.enc, set during ``resolveCredentialState``.
 *  - HTTP / multi-user (remote-oauth): per-JWT-sub resolver injected by the
 *    HTTP transport so ``config(action=status)`` reflects whether the
 *    CURRENT caller has a Notion access token.
 */

import { deleteConfig } from '@n24q02m/mcp-core'
import { resolveConfig } from '@n24q02m/mcp-core/storage'

const SERVER_NAME = 'better-notion-mcp'
const CREDENTIAL_KEY = 'NOTION_TOKEN'
const REQUIRED_FIELDS = [CREDENTIAL_KEY]

export type CredentialState = 'awaiting_setup' | 'configured'

// Module-level state
let _state: CredentialState = 'awaiting_setup'
let _notionToken: string | null = null

export function getState(): CredentialState {
  return _state
}

export function getNotionToken(): string | null {
  return _notionToken
}

/**
 * Per-request token resolver. Stdio / single-user leaves the default
 * resolver, which reads the module global. ``remote-oauth`` HTTP mode
 * injects a resolver that reads the per-JWT-sub ``NotionTokenStore`` so
 * that ``config(action=status)`` reflects whether the CURRENT caller has a
 * Notion access token -- not whether the server process has any global
 * token, which is always null in multi-user remote-oauth mode.
 */
let _subjectTokenResolver: () => string | null = () => _notionToken

export function setSubjectTokenResolver(fn: () => string | null): void {
  _subjectTokenResolver = fn
}

export function getSubjectToken(): string | null {
  return _subjectTokenResolver()
}

/**
 * Fast, synchronous-ish credential check. Called during startup.
 *
 * Checks (in order):
 * 1. ENV VARS -- NOTION_TOKEN present -> configured
 * 2. CONFIG FILE -- saved relay config has token -> configured
 * 3. NOTHING -- awaiting_setup
 *
 * Returns new state. Takes <50ms (single file read).
 */
export async function resolveCredentialState(): Promise<CredentialState> {
  // 1. Check env var
  const envToken = process.env.NOTION_TOKEN
  if (envToken) {
    _notionToken = envToken
    _state = 'configured'
    console.error('Notion token found in environment')
    return _state
  }

  // 2. Check saved relay config file (HTTP mode only -- stdio shouldn't get
  // here without env, see main.ts startServer('stdio') guard).
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

export function setState(state: CredentialState): void {
  _state = state
}

export function resetState(): void {
  _state = 'awaiting_setup'
  _notionToken = null
  deleteConfig(SERVER_NAME).catch(() => {})
}
