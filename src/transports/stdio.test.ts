import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before imports
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn()
}))

vi.mock('@notionhq/client', () => ({
  Client: vi.fn()
}))

vi.mock('../create-server.js', () => ({
  createMCPServer: vi.fn(() => ({ connect: vi.fn() }))
}))

vi.mock('../relay-setup.js', () => ({
  ensureConfig: vi.fn()
}))

vi.mock('../tools/helpers/errors.js', () => ({
  NotionMCPError: class NotionMCPError extends Error {
    code: string
    suggestion?: string
    constructor(message: string, code: string, suggestion?: string) {
      super(message)
      this.name = 'NotionMCPError'
      this.code = code
      this.suggestion = suggestion
    }
  }
}))

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '2.22.0' }))
}))

vi.mock('../tools/registry.js', () => ({
  registerTools: vi.fn()
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class MockServer {
    connect = vi.fn()
  }
}))

import { createMCPServer } from '../create-server.js'
import { ensureConfig } from '../relay-setup.js'

describe('startStdio', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    // Remove NOTION_TOKEN by default
    delete process.env.NOTION_TOKEN
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it('should use NOTION_TOKEN from env when available', async () => {
    process.env.NOTION_TOKEN = 'ntn_test_token'
    const { startStdio } = await import('./stdio.js')

    const server = await startStdio()

    expect(server).toBeDefined()
    expect(ensureConfig).not.toHaveBeenCalled()
    expect(createMCPServer).toHaveBeenCalledWith(expect.any(Function))

    // Call the factory to verify it returns a Client (singleton)
    const factory = vi.mocked(createMCPServer).mock.calls[0][0]
    const client1 = factory()
    const client2 = factory()
    expect(client1).toBeDefined()
    expect(client1).toBe(client2)

    const { Client } = await import('@notionhq/client')
    expect(Client).toHaveBeenCalledWith({
      auth: 'ntn_test_token',
      notionVersion: '2025-09-03'
    })
  })

  it('should use relay token when NOTION_TOKEN is not set', async () => {
    vi.mocked(ensureConfig).mockResolvedValue('ntn_relay_token')
    const { startStdio } = await import('./stdio.js')

    const server = await startStdio()

    expect(server).toBeDefined()
    expect(ensureConfig).toHaveBeenCalled()
    expect(createMCPServer).toHaveBeenCalledWith(expect.any(Function))

    // Call the factory — should return a Client with the relay token
    const factory = vi.mocked(createMCPServer).mock.calls[0][0]
    const client1 = factory()
    const client2 = factory()
    expect(client1).toBeDefined()
    expect(client1).toBe(client2)

    const { Client } = await import('@notionhq/client')
    expect(Client).toHaveBeenCalledWith({
      auth: 'ntn_relay_token',
      notionVersion: '2025-09-03'
    })
  })

  it('should create degraded factory when no token is available', async () => {
    vi.mocked(ensureConfig).mockResolvedValue(null)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { startStdio } = await import('./stdio.js')

    const server = await startStdio()

    expect(server).toBeDefined()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOTION_TOKEN not set'))
    expect(createMCPServer).toHaveBeenCalledWith(expect.any(Function))

    // Call the factory — should throw NotionMCPError
    const factory = vi.mocked(createMCPServer).mock.calls[0][0]
    expect(() => factory()).toThrow('NOTION_TOKEN environment variable is not set')

    consoleSpy.mockRestore()
  })

  it('should skip relay when NOTION_TOKEN is already set', async () => {
    process.env.NOTION_TOKEN = 'ntn_env_token'
    const { startStdio } = await import('./stdio.js')

    await startStdio()

    // ensureConfig should not be called when env var is present
    expect(ensureConfig).not.toHaveBeenCalled()
  })
})
