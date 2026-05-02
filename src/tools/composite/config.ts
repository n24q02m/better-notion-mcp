/**
 * Config Tool
 * Manage credential state, relay setup, and configuration lifecycle.
 * Does NOT require a Notion client -- works independently.
 */

import { getState, getSubjectToken, resetState, resolveCredentialState } from '../../credential-state.js'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'

export interface ConfigInput {
  action: 'status' | 'setup_start' | 'setup_reset' | 'setup_complete' | 'set' | 'cache_clear'
  force?: boolean
  key?: string
  value?: string
}

/**
 * Manage server configuration and credential state
 */
export async function config(input: ConfigInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'status': {
        const state = getState()
        const token = getSubjectToken()
        const publicUrl = process.env.PUBLIC_URL ?? null
        return {
          action: 'status',
          state,
          has_token: token !== null,
          setup_url: publicUrl ? `${publicUrl}/authorize` : null,
          token_source: token ? (process.env.NOTION_TOKEN ? 'environment' : publicUrl ? 'oauth' : 'relay') : null
        }
      }

      case 'setup_start': {
        // Post stdio-pure + http-multi-user split (2026-05-01): the
        // daemon-bridge relay setup spawn is gone. In stdio mode the
        // server requires NOTION_TOKEN env at startup. In HTTP mode the
        // OAuth flow lives at <PUBLIC_URL>/authorize served by the same
        // process -- no separate trigger needed.
        const publicUrl = process.env.PUBLIC_URL
        if (publicUrl) {
          return {
            action: 'setup_start',
            state: getState(),
            setup_url: `${publicUrl}/authorize`,
            message: `Open ${publicUrl}/authorize in your browser to complete the Notion OAuth flow.`
          }
        }
        return {
          action: 'setup_start',
          state: getState(),
          setup_url: null,
          message:
            'In stdio mode set NOTION_TOKEN env var in your MCP plugin config (get token from https://www.notion.so/my-integrations). To use HTTP/OAuth flow run with TRANSPORT_MODE=http and PUBLIC_URL set.'
        }
      }

      case 'setup_reset': {
        resetState()
        return {
          action: 'setup_reset',
          state: getState(),
          message: 'Credential state reset. Token cleared, config file deleted. Use setup_start to reconfigure.'
        }
      }

      case 'setup_complete': {
        const newState = await resolveCredentialState()
        return {
          action: 'setup_complete',
          state: newState,
          has_token: getSubjectToken() !== null,
          message:
            newState === 'configured'
              ? 'Credentials verified. Notion tools are ready.'
              : 'No credentials found. Use setup_start to begin relay setup.'
        }
      }

      case 'set': {
        return {
          action: 'set',
          ok: false,
          error: 'Notion has no mutable runtime settings. To update your token, use setup_reset then setup_start.'
        }
      }

      case 'cache_clear': {
        return {
          action: 'cache_clear',
          ok: true,
          cleared: 0,
          message: 'No client-side cache to clear. Notion API responses are not cached.'
        }
      }

      default:
        throw new NotionMCPError(
          `Unsupported action: ${(input as any).action}`,
          'VALIDATION_ERROR',
          'Valid actions: status, setup_start, setup_reset, setup_complete, set, cache_clear'
        )
    }
  })()
}
