import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type AcceptanceClient,
  assertReadOnlyToolCall,
  runHttpReadOnlyAcceptance,
  runReadOnlyAcceptance
} from '../scripts/provider-readonly-acceptance.js'

const sdkMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  callTool: vi.fn(),
  close: vi.fn(),
  transportArgs: vi.fn()
}))

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    async connect(...args: unknown[]) {
      return sdkMocks.connect(...args)
    }

    async callTool(...args: unknown[]) {
      return sdkMocks.callTool(...args)
    }
  }
}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {
    constructor(...args: unknown[]) {
      sdkMocks.transportArgs(...args)
    }

    async close() {
      return sdkMocks.close()
    }
  }
}))

const secretToken = 'secret-bearer-token'
const sensitiveId = 'private-page-id'

function textResult(value: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }]
  }
}

function searchItem(id: string, title: string) {
  return {
    id,
    object: 'page',
    title,
    url: `https://notion.example/${id}`,
    last_edited_time: '2026-08-30T00:00:00.000Z'
  }
}

class FakeClient implements AcceptanceClient {
  readonly calls: Array<{ name: string; arguments?: Record<string, unknown> }> = []

  async callTool(request: { name: string; arguments?: Record<string, unknown> }) {
    this.calls.push(request)

    if (request.name === 'workspace' && request.arguments?.action === 'search') {
      return textResult({
        action: 'search',
        query: 'provider-acceptance',
        total: 2,
        results: [searchItem(sensitiveId, 'Private result'), searchItem('another-private-id', 'Another result')]
      })
    }

    return textResult({ id: sensitiveId, token: secretToken })
  }
}

describe('read-only Notion provider acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls only the bounded read-only operations and emits metadata only', async () => {
    const client = new FakeClient()

    const summary = await runReadOnlyAcceptance(client)

    expect(client.calls).toEqual([
      { name: 'workspace', arguments: { action: 'info' } },
      { name: 'users', arguments: { action: 'me' } },
      {
        name: 'workspace',
        arguments: { action: 'search', query: 'provider-acceptance', limit: 3 }
      }
    ])
    expect(summary).toEqual({
      status: 'VERIFIED',
      operations: [
        { operation: 'workspace.info', contentBlocks: 1 },
        { operation: 'users.me', contentBlocks: 1 },
        { operation: 'workspace.search', contentBlocks: 1, resultCount: 2 }
      ]
    })

    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain(secretToken)
    expect(serialized).not.toContain(sensitiveId)
    expect(serialized).not.toContain('Private result')
  })

  it('rejects mutating or widened calls before transport dispatch', async () => {
    const dispatched: unknown[] = []
    const guardedDispatch = async (request: unknown) => {
      assertReadOnlyToolCall(request)
      dispatched.push(request)
    }

    await expect(guardedDispatch({ name: 'pages', arguments: { action: 'create' } })).rejects.toThrow(
      /not an allowed read-only acceptance call/
    )
    await expect(
      guardedDispatch({
        name: 'workspace',
        arguments: { action: 'search', query: 'provider-acceptance', limit: 4 }
      })
    ).rejects.toThrow(/not an allowed read-only acceptance call/)
    expect(dispatched).toEqual([])

    expect(() =>
      assertReadOnlyToolCall({
        name: 'workspace',
        arguments: { action: 'search', limit: 3, query: 'provider-acceptance' }
      })
    ).not.toThrow()
  })

  it('fails closed on provider errors, malformed results, and unbounded search results', async () => {
    const providerError: AcceptanceClient = {
      async callTool() {
        return { isError: true, content: [{ type: 'text', text: secretToken }] }
      }
    }
    await expect(runReadOnlyAcceptance(providerError)).rejects.toThrow('workspace.info returned an MCP error')
    try {
      await runReadOnlyAcceptance(providerError)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).not.toContain(secretToken)
    }

    const malformed: AcceptanceClient = {
      async callTool(request) {
        if (request.name === 'workspace' && request.arguments?.action === 'search') {
          return { content: [{ type: 'text', text: '{not-json' }] }
        }
        return textResult({})
      }
    }
    await expect(runReadOnlyAcceptance(malformed)).rejects.toThrow('workspace.search returned malformed JSON')

    const tooManyResults: AcceptanceClient = {
      async callTool(request) {
        if (request.name === 'workspace' && request.arguments?.action === 'search') {
          return textResult({
            action: 'search',
            query: 'provider-acceptance',
            total: 4,
            results: [
              searchItem('one', 'One'),
              searchItem('two', 'Two'),
              searchItem('three', 'Three'),
              searchItem('four', 'Four')
            ]
          })
        }
        return textResult({})
      }
    }
    await expect(runReadOnlyAcceptance(tooManyResults)).rejects.toThrow('workspace.search exceeded the result bound')
  })

  it('closes the SDK transport and redacts connection failures', async () => {
    sdkMocks.connect.mockRejectedValueOnce(new Error(`provider leaked ${secretToken}`))

    let failure: unknown
    try {
      await runHttpReadOnlyAcceptance(new URL('https://notion.example/mcp'), secretToken)
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe('Read-only acceptance transport failed')
    expect((failure as Error).message).not.toContain(secretToken)
    expect(sdkMocks.transportArgs).toHaveBeenCalledWith(expect.any(URL), {
      requestInit: { headers: { authorization: `Bearer ${secretToken}` } }
    })
    expect(sdkMocks.close).toHaveBeenCalledTimes(1)
  })

  it('preserves the primary sanitized failure when transport close also fails', async () => {
    sdkMocks.connect.mockRejectedValueOnce(new Error(`provider leaked ${secretToken}`))
    sdkMocks.close.mockRejectedValueOnce(new Error(`close leaked ${secretToken}`))

    await expect(runHttpReadOnlyAcceptance(new URL('https://notion.example/mcp'), secretToken)).rejects.toThrow(
      'Read-only acceptance transport failed'
    )
  })

  it('reports a sanitized close failure after successful read-only calls', async () => {
    sdkMocks.callTool
      .mockResolvedValueOnce(textResult({}))
      .mockResolvedValueOnce(textResult({}))
      .mockResolvedValueOnce(
        textResult({
          action: 'search',
          query: 'provider-acceptance',
          total: 0,
          results: []
        })
      )
    sdkMocks.close.mockRejectedValueOnce(new Error(`close leaked ${secretToken}`))

    await expect(runHttpReadOnlyAcceptance(new URL('https://notion.example/mcp'), secretToken)).rejects.toThrow(
      'Read-only acceptance transport close failed'
    )
  })
})
