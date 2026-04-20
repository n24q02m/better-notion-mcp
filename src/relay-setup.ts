/**
 * Credential resolution for better-notion-mcp (stdio mode).
 *
 * Resolution order (relay only when ALL local sources are empty):
 * 1. ENV VARS          -- NOTION_TOKEN (checked by caller in stdio.ts)
 * 2. RELAY CONFIG      -- Saved from previous relay setup (~/.config/mcp/config.enc)
 * 3. RELAY SETUP       -- Interactive, ONLY when steps 1-2 are ALL empty
 * 4. DEGRADED MODE     -- Limited tools (help + content_convert only)
 */

import { writeConfig } from '@n24q02m/mcp-core'
import { createSession, notifyComplete, pollForResult } from '@n24q02m/mcp-core/relay'
import { resolveConfig } from '@n24q02m/mcp-core/storage'
import { RELAY_SCHEMA } from './relay-schema.js'

const SERVER_NAME = 'better-notion-mcp'
const DEFAULT_RELAY_URL = 'https://better-notion-mcp.n24q02m.com'
const REQUIRED_FIELDS = ['NOTION_TOKEN']

/**
 * Resolve Notion token: config file -> relay setup -> degraded mode.
 *
 * Relay is ONLY triggered when steps 1-2 are ALL empty (first-time setup).
 *
 * Resolution order (env var already checked by caller in stdio.ts):
 * 1. Encrypted config file (~/.config/mcp/config.enc)
 * 2. Relay setup (interactive, only when no local credentials exist)
 * 3. Degraded mode (limited tools)
 *
 * Returns the NOTION_TOKEN string, or null for degraded mode.
 */
export async function ensureConfig(): Promise<string | null> {
  // 1. Check saved relay config file
  const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
  if (result.config !== null) {
    console.error(`Notion config loaded from ${result.source}`)
    return result.config.NOTION_TOKEN
  }

  // 2. No local credentials found -- trigger relay setup
  console.error('No Notion token found. Starting relay setup...')

  const relayUrl = DEFAULT_RELAY_URL
  let session: Awaited<ReturnType<typeof createSession>>
  try {
    session = await createSession(relayUrl, SERVER_NAME, RELAY_SCHEMA)
  } catch {
    console.error(
      `Cannot reach relay server at ${relayUrl}. Set NOTION_TOKEN manually.\nGet your token from https://www.notion.so/my-integrations`
    )
    return null
  }

  // Log URL to stderr (visible to user in MCP client)
  console.error(`\nSetup required. Open this URL to configure:\n${session.relayUrl}\n`)
  console.error(
    'This URL contains temporary setup secrets and will expire in 3 minutes. Do NOT share this link or log it in shared systems.\n'
  )

  // Poll for result
  let config: Record<string, string>
  try {
    config = await pollForResult(relayUrl, session, 2000, 180_000)
  } catch (err: any) {
    // Cleanup session on failure (except skipped which is handled by pollForResult)
    if (err?.message !== 'RELAY_SKIPPED') {
      await fetch(`${relayUrl}/api/sessions/${session.sessionId}`, { method: 'DELETE' }).catch(() => {})
    }

    if (err?.message === 'RELAY_SKIPPED') {
      console.error('Relay setup skipped by user. Notion tools will be limited.')
      return null
    }
    console.error('Relay setup timed out or session expired')
    return null
  }

  // Save to config file for future use
  await writeConfig(SERVER_NAME, config)
  console.error('Notion config saved successfully')

  // Notify the browser and schedule cleanup after the browser has had time to
  // poll the "complete" message. See @n24q02m/mcp-core notifyComplete JSDoc.
  await notifyComplete(relayUrl, session.sessionId, 'Notion token saved. Setup complete!')

  return config.NOTION_TOKEN
}
