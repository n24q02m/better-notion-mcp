import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startHttpMock = vi.fn()
const startStdioMock = vi.fn()

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('./transports/stdio.js', () => ({
  startStdio: startStdioMock
}))

describe('main.ts', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllEnvs()
  })

  describe('getTransportMode', () => {
    it('should default to stdio mode if TRANSPORT_MODE is not set', async () => {
      const { getTransportMode } = await import('./main.js')
      const env = {}
      expect(getTransportMode(env)).toBe('stdio')
    })

    it('should use value from TRANSPORT_MODE if set', async () => {
      const { getTransportMode } = await import('./main.js')
      const env = { TRANSPORT_MODE: 'http' }
      expect(getTransportMode(env)).toBe('http')
    })

    it('should return any value set in TRANSPORT_MODE', async () => {
      const { getTransportMode } = await import('./main.js')
      const env = { TRANSPORT_MODE: 'custom' }
      expect(getTransportMode(env)).toBe('custom')
    })

    it('should use current process.env if no argument is provided', async () => {
      const { getTransportMode } = await import('./main.js')
      vi.stubEnv('TRANSPORT_MODE', 'http')
      expect(getTransportMode()).toBe('http')
    })
  })

  describe('startServer', () => {
    it('should call startHttp when mode is http', async () => {
      const { startServer } = await import('./main.js')
      await startServer('http')
      expect(startHttpMock).toHaveBeenCalled()
      expect(startStdioMock).not.toHaveBeenCalled()
    })

    it('should call startStdio when mode is stdio', async () => {
      const { startServer } = await import('./main.js')
      await startServer('stdio')
      expect(startStdioMock).toHaveBeenCalled()
      expect(startHttpMock).not.toHaveBeenCalled()
    })

    it('should call startStdio when mode is anything else', async () => {
      const { startServer } = await import('./main.js')
      await startServer('invalid')
      expect(startStdioMock).toHaveBeenCalled()
      expect(startHttpMock).not.toHaveBeenCalled()
    })
  })

  describe('bootstrap and exports', () => {
    it('should export the selected mode', async () => {
      const { mode } = await import('./main.js')
      expect(typeof mode).toBe('string')
    })

    it('should skip execution in test mode by default', async () => {
      const { bootstrap } = await import('./main.js')
      await bootstrap()
      expect(startStdioMock).not.toHaveBeenCalled()
      expect(startHttpMock).not.toHaveBeenCalled()
    })

    it('should execute with default mode when isTest is false', async () => {
      const { bootstrap } = await import('./main.js')
      await bootstrap(undefined, false)
      expect(startStdioMock).toHaveBeenCalled()
    })

    it('should execute with provided mode when isTest is false', async () => {
      const { bootstrap } = await import('./main.js')
      await bootstrap('http', false)
      expect(startHttpMock).toHaveBeenCalled()
    })

    it('should handle startup errors in bootstrap', async () => {
      const { bootstrap } = await import('./main.js')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

      startStdioMock.mockRejectedValueOnce(new Error('Test failure'))

      await bootstrap('stdio', false)

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start server:', expect.any(Error))
      expect(exitSpy).toHaveBeenCalledWith(1)

      consoleSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('should correctly initialize global mode from environment', async () => {
      vi.stubEnv('TRANSPORT_MODE', 'http')
      vi.resetModules()
      const { mode: newMode } = await import('./main.js')
      expect(newMode).toBe('http')
    })

    it('should NOT automatically execute bootstrap on module load in test environment', async () => {
      vi.resetModules()
      await import('./main.js')
      expect(startHttpMock).not.toHaveBeenCalled()
      expect(startStdioMock).not.toHaveBeenCalled()
    })

    it('should automatically execute bootstrap on module load if not in test environment', async () => {
      // Mock global side effects to prevent test crash/exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('TRANSPORT_MODE', 'http')
      vi.resetModules()

      await import('./main.js')

      // Wait for the un-awaited bootstrap() call to complete
      // Increased timeout to 100ms for more stable execution in slow environments
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(startHttpMock).toHaveBeenCalled()

      exitSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })
})
