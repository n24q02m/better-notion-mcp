import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initServer } from './init-server.js'

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: class MockServer {
      connect = vi.fn().mockResolvedValue(undefined)
    }
  }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class MockStdioServerTransport {}
  }
})

vi.mock('./tools/registry.js', () => ({
  registerTools: vi.fn()
}))

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '1.0.0' }))
}))

vi.mock('@notionhq/client', () => ({
  Client: vi.fn()
}))

describe('initServer (delegates to startStdio)', () => {
  const originalEnv = process.env

  const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined) => {
    return undefined as never
  })
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should exit if NOTION_TOKEN is missing', async () => {
    delete process.env.NOTION_TOKEN

    await initServer()

    expect(mockConsoleError).toHaveBeenCalledWith('NOTION_TOKEN environment variable is required')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should initialize server successfully with NOTION_TOKEN', async () => {
    process.env.NOTION_TOKEN = 'secret_token'

    const server = await initServer()

    expect(server.connect).toHaveBeenCalledWith(expect.any(StdioServerTransport))
  })
})
