import { describe, expect, it } from 'vitest'
import worker, { NotionContainer, OUTBOUND_BY_HOST } from '../src/worker'

function fakeEnv() {
  const kv = new Map<string, ArrayBuffer>()
  return {
    KV: {
      get: async (k: string, _type?: 'arrayBuffer') => (kv.has(k) ? kv.get(k)! : null),
      put: async (k: string, v: ArrayBuffer) => void kv.set(k, v),
      delete: async (k: string) => void kv.delete(k)
    }
  }
}

// Invoke an outbound handler DIRECTLY (the production path is the container proxy
// via NotionContainer.outboundByHost; the handlers are NOT reachable through the
// public `fetch` entrypoint, so tests exercise them through the exported registry).
const kvH = OUTBOUND_BY_HOST['kv.internal']!

describe('outbound registry (KV-only)', () => {
  it('registers a kv.internal outbound handler', () => {
    expect(NotionContainer.outboundByHost['kv.internal']).toBeDefined()
    expect(OUTBOUND_BY_HOST['kv.internal']).toBeDefined()
  })

  it('does NOT register d1/vectorize handlers (KV-only)', () => {
    expect(Object.keys(NotionContainer.outboundByHost)).toEqual(['kv.internal'])
    expect(OUTBOUND_BY_HOST['d1.internal']).toBeUndefined()
    expect(OUTBOUND_BY_HOST['vectorize.internal']).toBeUndefined()
  })
})

describe('outbound handlers', () => {
  it('KV get 404 then put then get 200 (binary arrayBuffer round-trip)', async () => {
    const env = fakeEnv()
    const key = 'better-notion%2Fsubs%2Fu1%2Fconfig'
    const blob = new Uint8Array([1, 2, 3, 250, 0, 99]).buffer

    let res = await kvH(new Request(`http://kv.internal/${key}`), env as never)
    expect(res.status).toBe(404)

    res = await kvH(new Request(`http://kv.internal/${key}`, { method: 'PUT', body: blob }), env as never)
    expect(res.status).toBe(200)

    res = await kvH(new Request(`http://kv.internal/${key}`), env as never)
    expect(res.status).toBe(200)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(blob))
  })

  it('KV DELETE returns 200', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/better-notion%2Fconfig', { method: 'DELETE' }), env as never)
    expect(res.status).toBe(200)
  })

  it('KV readiness probe: GET __ready -> {ready:true}', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/__ready'), env as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ready: true })
  })

  it('readiness probe does not shadow a real missing key', async () => {
    const env = fakeEnv()
    const res = await kvH(new Request('http://kv.internal/better-notion%2Fsubs%2Fu1%2Fconfig'), env as never)
    expect(res.status).toBe(404)
  })
})

describe('public fetch entrypoint does NOT expose outbound handlers (security)', () => {
  it('a public request with an internal hostname is NOT serviced by a handler', async () => {
    const env = fakeEnv() // no NOTION binding -> DO routing path returns 404
    // Even if an external caller spoofs the hostname to kv.internal, the public
    // fetch must NOT read/write the credential KV — it only routes to the DO.
    const res = await worker.fetch(new Request('http://kv.internal/better-notion%2Fconfig'), env as never)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('not found')
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
    const res = await worker.fetch(new Request('https://better-notion-mcp.n24q02m.com/mcp'), env as never)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('do-hit')
    expect(calls).toEqual(['default'])
  })

  it('Bearer token without sub -> routes to the "default" DO', async () => {
    const { calls, env } = envWithDoSpy()
    const jwt = `h.${btoa(JSON.stringify({ aud: 'x' }))}.s`
    await worker.fetch(
      new Request('https://better-notion-mcp.n24q02m.com/mcp', { headers: { authorization: `Bearer ${jwt}` } }),
      env as never
    )
    expect(calls).toEqual(['default'])
  })

  it('Bearer token with sub -> routes to that sub DO (per-user isolation)', async () => {
    const { calls, env } = envWithDoSpy()
    const jwt = `h.${btoa(JSON.stringify({ sub: 'user-123' }))}.s`
    await worker.fetch(
      new Request('https://better-notion-mcp.n24q02m.com/mcp', { headers: { authorization: `Bearer ${jwt}` } }),
      env as never
    )
    expect(calls).toEqual(['user-123'])
  })
})
