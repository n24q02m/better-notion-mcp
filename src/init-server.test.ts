import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startServerMock = vi.fn()

vi.mock('./main.js', () => ({
  startServer: startServerMock
}))

describe('initServer', () => {
  const originalEnv = process.env
  const originalArgv = process.argv

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.argv = [...originalArgv]
    delete process.env.MCP_TRANSPORT
    delete process.env.TRANSPORT_MODE
  })

  afterEach(() => {
    process.env = originalEnv
    process.argv = originalArgv
    vi.unstubAllEnvs()
  })

  it('dispatches http when --http flag is set', async () => {
    process.argv = [process.argv[0], 'main.js', '--http']
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('http')
  })

  it('dispatches http when MCP_TRANSPORT=http', async () => {
    vi.stubEnv('MCP_TRANSPORT', 'http')
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('http')
  })

  it('dispatches http when TRANSPORT_MODE=http', async () => {
    vi.stubEnv('TRANSPORT_MODE', 'http')
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('http')
  })

  it('dispatches stdio by default (post stdio-pure migration)', async () => {
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('stdio')
  })

  it('verifies case-sensitivity for environment variables', async () => {
    vi.stubEnv('MCP_TRANSPORT', 'HTTP')
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('stdio')
  })

  it('verifies exact match for argv flags', async () => {
    process.argv = [process.argv[0], 'main.js', '--http-proxy']
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('stdio')
  })

  it('prioritizes any http trigger over others', async () => {
    // Conflicting: --http is set, but TRANSPORT_MODE=stdio
    process.argv = [process.argv[0], 'main.js', '--http']
    vi.stubEnv('TRANSPORT_MODE', 'stdio')
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('http')
  })

  it('propagates errors from startServer', async () => {
    const testError = new Error('Startup failed')
    startServerMock.mockRejectedValueOnce(testError)

    const { initServer } = await import('./init-server.js')
    await expect(initServer()).rejects.toThrow('Startup failed')
  })
})
