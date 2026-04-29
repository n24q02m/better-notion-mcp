import * as fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrap, getTransportMode, isMain, mode, startServer } from './main.js'

const startHttpMock = vi.fn()

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('@n24q02m/mcp-core/transport', () => ({
  runSmartStdioProxy: vi.fn().mockResolvedValue(0)
}))

// Mock node:fs to allow spying on realpathSync in ESM
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>()
  return {
    ...original,
    realpathSync: vi.fn(original.realpathSync)
  }
})

// Mock process.exit to prevent test runner from exiting
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)

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
      expect(startHttpMock).toHaveBeenCalled()
    })

    it('verifies call to runSmartStdioProxy when mode is stdio', async () => {
      const { runSmartStdioProxy } = await import('@n24q02m/mcp-core/transport')
      await startServer('stdio')
      expect(runSmartStdioProxy).toHaveBeenCalledWith(
        'better-notion-mcp',
        expect.any(Array),
        expect.objectContaining({ env: expect.any(Object) })
      )
      expect(exitSpy).toHaveBeenCalledWith(0)
      expect(startHttpMock).not.toHaveBeenCalled()
    })

    it('verifies call to runSmartStdioProxy when mode is unknown', async () => {
      const { runSmartStdioProxy } = await import('@n24q02m/mcp-core/transport')
      await startServer('unknown')
      expect(runSmartStdioProxy).toHaveBeenCalled()
    })

    it('verifies error propagation from startHttp', async () => {
      startHttpMock.mockRejectedValueOnce(new Error('HTTP failed'))
      await expect(startServer('http')).rejects.toThrow('HTTP failed')
    })

    it('passes RELAY_SCHEMA as eagerRelaySchema to runSmartStdioProxy in stdio mode (D18.2)', async () => {
      const { runSmartStdioProxy } = await import('@n24q02m/mcp-core/transport')
      const spy = vi.mocked(runSmartStdioProxy)
      spy.mockClear()

      await startServer('stdio')

      expect(spy).toHaveBeenCalledOnce()
      const options = spy.mock.calls[0]![2]!
      expect(options.eagerRelaySchema).toBeDefined()
      expect(options.eagerRelaySchema!.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: 'NOTION_TOKEN' })])
      )
    })
  })

  describe('bootstrap and exports', () => {
    it('verifies export of selected mode', () => {
      expect(typeof mode).toBe('string')
    })

    it('verifies execution with default mode', async () => {
      const { runSmartStdioProxy } = await import('@n24q02m/mcp-core/transport')
      await bootstrap()
      expect(runSmartStdioProxy).toHaveBeenCalled()
    })

    it('verifies execution with provided mode', async () => {
      await bootstrap('http')
      expect(startHttpMock).toHaveBeenCalled()
    })

    it('verifies startup errors in bootstrap', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { runSmartStdioProxy } = await import('@n24q02m/mcp-core/transport')
      vi.mocked(runSmartStdioProxy).mockRejectedValueOnce(new Error('Test failure'))

      await bootstrap('stdio')

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start server:', expect.any(Error))
      expect(exitSpy).toHaveBeenCalledWith(1)

      consoleSpy.mockRestore()
    })

    it('verifies initialization of global mode from environment', async () => {
      vi.stubEnv('TRANSPORT_MODE', 'http')
      vi.resetModules()
      const { mode: newMode } = await import('./main.js')
      expect(newMode).toBe('http')
    })
  })
})
