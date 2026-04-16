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
  deleteConfig: vi.fn().mockResolvedValue(undefined),
  pollForResult: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue(undefined),
  writeConfig: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@n24q02m/mcp-core/storage', () => ({
  resolveConfig: vi.fn()
}))

describe('credential-state', () => {
  let consoleSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    resetState()
    delete process.env.NOTION_TOKEN
    delete process.env.MCP_RELAY_URL
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
      vi.mocked(resolveConfig).mockResolvedValue({
        config: null,
        source: null
      })
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
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      const url = await triggerRelaySetup()

      expect(url).toBe(mockSession.relayUrl)
      expect(getSetupUrl()).toBe(mockSession.relayUrl)
      expect(getState()).toBe('setup_in_progress')
      expect(execFile).toHaveBeenCalled() // tryOpenBrowser

      // Wait for polling and background tasks
      await vi.runAllTimersAsync()

      expect(getState()).toBe('configured')
      expect(getNotionToken()).toBe('relay-token')
      expect(writeConfig).toHaveBeenCalledWith('better-notion-mcp', { NOTION_TOKEN: 'relay-token' })
      expect(sendMessage).toHaveBeenCalled()
      // Check for DELETE request
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('session-123'),
        expect.objectContaining({ method: 'DELETE' })
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
  })

  describe('error handling in pollRelayBackground', () => {
    it('handles RELAY_SKIPPED', async () => {
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 's1',
        relayUrl: 'u1'
      } as any)
      vi.mocked(pollForResult).mockRejectedValue(new Error('RELAY_SKIPPED'))
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await triggerRelaySetup()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('awaiting_setup')
      expect(fetchMock).not.toHaveBeenCalled() // No DELETE for RELAY_SKIPPED according to code
    })

    it('handles timeout/other errors and cleans up', async () => {
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 's1',
        relayUrl: 'u1'
      } as any)
      vi.mocked(pollForResult).mockRejectedValue(new Error('timeout'))
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await triggerRelaySetup()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('awaiting_setup')
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'DELETE' }))
    })

    it('handles fetch failure during cleanup', async () => {
      vi.mocked(createSession).mockResolvedValue({
        sessionId: 's1',
        relayUrl: 'u1'
      } as any)
      vi.mocked(pollForResult).mockResolvedValue({ NOTION_TOKEN: 'token' })
      const fetchMock = vi.fn().mockRejectedValue(new Error('fetch error'))
      vi.stubGlobal('fetch', fetchMock)

      await triggerRelaySetup()
      await vi.runAllTimersAsync()

      expect(getState()).toBe('configured')
      // No crash, fetch error ignored
    })
  })

  describe('tryOpenBrowser', () => {
    it('calls open on darwin', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      vi.mocked(createSession).mockResolvedValue({ relayUrl: 'https://relay.com/url' } as any)
      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('open', ['https://relay.com/url'], expect.any(Function))
      // Trigger callback for coverage
      const callback = vi.mocked(execFile).mock.calls[0][2] as (
        error: Error | null,
        stdout: string,
        stderr: string
      ) => void
      callback(null, '', '')

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('calls cmd on win32', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      vi.mocked(createSession).mockResolvedValue({ relayUrl: 'https://relay.com/url' } as any)
      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('cmd', ['/c', 'start', '', 'https://relay.com/url'], expect.any(Function))
      // Trigger callback for coverage
      const callback = vi.mocked(execFile).mock.calls[0][2] as (
        error: Error | null,
        stdout: string,
        stderr: string
      ) => void
      callback(null, '', '')

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('calls xdg-open on other platforms', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      vi.mocked(createSession).mockResolvedValue({ relayUrl: 'https://relay.com/url' } as any)
      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('xdg-open', ['https://relay.com/url'], expect.any(Function))
      // Trigger callback for coverage
      const callback = vi.mocked(execFile).mock.calls[0][2] as (
        error: Error | null,
        stdout: string,
        stderr: string
      ) => void
      callback(null, '', '')

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })
  })

  describe('signal handlers', () => {
    it('cleans up active session on SIGINT', async () => {
      vi.useRealTimers()
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
        return undefined as never
      })

      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'exit-session-int',
        relayUrl: 'https://relay.com/setup'
      } as any)
      await triggerRelaySetup()

      process.emit('SIGINT' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('exit-session-int'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(exitMock).toHaveBeenCalled()
    })

    it('cleans up active session on SIGTERM', async () => {
      vi.useRealTimers()
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
        return undefined as never
      })

      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'exit-session-term',
        relayUrl: 'https://relay.com/setup'
      } as any)
      await triggerRelaySetup()

      process.emit('SIGTERM' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('exit-session-term'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(exitMock).toHaveBeenCalled()
    })

    it('handles fetch failure during signal cleanup', async () => {
      vi.useRealTimers()
      const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
      vi.stubGlobal('fetch', fetchMock)
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
        return undefined as never
      })

      vi.mocked(createSession).mockResolvedValue({
        sessionId: 'error-session',
        relayUrl: 'https://relay.com/setup'
      } as any)
      await triggerRelaySetup()

      process.emit('SIGINT' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(fetchMock).toHaveBeenCalled()
      expect(exitMock).toHaveBeenCalled()
    })
  })
})
