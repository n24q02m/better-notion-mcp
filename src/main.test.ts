import * as fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrap, getTransportMode, isMain, mode, startServer } from './main.js'

const startHttpMock = vi.fn()
const stdioConnectMock = vi.fn().mockResolvedValue(undefined)
const stdioServerCtor = vi.fn()
const stdioTransportCtor = vi.fn()
const registerToolsMock = vi.fn()

vi.mock('./transports/http.js', () => ({
  startHttp: startHttpMock
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  class MockServer {
    constructor(...args: unknown[]) {
      stdioServerCtor(...args)
    }
    connect = stdioConnectMock
  }
  return { Server: MockServer }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  class MockStdioServerTransport {
    constructor(...args: unknown[]) {
      stdioTransportCtor(...args)
    }
  }
  return { StdioServerTransport: MockStdioServerTransport }
})

vi.mock('@notionhq/client', () => ({
  Client: vi.fn().mockImplementation(() => ({}))
}))

vi.mock('./tools/registry.js', () => ({
  registerTools: (...args: unknown[]) => registerToolsMock(...args)
}))

vi.mock('./credential-state.js', () => ({
  resolveCredentialState: vi.fn().mockResolvedValue('configured'),
  getNotionToken: vi.fn().mockReturnValue('ntn_test_token')
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

    it('verifies direct stdio transport when mode is stdio', async () => {
      process.env.NOTION_TOKEN = 'ntn_test_token'
      await startServer('stdio')
      expect(stdioServerCtor).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'better-notion-mcp' }),
        expect.objectContaining({ capabilities: expect.any(Object) })
      )
      expect(stdioTransportCtor).toHaveBeenCalledOnce()
      expect(stdioConnectMock).toHaveBeenCalledOnce()
      expect(registerToolsMock).toHaveBeenCalledOnce()
      expect(startHttpMock).not.toHaveBeenCalled()
    })

    it('verifies direct stdio transport when mode is unknown', async () => {
      process.env.NOTION_TOKEN = 'ntn_test_token'
      await startServer('unknown')
      expect(stdioServerCtor).toHaveBeenCalled()
      expect(stdioConnectMock).toHaveBeenCalled()
    })

    it('exits 1 with stderr message when stdio mode is selected without NOTION_TOKEN', async () => {
      delete process.env.NOTION_TOKEN
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      await startServer('stdio')
      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('NOTION_TOKEN'))
      expect(stdioServerCtor).not.toHaveBeenCalled()
      stderrSpy.mockRestore()
    })

    it('verifies error propagation from startHttp', async () => {
      startHttpMock.mockRejectedValueOnce(new Error('HTTP failed'))
      await expect(startServer('http')).rejects.toThrow('HTTP failed')
    })
  })

  describe('bootstrap and exports', () => {
    it('verifies export of selected mode', () => {
      expect(typeof mode).toBe('string')
    })

    it('verifies execution with default mode', async () => {
      process.env.NOTION_TOKEN = 'ntn_test_token'
      await bootstrap()
      expect(stdioConnectMock).toHaveBeenCalled()
    })

    it('verifies execution with provided mode', async () => {
      await bootstrap('http')
      expect(startHttpMock).toHaveBeenCalled()
    })

    it('verifies startup errors in bootstrap', async () => {
      process.env.NOTION_TOKEN = 'ntn_test_token'
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      stdioConnectMock.mockRejectedValueOnce(new Error('Test failure'))

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
