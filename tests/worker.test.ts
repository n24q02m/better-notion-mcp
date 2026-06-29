import { describe, expect, it, vi } from 'vitest'
import worker, { CONTAINER_PING_ENDPOINT, OUTBOUND_BY_HOST } from '../src/worker.js'

// Mock JWTIssuer from @n24q02m/mcp-core
vi.mock('@n24q02m/mcp-core', async () => {
  const actual = await vi.importActual<any>('@n24q02m/mcp-core')
  return {
    ...actual,
    JWTIssuer: class {
      name: string
      secret: string
      constructor(name: string, _something: any, secret: string) {
        this.name = name
        this.secret = secret
      }
      async init() {}
      async verifyAccessToken(token: string) {
        if (token === 'valid-jwt') return { sub: 'verified-user' }
        if (token === 'no-sub-jwt') return {}
        throw new Error('invalid token')
      }
    }
  }
})

// Mock @cloudflare/containers
vi.mock('@cloudflare/containers', () => {
  return {
    Container: class {
      env: any
      constructor(_ctx: any, env: any) {
        this.env = env
      }
    },
    ContainerProxy: {}
  }
})

function fakeEnv() {
  const kv = new Map<string, ArrayBuffer>()
  return {
    KV: {
      get: async (k: string, _type?: 'arrayBuffer') => (kv.has(k) ? kv.get(k)! : null),
      put: async (k: string, v: ArrayBuffer) => void kv.set(k, v),
      delete: async (k: string) => void kv.delete(k)
    },
    MCP_TRANSPORT: 'http',
    HOST: '0.0.0.0',
    CREDENTIAL_SECRET: 'test-secret'
  }
}

const kvH = OUTBOUND_BY_HOST['kv.internal']!

describe('outbound registry (KV-only)', () => {
  it('registers a kv.internal outbound handler', async () => {
    const { NotionContainer } = await import('../src/worker.js')
    expect(NotionContainer.outboundByHost?.['kv.internal']).toBeDefined()
    expect(OUTBOUND_BY_HOST['kv.internal']).toBeDefined()
  })

  it('does NOT register d1/vectorize handlers (KV-only)', async () => {
    const { NotionContainer } = await import('../src/worker.js')
    expect(Object.keys(NotionContainer.outboundByHost || {})).toEqual(['kv.internal'])
    expect(OUTBOUND_BY_HOST['d1.internal']).toBeUndefined()
    expect(OUTBOUND_BY_HOST['vectorize.internal']).toBeUndefined()
  })
})

describe('outbound handlers', () => {
  it('KV get 404 then put then get 200 (binary arrayBuffer round-trip)', async () => {
    const env = fakeEnv()
    const key = 'better-notion%2Fsubs%2Fu1%2Fconfig'
    const blob = new Uint8Array([1, 2, 3, 250, 0, 99]).buffer

    let res = await kvH(new Request(`http://kv.internal/${key}`), env as any, {} as any)
    expect(res.status).toBe(404)

    res = await kvH(new Request(`http://kv.internal/${key}`, { method: 'PUT', body: blob }), env as any, {} as any)
    expect(res.status).toBe(200)

    res = await kvH(new Request(`http://kv.internal/${key}`), env as any, {} as any)
    expect(res.status).toBe(200)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(blob))
  })

  it('KV DELETE returns 200', async () => {
    const env = fakeEnv()
    const res = await kvH(
      new Request('http://kv.internal/better-notion%2Fconfig', { method: 'DELETE' }),
      env as any,
      {} as any
    )
    expect(res.status).toBe(200)
  })

  it('KV readiness probe: GET __ready -> {ready:true}', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/__ready'), env as any, {} as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ready: true })
  })

  it('returns 405 for unsupported methods', async () => {
    const env = fakeEnv()
    const res = await kvH(
      new Request('http://kv.internal/better-notion/config', { method: 'POST' }),
      env as any,
      {} as any
    )
    expect(res.status).toBe(405)
    expect(await res.text()).toBe('method not allowed')
  })
})

describe('NotionContainer', () => {
  it('has correct default properties and environment picking', async () => {
    const { NotionContainer } = await import('../src/worker.js')
    const env = {
      ...fakeEnv(),
      EXTRA: 'ignored',
      EMPTY: '',
      PORT: '8080'
    }
    const container = new NotionContainer({} as any, env as any)
    expect(container.defaultPort).toBe(8080)
    expect(container.sleepAfter).toBe('5m')
    expect(container.pingEndpoint).toBe(CONTAINER_PING_ENDPOINT)
    expect(container.enableInternet).toBe(true)
    expect((container as any).envVars).toEqual({
      MCP_TRANSPORT: 'http',
      HOST: '0.0.0.0',
      CREDENTIAL_SECRET: 'test-secret',
      PORT: '8080'
    })
  })
})

describe('extractUserId', () => {
  function envWithDoSpy(secret?: string) {
    const calls: string[] = []
    return {
      calls,
      env: {
        NOTION: {
          idFromName: (n: string) => {
            calls.push(n)
            return { name: n }
          },
          get: (_id: unknown) => ({ fetch: async () => new Response('do-hit', { status: 200 }) })
        },
        CREDENTIAL_SECRET: secret
      }
    }
  }

  it('verifies token when CREDENTIAL_SECRET is set', async () => {
    const { calls, env } = envWithDoSpy('test-secret')
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: 'Bearer valid-jwt' } }),
      env as any
    )
    expect(calls).toEqual(['verified-user'])
  })

  it('defaults to "default" if token has no sub claim (with secret)', async () => {
    const { calls, env } = envWithDoSpy('test-secret')
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: 'Bearer no-sub-jwt' } }),
      env as any
    )
    expect(calls).toEqual(['default'])
  })

  it('defaults to "default" if token verification fails (with secret)', async () => {
    const { calls, env } = envWithDoSpy('test-secret')
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: 'Bearer invalid-jwt' } }),
      env as any
    )
    expect(calls).toEqual(['default'])
  })

  it('extracts sub claim without secret (fallback)', async () => {
    const { calls, env } = envWithDoSpy(undefined)
    const jwt = `h.${btoa(JSON.stringify({ sub: 'user-456' }))}.s`
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: `Bearer ${jwt}` } }),
      env as any
    )
    expect(calls).toEqual(['user-456'])
  })

  it('defaults to "default" if token has no sub claim (no secret)', async () => {
    const { calls, env } = envWithDoSpy(undefined)
    const jwt = `h.${btoa(JSON.stringify({ aud: 'x' }))}.s`
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: `Bearer ${jwt}` } }),
      env as any
    )
    expect(calls).toEqual(['default'])
  })

  it('defaults to "default" if token has no dots (fallback ?? "")', async () => {
    const { calls, env } = envWithDoSpy(undefined)
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: 'Bearer nodots' } }),
      env as any
    )
    expect(calls).toEqual(['default'])
  })
})

describe('single-user DO contract + per-sub routing (E.2)', () => {
  function envWithDoSpy() {
    const calls: string[] = []
    return {
      calls,
      env: {
        NOTION: {
          idFromName: (n: string) => {
            calls.push(n)
            return { name: n }
          },
          get: (_id: unknown) => ({ fetch: async () => new Response('do-hit', { status: 200 }) })
        }
      }
    }
  }

  it('no Bearer token -> routes to the "default" DO', async () => {
    const { calls, env } = envWithDoSpy()
    const res = await worker.fetch(new Request('https://notion.n24q02m.com/mcp'), env as any)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('do-hit')
    expect(calls).toEqual(['default'])
  })

  it('Bearer token with malformed base64 payload -> defaults to "default" DO', async () => {
    const { calls, env } = envWithDoSpy()
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: 'Bearer h.!!!.s' } }),
      env as any
    )
    expect(calls).toEqual(['default'])
  })

  it('Bearer token with valid base64 but malformed JSON -> defaults to "default" DO', async () => {
    const { calls, env } = envWithDoSpy()
    const malformedJsonB64 = btoa('{"sub": "missing-quote')
    await worker.fetch(
      new Request('https://notion.n24q02m.com/mcp', { headers: { authorization: `Bearer h.${malformedJsonB64}.s` } }),
      env as any
    )
    expect(calls).toEqual(['default'])
  })

  it('returns 404 if NOTION binding is missing', async () => {
    const res = await worker.fetch(new Request('https://notion.n24q02m.com/mcp'), {} as any)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('not found')
  })
})

describe('KV security (Sentinel)', () => {
  it('allows keys with better-notion/ prefix', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/better-notion/config'), env as any, {} as any)
    expect(res.status).toBe(404)
  })

  it('allows the __ready reserved key', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/__ready'), env as any, {} as any)
    expect(res.status).toBe(200)
  })

  it('rejects keys without better-notion/ prefix (403)', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/other-plugin/config'), env as any, {} as any)
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('forbidden')
  })

  it('rejects path traversal attempts that try to escape the prefix (403)', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/better-notion/../secret'), env as any, {} as any)
    expect(res.status).toBe(403)
  })
})
