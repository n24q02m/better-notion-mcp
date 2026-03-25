import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureConfig } from './relay-setup.js'

// Mock mcp-relay-core modules
vi.mock('@n24q02m/mcp-relay-core/storage', () => ({
  resolveConfig: vi.fn()
}))
vi.mock('@n24q02m/mcp-relay-core/relay', () => ({
  createSession: vi.fn(),
  pollForResult: vi.fn()
}))
vi.mock('@n24q02m/mcp-relay-core', () => ({
  writeConfig: vi.fn()
}))

import { writeConfig } from '@n24q02m/mcp-relay-core'
import { createSession, pollForResult } from '@n24q02m/mcp-relay-core/relay'
import { resolveConfig } from '@n24q02m/mcp-relay-core/storage'

describe('ensureConfig', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

    const result = await ensureConfig()

    expect(result).toBe('ntn_relay_token_456')
    expect(createSession).toHaveBeenCalledWith(
      'https://better-notion-mcp.n24q02m.com',
      'better-notion-mcp',
      expect.objectContaining({ server: 'better-notion-mcp' })
    )
    expect(writeConfig).toHaveBeenCalledWith('better-notion-mcp', {
      NOTION_TOKEN: 'ntn_relay_token_456'
    })
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('saved successfully'))
  })

  it('returns null when relay server is unreachable', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockRejectedValue(new Error('Connection refused'))

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot reach relay server'))
  })

  it('returns null when relay setup times out', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'test-session',
      keyPair: {} as any,
      passphrase: 'word1-word2-word3-word4',
      relayUrl: 'https://better-notion-mcp.n24q02m.com/setup?s=test'
    })
    vi.mocked(pollForResult).mockRejectedValue(new Error('Relay setup timed out'))

    const result = await ensureConfig()

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'))
  })

  it('logs relay URL to stderr for user visibility', async () => {
    vi.mocked(resolveConfig).mockResolvedValue({ config: null, source: null })
    const relayUrl = 'https://better-notion-mcp.n24q02m.com/setup?s=abc#k=key&p=pass'
    vi.mocked(createSession).mockResolvedValue({
      sessionId: 'abc',
      keyPair: {} as any,
      passphrase: 'test',
      relayUrl
    })
    vi.mocked(pollForResult).mockResolvedValue({
      NOTION_TOKEN: 'ntn_test'
    })

    await ensureConfig()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(relayUrl))
  })
})
