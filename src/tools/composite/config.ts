/**
 * Config Tool
 * Manage credential state, relay setup, and configuration lifecycle.
 * Does NOT require a Notion client -- works independently.
 */

import {
  getSetupUrl,
  getState,
  getSubjectToken,
  resetState,
  resolveCredentialState,
  triggerRelaySetup
} from '../../credential-state.js'
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
        const setupUrl = getSetupUrl()
        const token = getSubjectToken()
        return {
          action: 'status',
          state,
          has_token: token !== null,
          setup_url: setupUrl,
          token_source: token ? (process.env.NOTION_TOKEN ? 'environment' : 'relay') : null
        }
      }

      case 'setup_start': {
        const currentState = getState()
        if (currentState === 'configured' && !input.force) {
          return {
            action: 'setup_start',
            state: 'configured',
            message: 'Already configured. Use force: true to trigger relay setup anyway, or setup_reset first.'
          }
        }

        const url = await triggerRelaySetup()
        return {
          action: 'setup_start',
          state: getState(),
          setup_url: url,
          message: url
            ? 'Relay setup started. Open the URL in your browser to configure your Notion token.'
            : 'Could not start relay setup. Set NOTION_TOKEN manually.'
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
