import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startStdioMock = vi.fn()
const startHttpMock = vi.fn()

vi.mock('./transports/stdio.js', () => ({
  startStdio: startStdioMock
}))

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
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

  it('dispatches stdio when --stdio flag is set', async () => {
    process.argv = [process.argv[0], 'main.js', '--stdio']
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startStdioMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('dispatches stdio when MCP_TRANSPORT=stdio', async () => {
    process.env.MCP_TRANSPORT = 'stdio'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startStdioMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('dispatches stdio when TRANSPORT_MODE=stdio', async () => {
    process.env.TRANSPORT_MODE = 'stdio'
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startStdioMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('dispatches http by default', async () => {
    const { initServer } = await import('./init-server.js')
    await initServer()
    expect(startHttpMock).toHaveBeenCalled()
    expect(startStdioMock).not.toHaveBeenCalled()
  })
})
