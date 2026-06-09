/**
 * Tests for credential state management.
 *
 * Post stdio-pure + http-multi-user split (2026-05-01): no relay spawn,
 * no setupUrl, no triggerRelaySetup. Just env/file resolution + state
 * machine + per-subject token resolver.
 */

import { deleteConfig } from '@n24q02m/mcp-core'
import { resolveConfig } from '@n24q02m/mcp-core/storage'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getNotionToken,
  getState,
  getSubjectToken,
  resetState,
  resolveCredentialState,
  setState,
  setSubjectTokenResolver
} from './credential-state.js'

vi.mock('@n24q02m/mcp-core', () => ({
  deleteConfig: vi.fn()
}))

vi.mock('@n24q02m/mcp-core/storage', () => ({
  resolveConfig: vi.fn()
}))

describe('credential-state', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetAllMocks()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(deleteConfig).mockResolvedValue(undefined as never)
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null } as never)

    resetState()
    delete process.env.NOTION_TOKEN
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initial state is awaiting_setup', () => {
    expect(getState()).toBe('awaiting_setup')
    expect(getNotionToken()).toBeNull()
  })

  describe('resolveCredentialState', () => {
    it('configures when NOTION_TOKEN env var is present', async () => {
      process.env.NOTION_TOKEN = 'env-token'
      const state = await resolveCredentialState()
      expect(state).toBe('configured')
      expect(getNotionToken()).toBe('env-token')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('found in environment'))
    })

    it('configures when config file has token', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({
        config: { NOTION_TOKEN: 'file-token' },
        source: 'file'
      } as never)
      const state = await resolveCredentialState()
      expect(state).toBe('configured')
      expect(getNotionToken()).toBe('file-token')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('loaded from file'))
    })

    it('stays in awaiting_setup when nothing found', async () => {
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No Notion token found'))
    })

    it('handles config read failure gracefully', async () => {
      vi.mocked(resolveConfig).mockRejectedValue(new Error('read error') as never)
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
    })
  })

  describe('resetState', () => {
    it('resets all state and calls deleteConfig', () => {
      setState('configured')
      resetState()
      expect(getState()).toBe('awaiting_setup')
      expect(getNotionToken()).toBeNull()
      expect(deleteConfig).toHaveBeenCalledWith('better-notion-mcp')
    })

    it('handles deleteConfig failure in resetState', () => {
      vi.mocked(deleteConfig).mockRejectedValue(new Error('delete failed') as never)
      resetState()
      expect(getState()).toBe('awaiting_setup')
      expect(deleteConfig).toHaveBeenCalled()
    })
  })

  describe('subject token resolver', () => {
    beforeEach(() => {
      // Reset to default (module-global single-user fallback)
      setSubjectTokenResolver(() => getNotionToken())
    })

    it('defaults to single-user module global when no resolver injected', () => {
      setState('awaiting_setup')
      expect(getSubjectToken()).toBeNull()
    })

    it('returns injected per-subject token for remote-oauth mode', () => {
      let currentSub = 'alice'
      const storeByAlice = 'ntn_alice_token'
      const storeByBob = 'ntn_bob_token'
      setSubjectTokenResolver(() => {
        if (currentSub === 'alice') return storeByAlice
        if (currentSub === 'bob') return storeByBob
        return null
      })
      expect(getSubjectToken()).toBe(storeByAlice)
      currentSub = 'bob'
      expect(getSubjectToken()).toBe(storeByBob)
      currentSub = 'unknown'
      expect(getSubjectToken()).toBeNull()
    })
  })
})
