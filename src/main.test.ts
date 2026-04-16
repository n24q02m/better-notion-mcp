import * as fs from 'node:fs'
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

// Mock node:fs to allow spying on realpathSync in ESM
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return {
    ...original,
    realpathSync: vi.fn(original.realpathSync)
  }
})

describe('main.ts', () => {
  const originalEnv = process.env
  const originalArgv = process.argv
  const originalPlatform = process.platform

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    process.argv = [...originalArgv]
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  })

  afterEach(() => {
    process.env = originalEnv
    process.argv = originalArgv
    vi.unstubAllEnvs()
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  })

  describe('isMain', () => {
    it('verifies true when process.argv[1] matches the file path', () => {
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

    it('verifies Windows path normalization', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      const currentDir = dirname(fileURLToPath(import.meta.url))
      const mainPath = join(currentDir, 'main.ts')
      const mainUrl = pathToFileURL(mainPath).href

      // Mock Windows-style paths
      const winMainPath = 'C:\\project\\src\\main.ts'
      const winEntryPath = 'c:/project/src/main.ts'

      vi.mocked(fs.realpathSync).mockReturnValueOnce(winMainPath).mockReturnValueOnce(winEntryPath)

      process.argv[1] = winEntryPath
      expect(isMain(mainUrl)).toBe(true)
    })

    it('verifies Windows path normalization mismatch', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      const winMainPath = 'C:\\project\\src\\main.ts'
      const winEntryPath = 'C:\\project\\src\\other.ts'

      vi.mocked(fs.realpathSync).mockReturnValueOnce(winMainPath).mockReturnValueOnce(winEntryPath)

      process.argv[1] = winEntryPath
      expect(isMain(import.meta.url)).toBe(false)
    })

    it('verifies false when realpathSync throws', () => {
      process.argv[1] = 'somefile.ts'
      vi.mocked(fs.realpathSync).mockImplementationOnce(() => {
        throw new Error('Not found')
      })

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
      expect(startHttpMock).toHaveBeenCalledTimes(1)
      expect(startHttpMock).toHaveBeenCalledWith()
      expect(startStdioMock).not.toHaveBeenCalled()
    })

    it('verifies call to startStdio when mode is stdio', async () => {
      await startServer('stdio')
      expect(startStdioMock).toHaveBeenCalledTimes(1)
      expect(startStdioMock).toHaveBeenCalledWith()
      expect(startHttpMock).not.toHaveBeenCalled()
    })

    it('verifies call to startStdio when mode is unknown', async () => {
      await startServer('unknown')
      expect(startStdioMock).toHaveBeenCalledTimes(1)
      expect(startStdioMock).toHaveBeenCalledWith()
      expect(startHttpMock).not.toHaveBeenCalled()
    })

    it('verifies call to startStdio when mode is empty string', async () => {
      await startServer('')
      expect(startStdioMock).toHaveBeenCalledTimes(1)
      expect(startStdioMock).toHaveBeenCalledWith()
      expect(startHttpMock).not.toHaveBeenCalled()
    })

    it('verifies error propagation from startHttp', async () => {
      startHttpMock.mockRejectedValueOnce(new Error('HTTP failed'))
      await expect(startServer('http')).rejects.toThrow('HTTP failed')
    })

    it('verifies error propagation from startStdio', async () => {
      startStdioMock.mockRejectedValueOnce(new Error('Stdio failed'))
      await expect(startServer('stdio')).rejects.toThrow('Stdio failed')
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

    it('verifies bootstrap execution when not in test environment', async () => {
      startStdioMock.mockResolvedValue(undefined)

      const currentDir = dirname(fileURLToPath(import.meta.url))
      const mainPath = join(currentDir, 'main.ts')
      process.argv[1] = mainPath
      vi.stubEnv('NODE_ENV', 'production')

      vi.mocked(fs.realpathSync).mockReturnValue(mainPath)

      vi.resetModules()
      await import('./main.js')

      // Wait for async bootstrap
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1))
        if (startStdioMock.mock.calls.length > 0) break
      }

      expect(startStdioMock).toHaveBeenCalled()
    })
  })
})
