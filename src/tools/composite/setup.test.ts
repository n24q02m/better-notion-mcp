import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../credential-state.js', () => ({
  getState: vi.fn(() => 'awaiting_setup'),
  getSetupUrl: vi.fn(() => null),
  getNotionToken: vi.fn(() => null),
  triggerRelaySetup: vi.fn(),
  resetState: vi.fn(),
  resolveCredentialState: vi.fn()
}))

import {
  getNotionToken,
  getSetupUrl,
  getState,
  resetState,
  resolveCredentialState,
  triggerRelaySetup
} from '../../credential-state.js'
import { setup } from './setup.js'

describe('setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no token, awaiting_setup
    vi.mocked(getState).mockReturnValue('awaiting_setup')
    vi.mocked(getSetupUrl).mockReturnValue(null)
    vi.mocked(getNotionToken).mockReturnValue(null)
  })

  describe('status action', () => {
    it('should return state when no token configured', async () => {
      const result = await setup({ action: 'status' })

      expect(result.action).toBe('status')
      expect(result.state).toBe('awaiting_setup')
      expect(result.has_token).toBe(false)
      expect(result.setup_url).toBeNull()
      expect(result.token_source).toBeNull()
    })

    it('should return configured state with relay token', async () => {
      vi.mocked(getState).mockReturnValue('configured')
      vi.mocked(getNotionToken).mockReturnValue('ntn_test123')
      vi.mocked(getSetupUrl).mockReturnValue(null)
      // No env var
      delete process.env.NOTION_TOKEN

      const result = await setup({ action: 'status' })

      expect(result.state).toBe('configured')
      expect(result.has_token).toBe(true)
      expect(result.token_source).toBe('relay')
    })

    it('should return configured state with environment token', async () => {
      vi.mocked(getState).mockReturnValue('configured')
      vi.mocked(getNotionToken).mockReturnValue('ntn_env_token')
      process.env.NOTION_TOKEN = 'ntn_env_token'

      const result = await setup({ action: 'status' })

      expect(result.state).toBe('configured')
      expect(result.has_token).toBe(true)
      expect(result.token_source).toBe('environment')

      delete process.env.NOTION_TOKEN
    })

    it('should include setup_url when available', async () => {
      vi.mocked(getState).mockReturnValue('setup_in_progress')
      vi.mocked(getSetupUrl).mockReturnValue('https://example.com/setup/abc123')

      const result = await setup({ action: 'status' })

      expect(result.state).toBe('setup_in_progress')
      expect(result.setup_url).toBe('https://example.com/setup/abc123')
    })
  })

  describe('start action', () => {
    it('should trigger relay setup and return URL', async () => {
      vi.mocked(triggerRelaySetup).mockResolvedValue('https://example.com/setup/xyz')
      vi.mocked(getState).mockReturnValueOnce('awaiting_setup').mockReturnValue('setup_in_progress')

      const result = await setup({ action: 'start' })

      expect(triggerRelaySetup).toHaveBeenCalled()
      expect(result.action).toBe('start')
      expect(result.setup_url).toBe('https://example.com/setup/xyz')
      expect(result.message).toContain('Relay setup started')
    })

    it('should return message when already configured without force', async () => {
      vi.mocked(getState).mockReturnValue('configured')

      const result = await setup({ action: 'start' })

      expect(triggerRelaySetup).not.toHaveBeenCalled()
      expect(result.state).toBe('configured')
      expect(result.message).toContain('Already configured')
    })

    it('should trigger relay setup when configured with force', async () => {
      vi.mocked(getState).mockReturnValueOnce('configured').mockReturnValue('setup_in_progress')
      vi.mocked(triggerRelaySetup).mockResolvedValue('https://example.com/setup/forced')

      const result = await setup({ action: 'start', force: true })

      expect(triggerRelaySetup).toHaveBeenCalled()
      expect(result.setup_url).toBe('https://example.com/setup/forced')
    })

    it('should handle relay setup failure gracefully', async () => {
      vi.mocked(triggerRelaySetup).mockResolvedValue(null)
      vi.mocked(getState).mockReturnValue('awaiting_setup')

      const result = await setup({ action: 'start' })

      expect(result.setup_url).toBeNull()
      expect(result.message).toContain('Set NOTION_TOKEN manually')
    })
  })

  describe('reset action', () => {
    it('should reset state and return confirmation', async () => {
      const result = await setup({ action: 'reset' })

      expect(resetState).toHaveBeenCalled()
      expect(result.action).toBe('reset')
      expect(result.state).toBe('awaiting_setup')
      expect(result.message).toContain('Credential state reset')
    })
  })

  describe('complete action', () => {
    it('should re-check credentials and return configured state', async () => {
      vi.mocked(resolveCredentialState).mockResolvedValue('configured')
      vi.mocked(getNotionToken).mockReturnValue('ntn_resolved')

      const result = await setup({ action: 'complete' })

      expect(resolveCredentialState).toHaveBeenCalled()
      expect(result.action).toBe('complete')
      expect(result.state).toBe('configured')
      expect(result.has_token).toBe(true)
      expect(result.message).toContain('Credentials verified')
    })

    it('should return awaiting_setup when no credentials found', async () => {
      vi.mocked(resolveCredentialState).mockResolvedValue('awaiting_setup')
      vi.mocked(getNotionToken).mockReturnValue(null)

      const result = await setup({ action: 'complete' })

      expect(result.state).toBe('awaiting_setup')
      expect(result.has_token).toBe(false)
      expect(result.message).toContain('No credentials found')
    })
  })

  describe('invalid action', () => {
    it('should throw error for unsupported action', async () => {
      await expect(setup({ action: 'invalid' as any })).rejects.toThrow('Unsupported action: invalid')
    })
  })
})
