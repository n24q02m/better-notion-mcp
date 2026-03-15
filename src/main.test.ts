import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockStartHttp = vi.fn()
const mockStartStdio = vi.fn()

vi.mock('./transports/http.js', () => ({
  startHttp: mockStartHttp
}))

vi.mock('./transports/stdio.js', () => ({
  startStdio: mockStartStdio
}))

describe('main.ts', () => {
  const originalEnv = process.env.TRANSPORT_MODE

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TRANSPORT_MODE
    } else {
      process.env.TRANSPORT_MODE = originalEnv
    }
  })

  it('should default to stdio and call startStdio when TRANSPORT_MODE is not set', async () => {
    delete process.env.TRANSPORT_MODE
    const main = await import('./main.js')

    expect(main.mode).toBe('stdio')
    expect(mockStartStdio).toHaveBeenCalledOnce()
    expect(mockStartHttp).not.toHaveBeenCalled()
  })

  it('should use http mode and call startHttp when TRANSPORT_MODE is "http"', async () => {
    process.env.TRANSPORT_MODE = 'http'
    const main = await import('./main.js')

    expect(main.mode).toBe('http')
    expect(mockStartHttp).toHaveBeenCalledOnce()
    expect(mockStartStdio).not.toHaveBeenCalled()
  })

  it('should use stdio mode and call startStdio when TRANSPORT_MODE is "stdio"', async () => {
    process.env.TRANSPORT_MODE = 'stdio'
    const main = await import('./main.js')

    expect(main.mode).toBe('stdio')
    expect(mockStartStdio).toHaveBeenCalledOnce()
    expect(mockStartHttp).not.toHaveBeenCalled()
  })
})
