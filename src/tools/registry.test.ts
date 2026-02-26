import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'
import { registerTools } from './registry.js'

describe('registry', () => {
  it('should resolve docs directory correctly and read resources', async () => {
    const server = new Server({ name: 'test', version: '1.0' }, { capabilities: {} })

    // Mock setRequestHandler
    const handlers = new Map()
    server.setRequestHandler = (schema: any, handler: any) => {
      handlers.set(schema, handler)
    }

    registerTools(server, 'fake-token')

    const readResourceHandler = handlers.get(ReadResourceRequestSchema)
    expect(readResourceHandler).toBeDefined()

    // Try to read a resource
    const result = await readResourceHandler({ params: { uri: 'notion://docs/pages' } })
    expect(result.contents[0].text).toBeDefined()
    expect(result.contents[0].text.length).toBeGreaterThan(0)
  })
})
