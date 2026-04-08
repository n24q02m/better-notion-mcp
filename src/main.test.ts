import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrap, getTransportMode, isMain, mode, startServer } from './main.js'

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
  const originalArgv = process.argv

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    process.argv = [...originalArgv]
  })

  afterEach(() => {
    process.env = originalEnv
    process.argv = originalArgv
    vi.unstubAllEnvs()
  })

  describe('isMain', () => {
    it('verifies true when process.argv[1] matches the file path', () => {
      // Get the absolute path to src/main.ts
      const currentDir = dirname(fileURLToPath(import.meta.url))
      const mainPath = join(currentDir, 'main.ts')
      const mainUrl = pathToFileURL(mainPath).href

      process.argv[1] = mainPath
      expect(isMain(mainUrl)).toBe(true)
    })

    it('verifies false when process.argv[1] does not match', () => {
      process.argv[1] = '/some/other/file.js'
      expect(isMain(import.meta.url)).toBe(false)
    })

    it('verifies false when process.argv[1] is undefined', () => {
      process.argv = [process.argv[0]]
      expect(isMain(import.meta.url)).toBe(false)
    })
  })

  describe('getTransportMode', () => {
    it('verifies default to stdio mode if TRANSPORT_MODE is not set', () => {
      const env = {}
      expect(getTransportMode(env)).toBe('stdio')
    })

    it('verifies value from TRANSPORT_MODE if set', () => {
      const env = { TRANSPORT_MODE: 'http' }
      expect(getTransportMode(env)).toBe('http')
    })

    it('verifies current process.env if no argument is provided', () => {
      vi.stubEnv('TRANSPORT_MODE', 'http')
      expect(getTransportMode()).toBe('http')
    })
  })

  describe('startServer', () => {
    it('verifies call to startHttp when mode is http', async () => {
      await startServer('http')
      expect(startHttpMock).toHaveBeenCalled()
      expect(startStdioMock).not.toHaveBeenCalled()
    })

    it('verifies call to startStdio when mode is stdio', async () => {
      await startServer('stdio')
      expect(startStdioMock).toHaveBeenCalled()
      expect(startHttpMock).not.toHaveBeenCalled()
    })
  })

  describe('bootstrap and exports', () => {
    it('verifies export of selected mode', () => {
      expect(typeof mode).toBe('string')
    })

    it('verifies execution with default mode', async () => {
      await bootstrap()
      expect(startStdioMock).toHaveBeenCalled()
    })

    it('verifies execution with provided mode', async () => {
      await bootstrap('http')
      expect(startHttpMock).toHaveBeenCalled()
    })

    it('verifies startup errors in bootstrap', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

      startStdioMock.mockRejectedValueOnce(new Error('Test failure'))

      await bootstrap('stdio')

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start server:', expect.any(Error))
      expect(exitSpy).toHaveBeenCalledWith(1)

      consoleSpy.mockRestore()
      exitSpy.mockRestore()
    })

    it('verifies initialization of global mode from environment', async () => {
      vi.stubEnv('TRANSPORT_MODE', 'http')
      vi.resetModules()
      const { mode: newMode } = await import('./main.js')
      expect(newMode).toBe('http')
    })
  })
})
