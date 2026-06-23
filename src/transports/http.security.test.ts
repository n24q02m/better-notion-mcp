import * as mcpCore from '@n24q02m/mcp-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startHttp, subjectContext } from './http.js'

vi.mock('@n24q02m/mcp-core', async () => {
  const actual = (await vi.importActual('@n24q02m/mcp-core')) as any
  return {
    ...actual,
    runHttpServer: vi.fn(),
    backendFromEnv: vi.fn(),
    CfKvBackend: vi.fn(),
    PerPluginStore: vi.fn()
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

describe('HTTP Transport Security - MCP_AUTH_DISABLE Removal', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      NOTION_OAUTH_CLIENT_ID: 'test-id',
      NOTION_OAUTH_CLIENT_SECRET: 'test-secret',
      MCP_AUTH_DISABLE: '1'
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('FIX VERIFIED: MCP_AUTH_DISABLE no longer enables anonymous access', async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(mcpCore.runHttpServer).mockResolvedValue({
      host: 'localhost',
      port: 3000,
      close: closeMock
    } as any)

    const handlers: Record<string, (...args: any[]) => any> = {}
    vi.spyOn(process, 'once').mockImplementation((event, handler) => {
      handlers[event as string] = handler as (...args: any[]) => any
      return process
    })

    const startPromise = startHttp()
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Check that authDisabled is hardcoded to false regardless of env
    expect(mcpCore.runHttpServer).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        authDisabled: false
      })
    )

    const options = vi.mocked(mcpCore.runHttpServer).mock.calls[0][1] as any
    const authScope = options.authScope

    // Check that anonymous claim is ignored in authScope
    let capturedSub: string | undefined
    await authScope({ anonymous: true }, async () => {
      capturedSub = subjectContext.getStore()?.sub
    })

    expect(capturedSub).toBe('default')

    if (handlers.SIGINT) await handlers.SIGINT()
    await startPromise
  })
})
