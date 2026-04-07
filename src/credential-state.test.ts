import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock mcp-relay-core modules
vi.mock('@n24q02m/mcp-relay-core/storage', () => ({
  resolveConfig: vi.fn()
}))
vi.mock('@n24q02m/mcp-relay-core', () => ({
  createSession: vi.fn(),
  pollForResult: vi.fn(),
  sendMessage: vi.fn(),
  writeConfig: vi.fn(),
  deleteConfig: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

import { execFile } from 'node:child_process'
import { createSession, pollForResult, sendMessage } from '@n24q02m/mcp-relay-core'
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'
import {
  getNotionToken,
  getSetupUrl,
  getState,
  resetState,
  resolveCredentialState,
  setState,
  triggerRelaySetup
} from './credential-state.js'

describe('credential-state', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('NOTION_TOKEN', '')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('starts in awaiting_setup', () => {
      expect(getState()).toBe('awaiting_setup')
      expect(getSetupUrl()).toBeNull()
      expect(getNotionToken()).toBeNull()
    })
  })

  describe('resolveCredentialState', () => {
    it('resolves from environment variable', async () => {
      vi.stubEnv('NOTION_TOKEN', 'ntn_env_token')
      const state = await resolveCredentialState()
      expect(state).toBe('configured')
      expect(getNotionToken()).toBe('ntn_env_token')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('found in environment'))
    })

    it('resolves from config file when env is missing', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({
        config: { NOTION_TOKEN: 'ntn_file_token' },
        source: 'file'
      })

      const state = await resolveCredentialState()
      expect(state).toBe('configured')
      expect(getNotionToken()).toBe('ntn_file_token')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('loaded from file'))
    })

    it('stays in awaiting_setup when nothing is found', async () => {
      vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
      expect(getNotionToken()).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('awaiting_setup mode'))
    })

    it('handles config file read failure gracefully', async () => {
      vi.mocked(resolveConfig).mockRejectedValue(new Error('Read error'))
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
    })
  })

  describe('triggerRelaySetup', () => {
    it('triggers relay setup and starts polling', async () => {
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'test-session',
        relayUrl: 'https://relay.test/setup?s=test-session',
        passphrase: 'test',
        keyPair: {} as any
      })
      vi.mocked(pollForResult).mockResolvedValue({ NOTION_TOKEN: 'ntn_relay_token' })
      vi.mocked(sendMessage).mockResolvedValue('msg-id')

      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      const url = await triggerRelaySetup()
      expect(url).toBe('https://relay.test/setup?s=test-session')
      expect(getState()).toBe('setup_in_progress')
      expect(getSetupUrl()).toBe('https://relay.test/setup?s=test-session')
      expect(execFile).toHaveBeenCalled()

      await vi.runAllTimersAsync()

      expect(getNotionToken()).toBe('ntn_relay_token')
      expect(getState()).toBe('configured')
      expect(sendMessage).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/test-session'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('handles relay session creation failure', async () => {
      vi.mocked(createSession).mockRejectedValue(new Error('Relay down'))
      const url = await triggerRelaySetup()
      expect(url).toBeNull()
      expect(getState()).toBe('awaiting_setup')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot reach relay server'))
    })

    it('returns existing URL if setup is already in progress', async () => {
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'test-session',
        relayUrl: 'https://relay.test/setup?s=test-session',
        passphrase: 'test',
        keyPair: {} as any
      })
      await triggerRelaySetup()
      const url = await triggerRelaySetup()
      expect(url).toBe('https://relay.test/setup?s=test-session')
      expect(createSession).toHaveBeenCalledTimes(1)
    })

    it('handles poll failure', async () => {
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'test-session',
        relayUrl: 'https://relay.test/setup?s=test-session',
        passphrase: 'test',
        keyPair: {} as any
      })
      vi.mocked(pollForResult).mockRejectedValue(new Error('Poll timeout'))
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await triggerRelaySetup()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('awaiting_setup')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'))
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/test-session'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('handles RELAY_SKIPPED error', async () => {
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'test-session',
        relayUrl: 'https://relay.test/setup?s=test-session',
        passphrase: 'test',
        keyPair: {} as any
      })
      vi.mocked(pollForResult).mockRejectedValue(new Error('RELAY_SKIPPED'))
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await triggerRelaySetup()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('awaiting_setup')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('skipped by user'))
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('handles unexpected error in triggerRelaySetup', async () => {
      vi.mocked(createSession).mockImplementation(() => {
        // This will be caught by the outer try-catch because it happens after _state = 'setup_in_progress'
        // Actually it's inside the same try block.
        throw new Error('Unexpected crash')
      })
      // To reach the outer catch, we need to bypass the inner catch which is for createSession.
      // Wait, createSession call is WRAPPED in a try-catch.
      // If createSession throws, it's caught by the inner catch.

      // Let's mock a success for createSession but throw elsewhere.
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'test-session',
        relayUrl: 'https://relay.test/setup?s=test-session',
        passphrase: 'test',
        keyPair: {} as any
      })
      // Mock pollRelayBackground or something else to throw?
      // Wait, triggerRelaySetup has:
      // try {
      //   _state = 'setup_in_progress'
      //   try { session = await createSession(...) } catch { ... return null }
      //   ...
      // } catch (err) { ... }

      // The outer catch is reached if something BETWEEN the inner try-catch and the end of outer try-catch throws.
      // For example, tryOpenBrowser.
      vi.mocked(execFile).mockImplementation(() => {
        throw new Error('Exec error')
      })

      const url = await triggerRelaySetup()
      expect(url).toBeNull()
      expect(getState()).toBe('awaiting_setup')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Relay setup failed'))
    })
  })

  describe('setState and resetState', () => {
    it('sets state correctly', () => {
      setState('setup_in_progress')
      expect(getState()).toBe('setup_in_progress')
    })

    it('resets state correctly', () => {
      setState('configured')
      resetState()
      expect(getState()).toBe('awaiting_setup')
      expect(getSetupUrl()).toBeNull()
      expect(getNotionToken()).toBeNull()
    })
  })
})
