import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createMCPServer } from './create-server.js'

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: class MockServer {
      serverInfo: any
      capabilities: any
      constructor(info: any, opts: any) {
        this.serverInfo = info
        this.capabilities = opts.capabilities
      }
    }
  }
})

vi.mock('./tools/registry.js', () => ({
  registerTools: vi.fn()
}))

vi.mock('node:fs', () => ({
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '2.14.0' }))
}))

describe('createMCPServer', () => {
  it('should create a Server with correct name and version', () => {
    const factory = vi.fn()
    const server = createMCPServer(factory) as any

    expect(server.serverInfo.name).toBe('@n24q02m/better-notion-mcp')
    expect(server.serverInfo.version).toBe('2.14.0')
  })

  it('should pass the client factory to registerTools', async () => {
    const { registerTools } = await import('./tools/registry.js')
    const factory = vi.fn()

    const server = createMCPServer(factory)

    expect(registerTools).toHaveBeenCalledWith(server, factory)
  })

  it('should enable tools and resources capabilities', () => {
    const factory = vi.fn()
    const server = createMCPServer(factory) as any

    expect(server.capabilities).toEqual({ tools: {}, resources: {} })
  })

  it('should return default version 0.0.0 when package.json reading fails', () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw new Error('File not found')
    })
    const factory = vi.fn()
    const server = createMCPServer(factory) as any

    expect(server.serverInfo.version).toBe('0.0.0')
  })

  it('should return 0.0.0 if version is missing in package.json', () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => JSON.stringify({}))
    const factory = vi.fn()
    const server = createMCPServer(factory) as any

    expect(server.serverInfo.version).toBe('0.0.0')
  })

  it('should return a unique Server instance on every call', () => {
    const factory = vi.fn()
    const server1 = createMCPServer(factory)
    const server2 = createMCPServer(factory)

    expect(server1).not.toBe(server2)
  })

  it('should return 0.0.0 when package.json is malformed', () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => 'invalid json')
    const factory = vi.fn()
    const server = createMCPServer(factory) as any

    expect(server.serverInfo.version).toBe('0.0.0')
  })

  it('should propagate errors from registerTools', async () => {
    const { registerTools } = await import('./tools/registry.js')
    vi.mocked(registerTools).mockImplementationOnce(() => {
      throw new Error('Registration failed')
    })

    const factory = vi.fn()
    expect(() => createMCPServer(factory)).toThrow('Registration failed')
  })
})
