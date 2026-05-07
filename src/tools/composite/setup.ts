/**
 * Setup Tool
 * Manage credential state, relay setup, and configuration lifecycle.
 * Does NOT require a Notion client -- works independently.
 */

import {
  getNotionToken,
  getSetupUrl,
  getState,
  resetState,
  resolveCredentialState,
  triggerRelaySetup
} from '../../credential-state.js'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'

export interface SetupInput {
  action: 'status' | 'start' | 'reset' | 'complete'
  force?: boolean
}

/**
 * Manage server setup and credential state
 */
export async function setup(input: SetupInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'status': {
        const state = getState()
        const setupUrl = getSetupUrl()
        const token = getNotionToken()
        return {
          action: 'status',
          state,
          has_token: token !== null,
          setup_url: setupUrl,
          token_source: token ? (process.env.NOTION_TOKEN ? 'environment' : 'relay') : null
        }
      }

      case 'start': {
        const currentState = getState()
        if (currentState === 'configured' && !input.force) {
          return {
            action: 'start',
            state: 'configured',
            message: 'Already configured. Use force: true to trigger relay setup anyway, or reset first.'
          }
        }

        const url = await triggerRelaySetup()
        return {
          action: 'start',
          state: getState(),
          setup_url: url,
          message: url
            ? 'Relay setup started. Open the URL in your browser to configure your Notion token.'
            : 'Could not start relay setup. Set NOTION_TOKEN manually.'
        }
      }

      case 'reset': {
        resetState()
        return {
          action: 'reset',
          state: getState(),
          message: 'Credential state reset. Token cleared, config file deleted. Use start to reconfigure.'
        }
      }

      case 'complete': {
        const newState = await resolveCredentialState()
        return {
          action: 'complete',
          state: newState,
          has_token: getNotionToken() !== null,
          message:
            newState === 'configured'
              ? 'Credentials verified. Notion tools are ready.'
              : 'No credentials found. Use start to begin relay setup.'
        }
      }

      default:
        throw new NotionMCPError(
          `Unsupported action: ${input.action}`,
          'VALIDATION_ERROR',
          'Valid actions: status, start, reset, complete'
        )
    }
  })()
}
