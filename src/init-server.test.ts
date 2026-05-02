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
  })

  it('dispatches http when --http flag is set', async () => {
    process.argv = [process.argv[0], 'main.js', '--http']
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('http')
  })

  it('dispatches http when MCP_TRANSPORT=http', async () => {
    process.env.MCP_TRANSPORT = 'http'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('http')
  })

  it('dispatches http when TRANSPORT_MODE=http', async () => {
    process.env.TRANSPORT_MODE = 'http'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('http')
  })

  it('dispatches stdio by default (post stdio-pure migration)', async () => {
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startServerMock).toHaveBeenCalledWith('stdio')
  })
})
