import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import { registerTools, TOOLS } from './registry.js'

describe('Registry', () => {
  describe('TOOLS', () => {
    it('should have readOnlyHint, destructiveHint, and idempotentHint', () => {
      for (const tool of TOOLS) {
        expect(tool).toHaveProperty('readOnlyHint')
        expect(tool).toHaveProperty('destructiveHint')
        expect(tool).toHaveProperty('idempotentHint')
        expect(typeof tool.readOnlyHint).toBe('boolean')
        expect(typeof tool.destructiveHint).toBe('boolean')
        expect(typeof tool.idempotentHint).toBe('boolean')
      }
    })

    it('should configure pages tool correctly', () => {
      const pages = TOOLS.find((t) => t.name === 'pages')
      expect(pages).toBeDefined()
      expect(pages?.readOnlyHint).toBe(false)
      expect(pages?.destructiveHint).toBe(true)
    })

    it('should configure users tool correctly', () => {
      const users = TOOLS.find((t) => t.name === 'users')
      expect(users).toBeDefined()
      expect(users?.readOnlyHint).toBe(true)
      expect(users?.destructiveHint).toBe(false)
    })
  })

  describe('registerTools', () => {
    it('should register tools with server', () => {
      const mockServer = {
        setRequestHandler: vi.fn(),
        notification: vi.fn()
      }

      registerTools(mockServer as any, 'fake-token')

      expect(mockServer.setRequestHandler).toHaveBeenCalled()
      // Verify ListToolsRequestSchema is handled
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(ListToolsRequestSchema, expect.any(Function))
    })
  })
})
