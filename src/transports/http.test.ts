import * as mcpCore from '@n24q02m/mcp-core'
import { Client } from '@notionhq/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMCPServer } from '../create-server.js'
import * as credentialState from '../credential-state.js'
import { deriveSubject, startHttp, subjectContext } from './http.js'

vi.mock('@n24q02m/mcp-core', () => ({
  runHttpServer: vi.fn(),
  deleteConfig: vi.fn()
}))

const mockTokenStoreInstance: {
  get: any
  save: any
  clear: any
} = {
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
  // A real copy, not a reference -- `process.env` is a live mutable object, so
  // `const originalEnv = process.env` would alias it: a test setting
  // `process.env.PORT` mutates this "original" too, leaking into every later
  // test's `{...originalEnv, ...}` reset below.
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      NOTION_OAUTH_CLIENT_ID: 'id',
      NOTION_OAUTH_CLIENT_SECRET: 'secret',
      PORT: undefined,
      HOST: undefined,
      MCP_AUTH_DISABLE: undefined
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

  describe('BYO OAuth client CLI flags', () => {
    const originalArgv = process.argv

    afterEach(() => {
      process.argv = originalArgv
    })

    it('accepts --oauth-client-id/--oauth-client-secret when env vars are absent', async () => {
      delete process.env.NOTION_OAUTH_CLIENT_ID
      delete process.env.NOTION_OAUTH_CLIENT_SECRET
      process.argv = [...originalArgv, '--http', '--oauth-client-id=flag-id', '--oauth-client-secret=flag-secret']

      vi.mocked(mcpCore.runHttpServer).mockResolvedValue({
        host: 'localhost',
        port: 3000,
        close: vi.fn().mockResolvedValue(undefined)
      } as any)
      const handlers: Record<string, (...args: any[]) => any> = {}
      vi.spyOn(process, 'once').mockImplementation((event, handler) => {
        handlers[event as string] = handler as (...args: any[]) => any
        return process
      })

      const startPromise = startHttp()
      await new Promise((resolve) => setTimeout(resolve, 50))

      const options = vi.mocked(mcpCore.runHttpServer).mock.calls[0][1] as any
      expect(options.delegatedOAuth?.upstream?.clientId).toBe('flag-id')
      expect(options.delegatedOAuth?.upstream?.clientSecret).toBe('flag-secret')

      if (handlers.SIGINT) await handlers.SIGINT()
      await startPromise
    })

    it('flag overrides env var when both are present', async () => {
      // env vars from beforeEach ('id' / 'secret') are already set.
      process.argv = [...originalArgv, '--http', '--oauth-client-id=flag-id', '--oauth-client-secret=flag-secret']

      vi.mocked(mcpCore.runHttpServer).mockResolvedValue({
        host: 'localhost',
        port: 3000,
        close: vi.fn().mockResolvedValue(undefined)
      } as any)
      const handlers: Record<string, (...args: any[]) => any> = {}
      vi.spyOn(process, 'once').mockImplementation((event, handler) => {
        handlers[event as string] = handler as (...args: any[]) => any
        return process
      })

      const startPromise = startHttp()
      await new Promise((resolve) => setTimeout(resolve, 50))

      const options = vi.mocked(mcpCore.runHttpServer).mock.calls[0][1] as any
      expect(options.delegatedOAuth?.upstream?.clientId).toBe('flag-id')
      expect(options.delegatedOAuth?.upstream?.clientSecret).toBe('flag-secret')

      if (handlers.SIGINT) await handlers.SIGINT()
      await startPromise
    })
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

  it('handles shutdown via SIGTERM', async () => {
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

    expect(handlers.SIGTERM).toBeDefined()
    if (handlers.SIGTERM) await handlers.SIGTERM()
    await startPromise
    expect(closeMock).toHaveBeenCalled()
    onceSpy.mockRestore()
  })

  it('uses PORT and HOST environment variables', async () => {
    process.env.PORT = '8080'
    process.env.HOST = '0.0.0.0'

    vi.mocked(mcpCore.runHttpServer).mockResolvedValue({
      host: '0.0.0.0',
      port: 8080,
      close: vi.fn().mockResolvedValue(undefined)
    } as any)

    const handlers: Record<string, (...args: any[]) => any> = {}
    vi.spyOn(process, 'once').mockImplementation((event, handler) => {
      handlers[event as string] = handler as (...args: any[]) => any
      return process
    })

    const startPromise = startHttp()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mcpCore.runHttpServer).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        port: 8080,
        host: '0.0.0.0'
      })
    )

    if (handlers.SIGINT) await handlers.SIGINT()
    await startPromise
  })

  it('uses MCP_AUTH_DISABLE environment variable', async () => {
    process.env.MCP_AUTH_DISABLE = '1'

    vi.mocked(mcpCore.runHttpServer).mockResolvedValue({
      host: 'localhost',
      port: 3000,
      close: vi.fn().mockResolvedValue(undefined)
    } as any)

    const handlers: Record<string, (...args: any[]) => any> = {}
    vi.spyOn(process, 'once').mockImplementation((event, handler) => {
      handlers[event as string] = handler as (...args: any[]) => any
      return process
    })

    const startPromise = startHttp()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mcpCore.runHttpServer).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        authDisabled: true
      })
    )

    if (handlers.SIGINT) await handlers.SIGINT()
    await startPromise
  })

  it('leaves sessionKv undefined (mcp-core in-memory session store)', async () => {
    vi.mocked(mcpCore.runHttpServer).mockResolvedValue({
      host: 'localhost',
      port: 3000,
      close: vi.fn().mockResolvedValue(undefined)
    } as any)

    const handlers: Record<string, (...args: any[]) => any> = {}
    vi.spyOn(process, 'once').mockImplementation((event, handler) => {
      handlers[event as string] = handler as (...args: any[]) => any
      return process
    })

    const startPromise = startHttp()
    await new Promise((resolve) => setTimeout(resolve, 50))

    const options = vi.mocked(mcpCore.runHttpServer).mock.calls[0][1] as any
    expect(options.delegatedOAuth?.sessionKv).toBeUndefined()

    if (handlers.SIGINT) await handlers.SIGINT()
    await startPromise
  })

  it('verifies callbacks and factory with edge cases', async () => {
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
      expect(Client).toHaveBeenCalledWith({ auth: 'test-token', notionVersion: '2025-09-03' })
    })

    // 2. Verify runHttpServer options
    expect(mcpCore.runHttpServer).toHaveBeenCalled()
    const options = vi.mocked(mcpCore.runHttpServer).mock.calls[0][1] as any
    expect(options.serverName).toBe('notion')
    const onTokenReceived = options.delegatedOAuth?.onTokenReceived
    const authScope = options.authScope

    // Test onTokenReceived - success. Notion's token response identifies the
    // user by owner.user.id (NOT owner_user_id), so the derived sub is that id.
    const sub = await onTokenReceived!({ access_token: 'new-token', owner: { user: { id: 'user2' } } })
    expect(sub).toBe('user2')
    expect(mockTokenStoreInstance.save).toHaveBeenCalledWith('user2', 'new-token')

    // Test onTokenReceived - missing access_token (should not save)
    mockTokenStoreInstance.save.mockClear()
    const sub2 = await onTokenReceived!({ owner: { user: { id: 'user3' } } })
    expect(sub2).toBe('user3')
    expect(mockTokenStoreInstance.save).not.toHaveBeenCalled()

    // Test onTokenReceived - no owner: fall back to workspace_id, then bot_id.
    const sub3 = await onTokenReceived!({ access_token: 'token-3', workspace_id: 'ws-9' })
    expect(sub3).toBe('ws-9')
    expect(mockTokenStoreInstance.save).toHaveBeenCalledWith('ws-9', 'token-3')

    // Test onTokenReceived - malformed (no identity field) -> 'default'
    mockTokenStoreInstance.save.mockClear()
    const sub3b = await onTokenReceived!({ access_token: 'token-4' })
    expect(sub3b).toBe('default')
    expect(mockTokenStoreInstance.save).toHaveBeenCalledWith('default', 'token-4')

    // Test authScope - normal
    const next = vi.fn().mockResolvedValue(undefined)
    await authScope!({ sub: 'user3' }, next)
    expect(next).toHaveBeenCalled()

    // Test authScope - captured sub
    let capturedSub: string | undefined
    await authScope!({ sub: 'user4' }, async () => {
      capturedSub = subjectContext.getStore()?.sub
    })
    expect(capturedSub).toBe('user4')

    // Test authScope - anonymous
    await authScope!({ anonymous: true }, async () => {
      capturedSub = subjectContext.getStore()?.sub
    })
    expect(capturedSub).toBe('default')

    // Test authScope - invalid sub type
    await authScope!({ sub: 123 }, async () => {
      capturedSub = subjectContext.getStore()?.sub
    })
    expect(capturedSub).toBe('default')

    // Test authScope - missing sub
    await authScope!({}, async () => {
      capturedSub = subjectContext.getStore()?.sub
    })
    expect(capturedSub).toBe('default')

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

    // Test resolver with context but NO token in store
    mockTokenStoreInstance.get.mockReturnValue(undefined)
    await subjectContext.run({ sub: 'user-no-token' }, () => {
      expect(resolver()).toBeNull()
    })

    if (handlers.SIGINT) await handlers.SIGINT()
    await startPromise
  })
})

describe('deriveSubject', () => {
  it('returns user id if present', () => {
    const tokens = { owner: { user: { id: 'user-123' } } }
    expect(deriveSubject(tokens)).toBe('user-123')
  })

  it('returns workspace id if user id is missing', () => {
    const tokens = { workspace_id: 'ws-123' }
    expect(deriveSubject(tokens)).toBe('ws-123')
  })

  it('returns bot id if user and workspace ids are missing', () => {
    const tokens = { bot_id: 'bot-123' }
    expect(deriveSubject(tokens)).toBe('bot-123')
  })

  it('returns "default" if all ids are missing', () => {
    const tokens = {}
    expect(deriveSubject(tokens)).toBe('default')
  })

  it('returns "default" if user id is not a string', () => {
    const tokens = { owner: { user: { id: 123 } } }
    expect(deriveSubject(tokens)).toBe('default')
  })

  it('returns "default" if user id is an empty string', () => {
    const tokens = { owner: { user: { id: '' } } }
    expect(deriveSubject(tokens)).toBe('default')
  })

  it('falls back to workspace_id if user id is invalid', () => {
    const tokens = { owner: { user: { id: '' } }, workspace_id: 'ws-123' }
    expect(deriveSubject(tokens)).toBe('ws-123')
  })

  it('falls back to bot_id if user and workspace ids are invalid', () => {
    const tokens = {
      owner: { user: { id: null } },
      workspace_id: '',
      bot_id: 'bot-123'
    }
    expect(deriveSubject(tokens)).toBe('bot-123')
  })
})
