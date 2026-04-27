/**
 * Tests for credential state management.
 */

import { execFile } from 'node:child_process'
import { deleteConfig, runLocalServer, writeConfig } from '@n24q02m/mcp-core'
import { resolveConfig } from '@n24q02m/mcp-core/storage'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getNotionToken,
  getSetupUrl,
  getState,
  getSubjectToken,
  resetState,
  resolveCredentialState,
  setState,
  setSubjectTokenResolver,
  triggerRelaySetup
} from './credential-state.js'

vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}))

vi.mock('@n24q02m/mcp-core', () => ({
  deleteConfig: vi.fn(),
  runLocalServer: vi.fn(),
  writeConfig: vi.fn()
}))

vi.mock('@n24q02m/mcp-core/storage', () => ({
  resolveConfig: vi.fn()
}))

function makeHandle(overrides: Partial<{ host: string; port: number; close: () => Promise<void> }> = {}) {
  return {
    host: overrides.host ?? '127.0.0.1',
    port: overrides.port ?? 54321,
    close: overrides.close ?? (() => Promise.resolve())
  }
}

describe('credential-state', () => {
  let consoleSpy: any

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(deleteConfig).mockResolvedValue(undefined as any)
    vi.mocked(writeConfig).mockResolvedValue(undefined as any)
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })

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
    it('returns null when spawning the local server fails', async () => {
      vi.mocked(runLocalServer).mockRejectedValue(new Error('cannot bind'))
      const url = await triggerRelaySetup()
      expect(url).toBeNull()
      expect(getState()).toBe('awaiting_setup')
    })

    it('spawns a local HTTP server and returns its URL', async () => {
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ port: 55123 }) as any)

      const url = await triggerRelaySetup()

      expect(url).toBe('http://127.0.0.1:55123/')
      expect(getSetupUrl()).toBe('http://127.0.0.1:55123/')
      expect(getState()).toBe('setup_in_progress')
      expect(execFile).toHaveBeenCalled() // tryOpenBrowser

      const call = vi.mocked(runLocalServer).mock.calls[0]
      const options = call[1]
      expect(options.port).toBe(0)
      expect(options.host).toBe('127.0.0.1')
      expect(options.serverName).toBe('better-notion-mcp')
      expect(options.relaySchema).toBeDefined()
    })

    it('persists the token and transitions to configured on form submit', async () => {
      const closeMock = vi.fn().mockResolvedValue(undefined)
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ close: closeMock }) as any)

      await triggerRelaySetup()

      const onCredentialsSaved = vi.mocked(runLocalServer).mock.calls[0][1].onCredentialsSaved as (
        creds: Record<string, string>
      ) => Promise<unknown>
      await onCredentialsSaved({ NOTION_TOKEN: 'relay-token' })

      expect(getState()).toBe('configured')
      expect(getNotionToken()).toBe('relay-token')
      expect(writeConfig).toHaveBeenCalledWith('better-notion-mcp', { NOTION_TOKEN: 'relay-token' })

      // Grace timer should close the spawn without blocking the caller.
      await vi.advanceTimersByTimeAsync(5_000)
      expect(closeMock).toHaveBeenCalled()
    })

    it('returns the current URL if already setup_in_progress', async () => {
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ port: 60000 }) as any)
      const first = await triggerRelaySetup()
      const second = await triggerRelaySetup()
      expect(second).toBe(first)
      expect(runLocalServer).toHaveBeenCalledTimes(1)
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

    it('closes any active local handle', async () => {
      const closeMock = vi.fn().mockResolvedValue(undefined)
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ close: closeMock }) as any)
      await triggerRelaySetup()
      resetState()
      expect(closeMock).toHaveBeenCalled()
    })
  })

  describe('tryOpenBrowser', () => {
    it('calls open on darwin', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ port: 7001 }) as any)

      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('open', ['http://127.0.0.1:7001/'], expect.any(Function))
    })

    it('calls rundll32 on win32', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ port: 7002 }) as any)

      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith(
        'rundll32',
        ['url.dll,FileProtocolHandler', 'http://127.0.0.1:7002/'],
        expect.any(Function)
      )
    })

    it('calls xdg-open on other platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ port: 7003 }) as any)

      await triggerRelaySetup()

      expect(execFile).toHaveBeenCalledWith('xdg-open', ['http://127.0.0.1:7003/'], expect.any(Function))
    })
  })

  describe('signal handlers', () => {
    it('closes the active spawn on SIGINT', async () => {
      vi.useRealTimers()
      const closeMock = vi.fn().mockResolvedValue(undefined)
      const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      vi.mocked(runLocalServer).mockResolvedValue(makeHandle({ close: closeMock }) as any)

      await triggerRelaySetup()
      process.emit('SIGINT' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(closeMock).toHaveBeenCalled()
      expect(exitMock).toHaveBeenCalled()
    })

    it('handles SIGINT when no active spawn', async () => {
      vi.useRealTimers()
      const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      process.emit('SIGINT' as any)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(exitMock).toHaveBeenCalled()
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
