import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'
import { describe, expect, it } from 'vitest'
import { StatelessClientStore } from './stateless-client-store.js'

const TEST_SECRET = 'test-hmac-secret-for-dcr'

function makeClient(
  overrides: Record<string, unknown> = {}
): Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'> {
  return {
    redirect_uris: ['https://example.com/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    ...overrides
  } as Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>
}

describe('StatelessClientStore', () => {
  describe('registerClient', () => {
    it('should return a client with deterministic client_id and client_secret', () => {
      const store = new StatelessClientStore(TEST_SECRET)
      const input = makeClient()

      const result1 = store.registerClient(input)
      const result2 = store.registerClient(input)

      expect(result1.client_id).toBe(result2.client_id)
      expect(result1.client_secret).toBe(result2.client_secret)
    })

    it('should generate a 32-char hex client_id', () => {
      const store = new StatelessClientStore(TEST_SECRET)
      const result = store.registerClient(makeClient())

      expect(result.client_id).toMatch(/^[0-9a-f]{32}$/)
    })

    it('should generate a 64-char hex client_secret', () => {
      const store = new StatelessClientStore(TEST_SECRET)
      const result = store.registerClient(makeClient())

      expect(result.client_secret).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should set client_id_issued_at to current epoch', () => {
      const store = new StatelessClientStore(TEST_SECRET)
      const before = Math.floor(Date.now() / 1000)
      const result = store.registerClient(makeClient())
      const after = Math.floor(Date.now() / 1000)

      expect(result.client_id_issued_at).toBeGreaterThanOrEqual(before)
      expect(result.client_id_issued_at).toBeLessThanOrEqual(after)
    })

    it('should preserve original client metadata', () => {
      const store = new StatelessClientStore(TEST_SECRET)
      const input = makeClient({ client_name: 'My MCP Client' })

      const result = store.registerClient(input)

      expect(result.client_name).toBe('My MCP Client')
      expect(result.redirect_uris).toEqual(input.redirect_uris)
    })

    it('should produce different client_ids for different redirect_uris', () => {
      const store = new StatelessClientStore(TEST_SECRET)

      const result1 = store.registerClient(makeClient({ redirect_uris: ['https://a.com/cb'] }))
      const result2 = store.registerClient(makeClient({ redirect_uris: ['https://b.com/cb'] }))

      expect(result1.client_id).not.toBe(result2.client_id)
    })

    it('should produce different client_ids for different client_names', () => {
      const store = new StatelessClientStore(TEST_SECRET)

      const result1 = store.registerClient(makeClient({ client_name: 'Client A' }))
      const result2 = store.registerClient(makeClient({ client_name: 'Client B' }))

      expect(result1.client_id).not.toBe(result2.client_id)
    })
  })

  describe('getClient', () => {
    it('should return cached client with full metadata after registration', () => {
      const store = new StatelessClientStore(TEST_SECRET)

      const registered = store.registerClient(makeClient())
      const retrieved = store.getClient(registered.client_id)

      expect(retrieved).toBeDefined()
      expect(retrieved!.client_id).toBe(registered.client_id)
      expect(retrieved!.client_secret).toBe(registered.client_secret)
      expect(retrieved!.redirect_uris).toEqual(['https://example.com/callback'])
    })

    it('should return fallback client with empty redirect_uris for unknown client_id', () => {
      const store = new StatelessClientStore(TEST_SECRET)

      const result = store.getClient('unknown-client-id')

      expect(result).toBeDefined()
      expect(result!.redirect_uris).toEqual([])
    })

    it('should return consistent results for the same client_id', () => {
      const store = new StatelessClientStore(TEST_SECRET)

      const result1 = store.getClient('abc123')
      const result2 = store.getClient('abc123')

      expect(result1!.client_secret).toBe(result2!.client_secret)
    })

    it('should return default OAuth metadata', () => {
      const store = new StatelessClientStore(TEST_SECRET)
      const result = store.getClient('any-id')

      expect(result!.grant_types).toEqual(['authorization_code', 'refresh_token'])
      expect(result!.response_types).toEqual(['code'])
      expect(result!.token_endpoint_auth_method).toBe('client_secret_post')
    })
  })

  describe('secret rotation', () => {
    it('should produce different credentials with a different secret', () => {
      const store1 = new StatelessClientStore('secret-v1')
      const store2 = new StatelessClientStore('secret-v2')
      const input = makeClient()

      const result1 = store1.registerClient(input)
      const result2 = store2.registerClient(input)

      expect(result1.client_id).not.toBe(result2.client_id)
      expect(result1.client_secret).not.toBe(result2.client_secret)
    })

    it('should not match getClient secret after rotation', () => {
      const store1 = new StatelessClientStore('secret-v1')
      const store2 = new StatelessClientStore('secret-v2')

      const registered = store1.registerClient(makeClient())
      const retrieved = store2.getClient(registered.client_id)

      // client_id is the same (passed in), but secret won't match
      expect(retrieved!.client_secret).not.toBe(registered.client_secret)
    })
  })
})
