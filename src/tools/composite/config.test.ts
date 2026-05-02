import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../credential-state.js', () => ({
  getState: vi.fn(() => 'awaiting_setup'),
  getNotionToken: vi.fn(() => null),
  getSubjectToken: vi.fn(() => null),
  setSubjectTokenResolver: vi.fn(),
  resetState: vi.fn(),
  resolveCredentialState: vi.fn()
}))

import {
  getNotionToken,
  getState,
  getSubjectToken,
  resetState,
  resolveCredentialState
} from '../../credential-state.js'
import { config } from './config.js'

describe('config', () => {
  const originalPublicUrl = process.env.PUBLIC_URL

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no token, awaiting_setup
    vi.mocked(getState).mockReturnValue('awaiting_setup')
    vi.mocked(getNotionToken).mockReturnValue(null)
    vi.mocked(getSubjectToken).mockReturnValue(null)
    delete process.env.PUBLIC_URL
    delete process.env.NOTION_TOKEN
  })

  afterEach(() => {
    if (originalPublicUrl !== undefined) process.env.PUBLIC_URL = originalPublicUrl
    else delete process.env.PUBLIC_URL
  })

  describe('status action', () => {
    it('should return state when no token configured', async () => {
      const result = await config({ action: 'status' })

      expect(result.action).toBe('status')
      expect(result.state).toBe('awaiting_setup')
      expect(result.has_token).toBe(false)
      expect(result.setup_url).toBeNull()
      expect(result.token_source).toBeNull()
    })

    it('should return configured state with relay token', async () => {
      vi.mocked(getState).mockReturnValue('configured')
      vi.mocked(getNotionToken).mockReturnValue('ntn_test123')
      vi.mocked(getSubjectToken).mockReturnValue('ntn_test123')
      // No env var, no PUBLIC_URL -> token_source 'relay'

      const result = await config({ action: 'status' })

      expect(result.state).toBe('configured')
      expect(result.has_token).toBe(true)
      expect(result.token_source).toBe('relay')
    })

    it('should return configured state with environment token', async () => {
      vi.mocked(getState).mockReturnValue('configured')
      vi.mocked(getNotionToken).mockReturnValue('ntn_env_token')
      vi.mocked(getSubjectToken).mockReturnValue('ntn_env_token')
      process.env.NOTION_TOKEN = 'ntn_env_token'

      const result = await config({ action: 'status' })

      expect(result.state).toBe('configured')
      expect(result.has_token).toBe(true)
      expect(result.token_source).toBe('environment')
    })

    it('should return setup_url derived from PUBLIC_URL in HTTP mode', async () => {
      vi.mocked(getState).mockReturnValue('configured')
      vi.mocked(getSubjectToken).mockReturnValue('ntn_oauth_token')
      process.env.PUBLIC_URL = 'https://better-notion-mcp.example.com'

      const result = await config({ action: 'status' })

      expect(result.setup_url).toBe('https://better-notion-mcp.example.com/authorize')
      expect(result.token_source).toBe('oauth')
    })
  })

  describe('setup_start action', () => {
    it('should return PUBLIC_URL/authorize when in HTTP mode', async () => {
      process.env.PUBLIC_URL = 'https://better-notion-mcp.example.com'

      const result = await config({ action: 'setup_start' })

      expect(result.action).toBe('setup_start')
      expect(result.setup_url).toBe('https://better-notion-mcp.example.com/authorize')
      expect(result.message).toContain('OAuth flow')
    })

    it('should return stdio guidance when no PUBLIC_URL', async () => {
      // No PUBLIC_URL -> stdio mode
      const result = await config({ action: 'setup_start' })

      expect(result.action).toBe('setup_start')
      expect(result.setup_url).toBeNull()
      expect(result.message).toContain('NOTION_TOKEN')
    })
  })

  describe('setup_reset action', () => {
    it('should reset state and return confirmation', async () => {
      const result = await config({ action: 'setup_reset' })

      expect(resetState).toHaveBeenCalled()
      expect(result.action).toBe('setup_reset')
      expect(result.state).toBe('awaiting_setup')
      expect(result.message).toContain('Credential state reset')
    })
  })

  describe('setup_complete action', () => {
    it('should re-check credentials and return configured state', async () => {
      vi.mocked(resolveCredentialState).mockResolvedValue('configured')
      vi.mocked(getNotionToken).mockReturnValue('ntn_resolved')
      vi.mocked(getSubjectToken).mockReturnValue('ntn_resolved')

      const result = await config({ action: 'setup_complete' })

      expect(resolveCredentialState).toHaveBeenCalled()
      expect(result.action).toBe('setup_complete')
      expect(result.state).toBe('configured')
      expect(result.has_token).toBe(true)
      expect(result.message).toContain('Credentials verified')
    })

    it('should return awaiting_setup when no credentials found', async () => {
      vi.mocked(resolveCredentialState).mockResolvedValue('awaiting_setup')
      vi.mocked(getNotionToken).mockReturnValue(null)
      vi.mocked(getSubjectToken).mockReturnValue(null)

      const result = await config({ action: 'setup_complete' })

      expect(result.state).toBe('awaiting_setup')
      expect(result.has_token).toBe(false)
      expect(result.message).toContain('No credentials found')
    })
  })

  describe('set action', () => {
    it('should return error response indicating no mutable runtime settings', async () => {
      const result = await config({ action: 'set' })

      expect(result.action).toBe('set')
      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('cache_clear action', () => {
    it('should return ok with cleared count of 0', async () => {
      const result = await config({ action: 'cache_clear' })

      expect(result.action).toBe('cache_clear')
      expect(result.ok).toBe(true)
      expect(result.cleared).toBe(0)
    })
  })

  describe('invalid action', () => {
    it('should throw error for unsupported action', async () => {
      await expect(config({ action: 'invalid' as never })).rejects.toThrow('Unsupported action: invalid')
    })
  })
})
