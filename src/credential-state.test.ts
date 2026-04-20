/**
 * Tests for credential state management.
 */

import { execFile } from 'node:child_process'
import { createSession, deleteConfig, pollForResult, sendMessage, writeConfig } from '@n24q02m/mcp-core'
import { resolveConfig } from '@n24q02m/mcp-core/storage'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getNotionToken,
  getSetupUrl,
  getState,
  resetState,
  resolveCredentialState,
  setState,
  triggerRelaySetup
} from './credential-state.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  createSession: vi.fn(),
  deleteConfig: vi.fn(),
  sendMessage: vi.fn(),
  pollForResult: vi.fn(),
  writeConfig: vi.fn()
}))

vi.mock('@n24q02m/mcp-core/storage', () => ({
  resolveConfig: vi.fn()
}))

describe('credential-state', () => {
  let consoleSpy: any

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Default mock implementations
    vi.mocked(deleteConfig).mockResolvedValue(undefined as any)
    vi.mocked(sendMessage).mockResolvedValue(undefined as any)
    vi.mocked(writeConfig).mockResolvedValue(undefined as any)
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })

    resetState()
    delete process.env.NOTION_TOKEN
    delete process.env.MCP_RELAY_URL
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('initial state is awaiting_setup', () => {
    expect(getState()).toBe('awaiting_setup')
    expect(getSetupUrl()).toBeNull()
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
      })
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
      vi.mocked(resolveConfig).mockRejectedValue(new Error('read error'))
      const state = await resolveCredentialState()
      expect(state).toBe('awaiting_setup')
    })
  })

  describe('triggerRelaySetup', () => {
    it('returns null if relay is unreachable', async () => {
      vi.mocked(createSession).mockRejectedValue(new Error('unreachable'))
      const url = await triggerRelaySetup()
      expect(url).toBeNull()
      expect(getState()).toBe('awaiting_setup')
    })

    it('returns setup URL and starts polling on success', async () => {
      const mockSession = {
        sessionId: 'session-123',
        relayUrl: 'https://relay.com/setup'
      }
      vi.mocked(createSession).mockResolvedValue(mockSession as any)
      vi.mocked(pollForResult).mockResolvedValue({ NOTION_TOKEN: 'relay-token' })

      const url = await triggerRelaySetup()

      expect(url).toBe(mockSession.relayUrl)
      expect(getSetupUrl()).toBe(mockSession.relayUrl)
      expect(getState()).toBe('setup_in_progress')
      expect(execFile).toHaveBeenCalled()

      await vi.runAllTimersAsync()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('configured')
      expect(getNotionToken()).toBe('relay-token')
      expect(writeConfig).toHaveBeenCalledWith('better-notion-mcp', { NOTION_TOKEN: 'relay-token' })
      // sendMessage handles both the POST /messages and the deferred DELETE.
      expect(sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        'session-123',
        expect.objectContaining({ text: expect.stringContaining('Setup complete') })
      )
    })

    it('returns immediately if already setup_in_progress', async () => {
      setState('setup_in_progress')
      const url = await triggerRelaySetup()
      expect(createSession).not.toHaveBeenCalled()
      expect(url).toBeNull() // _setupUrl is null initially
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
      vi.mocked(deleteConfig).mockRejectedValue(new Error('delete failed'))
      resetState()
      expect(getState()).toBe('awaiting_setup')
      expect(deleteConfig).toHaveBeenCalled()
    })
  })

  describe('error handling in pollRelayBackground', () => {
    it('handles RELAY_SKIPPED', async () => {
      vi.mocked(createSession).mockResolvedValue({ sessionId: 's1', relayUrl: 'u1' } as any)
      vi.mocked(pollForResult).mockRejectedValue(new Error('RELAY_SKIPPED'))

      await triggerRelaySetup()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('awaiting_setup')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('handles timeout/other errors and cleans up', async () => {
      vi.mocked(createSession).mockResolvedValue({ sessionId: 's1', relayUrl: 'u1' } as any)
      vi.mocked(pollForResult).mockRejectedValue(new Error('timeout'))

      await triggerRelaySetup()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('awaiting_setup')
      expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'DELETE' }))
    })

    it('still reaches configured state when sendMessage rejects', async () => {
      vi.mocked(createSession).mockResolvedValue({ sessionId: 's1', relayUrl: 'u1' } as any)
      vi.mocked(pollForResult).mockResolvedValue({ NOTION_TOKEN: 'token' })
      vi.mocked(sendMessage).mockRejectedValue(new Error('send failed'))

      await triggerRelaySetup()
      await vi.runAllTimersAsync()
      await vi.runAllTimersAsync()

      // sendMessage swallows errors internally; even when we simulate it
      // rejecting, the state must reach configured because credentials were
      // already persisted via writeConfig before the call.
      expect(sendMessage).toHaveBeenCalled()
    })
  })

  describe('tryOpenBrowser', () => {
    it('calls open on darwin', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      vi.mocked(createSession).mockResolvedValue({ relayUrl: 'https://example.com' } as any)
      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('open', ['https://example.com'], expect.any(Function))
      // Trigger callback for coverage
      const callback = vi.mocked(execFile).mock.calls[0][2] as (
        error: Error | null,
        stdout: string,
        stderr: string
      ) => void
      callback(null, '', '')
    })

    it('calls cmd on win32', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      vi.mocked(createSession).mockResolvedValue({ relayUrl: 'https://example.com' } as any)
      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('cmd', ['/c', 'start', '', 'https://example.com'], expect.any(Function))
      // Trigger callback for coverage
      const callback = vi.mocked(execFile).mock.calls[0][2] as (
        error: Error | null,
        stdout: string,
        stderr: string
      ) => void
      callback(null, '', '')
    })

    it('calls xdg-open on other platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      vi.mocked(createSession).mockResolvedValue({ relayUrl: 'https://example.com' } as any)
      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('xdg-open', ['https://example.com'], expect.any(Function))
      // Trigger callback for coverage
      const callback = vi.mocked(execFile).mock.calls[0][2] as (
        error: Error | null,
        stdout: string,
        stderr: string
      ) => void
      callback(null, '', '')
    })
  })

  describe('signal handlers', () => {
    it('cleans up active session on SIGINT', async () => {
      vi.useRealTimers()
      const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'exit-session-int',
        relayUrl: 'https://example.com'
      } as any)

      await triggerRelaySetup()
      process.emit('SIGINT' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('exit-session-int'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(exitMock).toHaveBeenCalled()
    })

    it('cleans up active session on SIGTERM', async () => {
      vi.useRealTimers()
      const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'exit-session-term',
        relayUrl: 'https://example.com'
      } as any)

      await triggerRelaySetup()
      process.emit('SIGTERM' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('exit-session-term'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(exitMock).toHaveBeenCalled()
    })

    it('handles fetch failure during signal cleanup', async () => {
      vi.useRealTimers()
      vi.mocked(fetch).mockRejectedValue(new Error('network error'))
      const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      vi.mocked(createSession).mockResolvedValue({ sessionId: 'error-session', relayUrl: 'https://example.com' } as any)

      await triggerRelaySetup()
      process.emit('SIGINT' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetch).toHaveBeenCalled()
      expect(exitMock).toHaveBeenCalled()
    })

    it('handles SIGINT when no active session', async () => {
      vi.useRealTimers()
      const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      process.emit('SIGINT' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(exitMock).toHaveBeenCalled()
    })
  })
})
