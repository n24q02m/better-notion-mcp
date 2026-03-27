/**
 * Relay-first setup flow for better-notion-mcp (stdio mode).
 *
 * Always shows the relay URL at startup so users can configure the Notion
 * token via browser. If the user skips, the server starts in degraded mode
 * (help and content_convert tools only).
 *
 * Resolution order:
 * 1. Environment variable (NOTION_TOKEN -- checked by caller in stdio.ts)
 * 2. Encrypted config file (~/.config/mcp/config.enc)
 * 3. Relay setup (browser-based form via relay server)
 * 4. Degraded mode (limited tools)
 */

import { writeConfig } from '@n24q02m/mcp-relay-core'
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'
import { RELAY_SCHEMA } from './relay-schema.js'

const SERVER_NAME = 'better-notion-mcp'
const DEFAULT_RELAY_URL = 'https://better-notion-mcp.n24q02m.com'
const REQUIRED_FIELDS = ['NOTION_TOKEN']

/**
 * Resolve Notion token or trigger relay setup (relay-first design).
 *
 * Resolution order:
 * 1. Encrypted config file (~/.config/mcp/config.enc)
 * 2. Relay setup (browser-based form via relay server)
 *
 * Returns the NOTION_TOKEN string, or null if setup fails/skipped.
 *
 * Note: Environment variable NOTION_TOKEN is NOT checked here --
 * startStdio() in transports/stdio.ts already handles that.
 * This function is only called when NOTION_TOKEN is not set.
 */
export async function ensureConfig(): Promise<string | null> {
  // Check config file
  const result = await resolveConfig(SERVER_NAME, REQUIRED_FIELDS)
  if (result.config !== null) {
    console.error(`Notion config loaded from ${result.source}`)
    return result.config.NOTION_TOKEN
  }

  // No config found -- always trigger relay setup (relay-first)
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

  // Poll for result
  let config: Record<string, string>
  try {
    config = await pollForResult(relayUrl, session)
  } catch (err: any) {
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

  return config.NOTION_TOKEN
}
