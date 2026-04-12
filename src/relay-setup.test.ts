import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureConfig } from './relay-setup.js'

// Mock mcp-core modules
vi.mock('@n24q02m/mcp-core/storage', () => ({
  resolveConfig: vi.fn()
}))
vi.mock('@n24q02m/mcp-core/relay', () => ({
  createSession: vi.fn(),
  pollForResult: vi.fn(),
  sendMessage: vi.fn()
}))
vi.mock('@n24q02m/mcp-core', () => ({
  writeConfig: vi.fn()
}))

import { writeConfig } from '@n24q02m/mcp-core'
import { createSession, pollForResult, sendMessage } from '@n24q02m/mcp-core/relay'
import { resolveConfig } from '@n24q02m/mcp-core/storage'

describe('ensureConfig', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns token from config file', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({
      config: { NOTION_TOKEN: 'ntn_test_token_123' },
      source: 'file'
    })

    const result = await ensureConfig()

    expect(result).toBe('ntn_test_token_123')
    expect(resolveConfig).toHaveBeenCalledWith('better-notion-mcp', ['NOTION_TOKEN'])
    expect(createSession).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('loaded from file'))
  })

  it('returns token from env source', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({
      config: { NOTION_TOKEN: 'ntn_env_token' },
      source: 'env'
    })

    const result = await ensureConfig()

    expect(result).toBe('ntn_env_token')
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('loaded from env'))
  })

  it('triggers relay when no config found and returns token', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test-session',
      keyPair: {} as any,
      passphrase: 'word1-word2-word3-word4',
      relayUrl: 'https://better-notion-mcp.n24q02m.com/setup?s=test-session#k=key&p=pass'
    })
    vi.mocked(pollForResult).mockResolvedValue({
      NOTION_TOKEN: 'ntn_relay_token_456'
    })
    vi.mocked(sendMessage).mockResolvedValue('msg-123')

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const resultPromise = ensureConfig()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toBe('ntn_relay_token_456')
    expect(createSession).toHaveBeenCalledWith(
      'https://better-notion-mcp.n24q02m.com',
      'better-notion-mcp',
      expect.objectContaining({ server: 'better-notion-mcp' })
    )
    expect(pollForResult).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 2000, 180_000)
    expect(writeConfig).toHaveBeenCalledWith('better-notion-mcp', {
      NOTION_TOKEN: 'ntn_relay_token_456'
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.any(String),
      'test-session',
      expect.objectContaining({ type: 'complete' })
    )

    // Check for DELETE request
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/sessions/test-session'),
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('saved successfully'))
  })

  it('returns null when relay server is unreachable', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockRejectedValue(new Error('Connection refused'))

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot reach relay server'))
  })

  it('logs security warning to stderr during setup', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://test.com'
    })
    vi.mocked(pollForResult).mockResolvedValue({ NOTION_TOKEN: 'test' })

    await ensureConfig()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('temporary setup secrets'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('expire in 3 minutes'))
  })

  it('returns null and cleans up when relay setup times out', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test-session',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://test.com'
    })
    vi.mocked(pollForResult).mockRejectedValue(new Error('Relay setup timed out'))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/sessions/test-session'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('returns null and does NOT double-delete when setup is skipped', async () => {
    // pollForResult already handles DELETE for RELAY_SKIPPED
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test-session',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl: 'https://test.com'
    })
    vi.mocked(pollForResult).mockRejectedValue(new Error('RELAY_SKIPPED'))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('skipped by user'))
    expect(fetchMock).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'DELETE' }))
  })
})
