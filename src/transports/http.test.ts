import * as mcpCore from '@n24q02m/mcp-core'
import { Client } from '@notionhq/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTION_API_VERSION } from '../constants.js'
import { createMCPServer } from '../create-server.js'
import * as credentialState from '../credential-state.js'
import { startHttp, subjectContext } from './http.js'

vi.mock('@n24q02m/mcp-core', () => ({
  runHttpServer: vi.fn(),
  deleteConfig: vi.fn()
}))

const mockTokenStoreInstance = {
  get: vi.fn(),
  save: vi.fn(),
  clear: vi.fn()
}

vi.mock('../auth/notion-token-store.js', () => {
  return {
    NotionTokenStore: class {
      constructor() {
        Object.assign(this, mockTokenStoreInstance)
      }
    }
  }
})

vi.mock('../create-server.js', () => ({
  createMCPServer: vi.fn()
}))

vi.mock('../credential-state.js', () => ({
  resolveCredentialState: vi.fn().mockResolvedValue('configured'),
  setState: vi.fn(),
  setSubjectTokenResolver: vi.fn(),
  getNotionToken: vi.fn().mockReturnValue(null)
}))

vi.mock('@notionhq/client', () => ({
  Client: vi.fn()
}))

describe('startHttp', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      NOTION_OAUTH_CLIENT_ID: 'id',
      NOTION_OAUTH_CLIENT_SECRET: 'secret'
    }
    // Prevent logs during tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('throws error if NOTION_OAUTH_CLIENT_ID is missing', async () => {
    delete process.env.NOTION_OAUTH_CLIENT_ID
    await expect(startHttp()).rejects.toThrow('NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET are required')
  })

  it('throws error if NOTION_OAUTH_CLIENT_SECRET is missing', async () => {
    delete process.env.NOTION_OAUTH_CLIENT_SECRET
    await expect(startHttp()).rejects.toThrow('NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET are required')
  })

  it('starts the server and handles shutdown via SIGINT', async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(mcpCore.runHttpServer).mockResolvedValue({
      host: 'localhost',
      port: 3000,
      close: closeMock
    } as any)

    const handlers: Record<string, (...args: any[]) => any> = {}
    const onceSpy = vi.spyOn(process, 'once').mockImplementation((event, handler) => {
      handlers[event as string] = handler as (...args: any[]) => any
      return process
    })

    const startPromise = startHttp()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(handlers.SIGINT).toBeDefined()
    if (handlers.SIGINT) await handlers.SIGINT()
    await startPromise
    expect(closeMock).toHaveBeenCalled()
    onceSpy.mockRestore()
  })

  it('verifies callbacks and factory', async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(mcpCore.runHttpServer).mockImplementation(async (factory: any) => {
      factory() // Trigger the factory to call createMCPServer
      return {
        host: 'localhost',
        port: 3000,
        close: closeMock
      } as any
    })

    const handlers: Record<string, (...args: any[]) => any> = {}
    vi.spyOn(process, 'once').mockImplementation((event, handler) => {
      handlers[event as string] = handler as (...args: any[]) => any
      return process
    })

    const startPromise = startHttp()
    await new Promise((resolve) => setTimeout(resolve, 50))

    // 1. Verify Notion Client Factory
    expect(createMCPServer).toHaveBeenCalled()
    const factory = vi.mocked(createMCPServer).mock.calls[0][0] as () => Client

    // Test factory without context
    expect(() => factory()).toThrow('Notion access token not present')

    // Test factory with context but no token
    mockTokenStoreInstance.get.mockReturnValue(undefined)
    await subjectContext.run({ sub: 'user1' }, () => {
      expect(() => factory()).toThrow('Notion access token not present')
    })

    // Test factory with context and token
    mockTokenStoreInstance.get.mockReturnValue('test-token')
    await subjectContext.run({ sub: 'user1' }, () => {
      const client = factory()
      expect(client).toBeDefined()
      expect(Client).toHaveBeenCalledWith({ auth: 'test-token', notionVersion: NOTION_API_VERSION })
    })

    // 2. Verify runHttpServer options
    expect(mcpCore.runHttpServer).toHaveBeenCalled()
    const options = vi.mocked(mcpCore.runHttpServer).mock.calls[0][1] as any
    const onTokenReceived = options.delegatedOAuth?.onTokenReceived
    const authScope = options.authScope

    // Test onTokenReceived
    const sub = onTokenReceived!({ access_token: 'new-token', owner_user_id: 'user2' })
    expect(sub).toBe('user2')
    expect(mockTokenStoreInstance.save).toHaveBeenCalledWith('user2', 'new-token')

    // Test authScope
    const next = vi.fn().mockResolvedValue(undefined)
    await authScope!({ sub: 'user3' }, next)
    expect(next).toHaveBeenCalled()

    let capturedSub: string | undefined
    await authScope!({ sub: 'user4' }, async () => {
      capturedSub = subjectContext.getStore()?.sub
    })
    expect(capturedSub).toBe('user4')

    // 3. Verify setSubjectTokenResolver
    expect(credentialState.setSubjectTokenResolver).toHaveBeenCalled()
    const resolver = vi.mocked(credentialState.setSubjectTokenResolver).mock.calls[0][0]

    // Test resolver without context
    expect(resolver()).toBeNull()

    // Test resolver with context and token
    mockTokenStoreInstance.get.mockReturnValue('token-abc')
    await subjectContext.run({ sub: 'user-abc' }, () => {
      expect(resolver()).toBe('token-abc')
      expect(mockTokenStoreInstance.get).toHaveBeenCalledWith('user-abc')
    })

    if (handlers.SIGINT) await handlers.SIGINT()
    await startPromise
  })
})
