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
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

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

  describe('getNotionToken', () => {
    it('returns null when not configured', () => {
      expect(getNotionToken()).toBeNull()
    })

    it('returns the token when configured via env', async () => {
      process.env.NOTION_TOKEN = 'test-token'
      await resolveCredentialState()
      expect(getNotionToken()).toBe('test-token')
    })
  })

  describe('resolveCredentialState', () => {
    it('configures when NOTION_TOKEN env var is present', async () => {
      process.env.NOTION_TOKEN = 'env-token'
      const state = await resolveCredentialState()
      expect(state).toBe('configured')
      expect(getNotionToken()).toBe('env-token')
    })

    it('configures when config file has token', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({
        config: { NOTION_TOKEN: 'file-token' },
        source: 'file'
      } as never)
      const state = await resolveCredentialState()
      expect(state).toBe('configured')
      expect(getNotionToken()).toBe('file-token')
    })

    it('stays in awaiting_setup when nothing found', async () => {
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
    })

    it('handles config read failure gracefully', async () => {
      vi.mocked(resolveConfig).mockRejectedValue(new Error('read error') as never)
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
    })

    it('stays in awaiting_setup when config file exists but is missing NOTION_TOKEN', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({
        config: {}, // Missing NOTION_TOKEN
        source: 'file'
      } as never)
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
      expect(getNotionToken()).toBeNull()
    })

    it('clears notion token when resolveCredentialState falls back to awaiting_setup', async () => {
      // 1. Setup a configured state
      process.env.NOTION_TOKEN = 'initial-token'
      await resolveCredentialState()
      expect(getState()).toBe('configured')
      expect(getNotionToken()).toBe('initial-token')

      // 2. Remove env var and make resolveConfig fail
      delete process.env.NOTION_TOKEN
      vi.mocked(resolveConfig).mockRejectedValue(new Error('read error') as never)

      // 3. Resolve again
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
      expect(getNotionToken()).toBeNull()
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

    it('handles deleteConfig failure in resetState', async () => {
      vi.mocked(deleteConfig).mockRejectedValue(new Error('delete failed') as never)
      resetState()
      // Allow the unreturned promise catch block to execute
      await new Promise((r) => setTimeout(r, 0))
      expect(getState()).toBe('awaiting_setup')
      expect(deleteConfig).toHaveBeenCalled()
    })
  })

  describe('subject token resolver', () => {
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

    it('restores default resolver on resetState', () => {
      setSubjectTokenResolver(() => 'forced-token')
      expect(getSubjectToken()).toBe('forced-token')
      resetState()
      expect(getSubjectToken()).toBeNull()
    })
  })
})
