import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startHttpMock = vi.fn()
const startStdioMock = vi.fn()

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('./transports/stdio.js', () => ({
  startStdio: startStdioMock
}))

describe('main.ts entry point', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should default to stdio mode if TRANSPORT_MODE is not set', async () => {
    delete process.env.TRANSPORT_MODE
    const main = await import('./main.js')

    expect(main.mode).toBe('stdio')
    expect(startStdioMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })

  it('should use http mode if TRANSPORT_MODE is http', async () => {
    process.env.TRANSPORT_MODE = 'http'
    const main = await import('./main.js')

    expect(main.mode).toBe('http')
    expect(startHttpMock).toHaveBeenCalled()
    expect(startStdioMock).not.toHaveBeenCalled()
  })

  it('should use stdio mode if TRANSPORT_MODE is something else', async () => {
    process.env.TRANSPORT_MODE = 'invalid'
    const main = await import('./main.js')

    expect(main.mode).toBe('invalid')
    expect(startStdioMock).toHaveBeenCalled()
    expect(startHttpMock).not.toHaveBeenCalled()
  })
})
