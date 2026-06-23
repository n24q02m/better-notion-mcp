import { PerPluginStore } from '@n24q02m/mcp-core/storage'
import { describe, expect, it, vi } from 'vitest'
import { KvNotionTokenStore } from './notion-token-store-kv.js'

// Injectable fake http matching mcp-core CfKvBackend's Http contract:
// request(method, url, data?, headers?) -> { status, body } with body as bytes.
class FakeKvHttp {
  store = new Map<string, Uint8Array>()
  async request(method: string, url: string, data?: Uint8Array): Promise<{ status: number; body: Uint8Array }> {
    const key = decodeURIComponent(url.split('/').pop() ?? '')
    if (method === 'PUT') {
      this.store.set(key, data ?? new Uint8Array())
      return { status: 200, body: new Uint8Array() }
    }
    if (method === 'GET') {
      const v = this.store.get(key)
      return v ? { status: 200, body: v } : { status: 404, body: new Uint8Array() }
    }
    if (method === 'DELETE') {
      const existed = this.store.delete(key)
      return { status: existed ? 200 : 404, body: new Uint8Array() }
    }
    throw new Error(`unexpected ${method}`)
  }
}

describe('KvNotionTokenStore', () => {
  it('write-through encrypts the token to KV and reads it back', async () => {
    process.env.CREDENTIAL_SECRET = 'test-secret'
    const http = new FakeKvHttp()
    const store = new KvNotionTokenStore({ http })
    await store.save('alice', 'ntn_alice_secret')

    // landed in KV under the per-(plugin, sub) config key (better-notion/subs/alice/config),
    // and NOT as plaintext.
    const stored = [...http.store.entries()].find(([k]) => k.includes('subs/alice/config'))
    expect(stored).toBeDefined()
    expect(new TextDecoder().decode(stored![1])).not.toContain('ntn_alice_secret')

    // a fresh store (cold cache) recovers it from KV (decrypted).
    const cold = new KvNotionTokenStore({ http })
    expect(await cold.getAsync('alice')).toBe('ntn_alice_secret')
  })

  it('keeps distinct subs isolated', async () => {
    process.env.CREDENTIAL_SECRET = 'test-secret'
    const http = new FakeKvHttp()
    const store = new KvNotionTokenStore({ http })
    await store.save('alice', 'ntn_a')
    await store.save('bob', 'ntn_b')
    const cold = new KvNotionTokenStore({ http })
    expect(await cold.getAsync('alice')).toBe('ntn_a')
    expect(await cold.getAsync('bob')).toBe('ntn_b')
  })

  it('sync get() serves the in-memory cache after a save', async () => {
    process.env.CREDENTIAL_SECRET = 'test-secret'
    const store = new KvNotionTokenStore({ http: new FakeKvHttp() })
    await store.save('alice', 'ntn_a')
    expect(store.get('alice')).toBe('ntn_a') // cache hit, no KV round-trip
  })

  it('clear removes from both cache and KV', async () => {
    process.env.CREDENTIAL_SECRET = 'test-secret'
    const http = new FakeKvHttp()
    const store = new KvNotionTokenStore({ http })
    await store.save('alice', 'ntn_a')
    await store.clear('alice')
    expect(store.get('alice')).toBeUndefined()
    const cold = new KvNotionTokenStore({ http })
    expect(await cold.getAsync('alice')).toBeUndefined()
  })

  it('ready() resolves when the kv.internal outbound path is reachable', async () => {
    process.env.CREDENTIAL_SECRET = 'test-secret'
    const store = new KvNotionTokenStore({ http: new FakeKvHttp() })
    // A reachable backend (200/404 both count as "answered") -> no throw.
    await expect(store.ready()).resolves.toBeUndefined()
  })

  it('ready() rejects when the container -> Worker outbound is not wired', async () => {
    process.env.CREDENTIAL_SECRET = 'test-secret'
    // Simulate broken outbound interception: the fetch to kv.internal fails at
    // the transport layer (NXDOMAIN / connection refused) instead of answering.
    const brokenHttp = {
      async request(): Promise<{ status: number; body: Uint8Array }> {
        throw new Error('getaddrinfo ENOTFOUND kv.internal')
      }
    }
    const store = new KvNotionTokenStore({ http: brokenHttp })
    await expect(store.ready()).rejects.toThrow(/kv\.internal/)
  })

  it('getAsync returns undefined and does not throw when PerPluginStore.load fails', async () => {
    process.env.CREDENTIAL_SECRET = 'test-secret'
    const store = new KvNotionTokenStore({ http: new FakeKvHttp() })

    // Rationale: Testing this requires mocking the internal PerPluginStore load method to throw
    const loadSpy = vi.spyOn(PerPluginStore.prototype, 'load').mockRejectedValue(new Error('corrupt blob'))

    const result = await store.getAsync('alice')
    expect(result).toBeUndefined()
    expect(loadSpy).toHaveBeenCalled()

    loadSpy.mockRestore()
  })
})
