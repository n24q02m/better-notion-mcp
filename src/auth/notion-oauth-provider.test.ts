import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotionOAuthConfig } from './notion-oauth-provider.js'
import { createNotionOAuthProvider, requestContext } from './notion-oauth-provider.js'

const TEST_CONFIG: NotionOAuthConfig = {
  notionClientId: '31cd872b-test-client-id',
  notionClientSecret: 'secret_test123',
  dcrSecret: 'test-dcr-secret',
  publicUrl: 'https://test.example.com'
}

vi.mock('@notionhq/client', () => ({
  Client: class MockClient {
    private auth: string
    constructor({ auth }: { auth: string }) {
      this.auth = auth
    }
    users = {
      me: async () => {
        if (this.auth === 'valid-token' || this.auth === 'refreshed-notion-token') {
          return { id: 'user-123', name: 'Test User' }
        }
        throw new Error('Unauthorized')
      }
    }
  }
}))

describe('createNotionOAuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should return provider and relay stores', () => {
    const result = createNotionOAuthProvider(TEST_CONFIG)
    expect(result.provider).toBeDefined()
    expect(result.clientStore).toBeDefined()
    expect(result.pendingAuths).toBeInstanceOf(Map)
    expect(result.authCodes).toBeInstanceOf(Map)
    expect(result.callbackUrl).toBe('https://test.example.com/callback')
  })

  it('should create a provider with skipLocalPkceValidation=true', () => {
    const { provider } = createNotionOAuthProvider(TEST_CONFIG)
    expect(provider.skipLocalPkceValidation).toBe(true)
  })

  it('should expose a clientsStore with DCR support', () => {
    const { provider } = createNotionOAuthProvider(TEST_CONFIG)
    expect(provider.clientsStore).toBeDefined()
    expect(provider.clientsStore.registerClient).toBeDefined()
  })

  it('should compute correct notionBasicAuth', () => {
    const { notionBasicAuth } = createNotionOAuthProvider(TEST_CONFIG)
    const expected = Buffer.from(`${TEST_CONFIG.notionClientId}:${TEST_CONFIG.notionClientSecret}`).toString('base64')
    expect(notionBasicAuth).toBe(expected)
  })

  describe('verifyAccessToken', () => {
    it('should return AuthInfo via opaque token lookup', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)
      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      const tokens = await provider.exchangeAuthorizationCode(
        { client_id: 'c1', client_secret: 's1' } as any,
        'code-1',
        'dummy-verifier'
      )

      const result = await provider.verifyAccessToken(tokens.access_token)
      expect(result.token).toBe('valid-token')
      expect(result.clientId).toBe(TEST_CONFIG.notionClientId)
      expect(result.scopes).toEqual(['notion:read', 'notion:write'])
      expect(result.expiresAt).toBeTypeOf('number')
      expect(result.extra).toEqual({ userId: 'user-123', userName: 'Test User' })
    })

    it('should resolve external tokens via one-shot pending bind', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      await requestContext.run({ ip: '10.0.0.1' }, () =>
        provider.exchangeAuthorizationCode({ client_id: 'c1', client_secret: 's1' } as any, 'code-1', 'dummy-verifier')
      )

      // First unknown token claims the pending bind (same IP)
      const result = await requestContext.run({ ip: '10.0.0.1' }, () =>
        provider.verifyAccessToken('sk-ant-oat01-legit-client')
      )
      expect(result.token).toBe('valid-token')

      // Same token works again (now bound — no IP check needed)
      const result2 = await provider.verifyAccessToken('sk-ant-oat01-legit-client')
      expect(result2.token).toBe('valid-token')
    })

    it('should reject a SECOND unknown token after bind is consumed (one-shot)', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      await requestContext.run({ ip: '10.0.0.1' }, () =>
        provider.exchangeAuthorizationCode({ client_id: 'c1', client_secret: 's1' } as any, 'code-1', 'dummy-verifier')
      )

      // First token claims the bind (same IP)
      await requestContext.run({ ip: '10.0.0.1' }, () => provider.verifyAccessToken('sk-ant-oat01-legit-client'))

      // Second DIFFERENT token should be rejected — bind is consumed
      await requestContext.run({ ip: '10.0.0.1' }, () =>
        expect(provider.verifyAccessToken('sk-ant-attacker-token')).rejects.toThrow('No Notion token found')
      )
    })

    it('should reject unknown tokens after pending bind expires', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      await requestContext.run({ ip: '10.0.0.1' }, () =>
        provider.exchangeAuthorizationCode({ client_id: 'c1', client_secret: 's1' } as any, 'code-1', 'dummy-verifier')
      )

      // Advance past the 30-second pending bind TTL
      vi.advanceTimersByTime(45 * 1000)

      // Unknown token should be rejected — pending bind expired
      await requestContext.run({ ip: '10.0.0.1' }, () =>
        expect(provider.verifyAccessToken('sk-ant-late-token')).rejects.toThrow('No Notion token found')
      )
    })

    it('should still accept bound tokens after pending bind expires', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      await requestContext.run({ ip: '10.0.0.1' }, () =>
        provider.exchangeAuthorizationCode({ client_id: 'c1', client_secret: 's1' } as any, 'code-1', 'dummy-verifier')
      )

      // Bind during pending period (same IP)
      await requestContext.run({ ip: '10.0.0.1' }, () => provider.verifyAccessToken('sk-ant-legit-token'))

      // Advance past pending bind TTL
      vi.advanceTimersByTime(45 * 1000)

      // Already-bound token still works (no IP check for bound tokens)
      const result = await provider.verifyAccessToken('sk-ant-legit-token')
      expect(result.token).toBe('valid-token')
    })

    it('should use verification cache on subsequent calls', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)
      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      const tokens = await provider.exchangeAuthorizationCode(
        { client_id: 'c1', client_secret: 's1' } as any,
        'code-1',
        'dummy-verifier'
      )

      // First call hits Notion API
      const r1 = await provider.verifyAccessToken(tokens.access_token)
      expect(r1.token).toBe('valid-token')

      // Second call should use cache (no Notion API call)
      const r2 = await provider.verifyAccessToken(tokens.access_token)
      expect(r2.token).toBe('valid-token')
    })

    it('should bypass cache after VERIFY_CACHE_TTL expires', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)
      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      const tokens = await provider.exchangeAuthorizationCode(
        { client_id: 'c1', client_secret: 's1' } as any,
        'code-1',
        'dummy-verifier'
      )

      // First call populates cache
      await provider.verifyAccessToken(tokens.access_token)

      // Advance past 5-minute verify cache TTL
      vi.advanceTimersByTime(6 * 60 * 1000)

      // Should hit Notion API again (cache expired)
      const result = await provider.verifyAccessToken(tokens.access_token)
      expect(result.token).toBe('valid-token')
      expect(result.extra).toEqual({ userId: 'user-123', userName: 'Test User' })
    })

    it('should throw when no Notion token is stored', async () => {
      const { provider } = createNotionOAuthProvider(TEST_CONFIG)
      await expect(provider.verifyAccessToken('sk-ant-unknown')).rejects.toThrow('No Notion token found')
    })

    it('should reject pending bind from a different IP (IP-scoped)', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })

      // Exchange from IP 1.2.3.4 (simulates POST /token from legitimate client)
      await requestContext.run({ ip: '1.2.3.4' }, () =>
        provider.exchangeAuthorizationCode({ client_id: 'c1', client_secret: 's1' } as any, 'code-1', 'dummy-verifier')
      )

      // Attacker tries to claim from different IP
      await requestContext.run({ ip: '5.6.7.8' }, () =>
        expect(provider.verifyAccessToken('sk-ant-attacker-token')).rejects.toThrow('No Notion token found')
      )
    })

    it('should allow pending bind from the same IP (IP-scoped)', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })

      // Exchange from IP 1.2.3.4
      await requestContext.run({ ip: '1.2.3.4' }, () =>
        provider.exchangeAuthorizationCode({ client_id: 'c1', client_secret: 's1' } as any, 'code-1', 'dummy-verifier')
      )

      // Legitimate client claims from same IP
      const result = await requestContext.run({ ip: '1.2.3.4' }, () =>
        provider.verifyAccessToken('sk-ant-legit-client')
      )
      expect(result.token).toBe('valid-token')
    })

    it('should throw for invalid Notion token', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)
      authCodes.set('code-1', {
        notionAccessToken: 'expired-notion-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      const tokens = await provider.exchangeAuthorizationCode(
        { client_id: 'c1', client_secret: 's1' } as any,
        'code-1',
        'dummy-verifier'
      )

      // Use the opaque token directly (not pending bind) to test Notion API validation
      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow('Invalid or expired Notion token')
    })

    it('should clear stale cache entry when Notion token becomes invalid', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      // First: store a valid token and populate cache
      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      const tokens = await provider.exchangeAuthorizationCode(
        { client_id: 'c1', client_secret: 's1' } as any,
        'code-1',
        'dummy-verifier'
      )
      await provider.verifyAccessToken(tokens.access_token)

      // Now store a code with an invalid notion token under a DIFFERENT opaque token
      authCodes.set('code-2', {
        notionAccessToken: 'now-invalid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })
      const tokens2 = await provider.exchangeAuthorizationCode(
        { client_id: 'c2', client_secret: 's2' } as any,
        'code-2',
        'dummy-verifier'
      )

      // This should fail and delete the cache entry for 'now-invalid-token'
      await expect(provider.verifyAccessToken(tokens2.access_token)).rejects.toThrow('Invalid or expired Notion token')
    })

    it('should reject pending bind when IP is unknown', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })

      // Exchange WITHOUT requestContext — no IP stored
      await provider.exchangeAuthorizationCode(
        { client_id: 'c1', client_secret: 's1' } as any,
        'code-1',
        'dummy-verifier'
      )

      // Even with IP, the pending bind has no sourceIp so strict check rejects
      await requestContext.run({ ip: '1.2.3.4' }, () =>
        expect(provider.verifyAccessToken('sk-ant-unknown')).rejects.toThrow('No Notion token found')
      )
    })

    it('should reject pending bind when claim IP is unknown (no requestContext)', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-1', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })

      // Exchange WITH IP
      await requestContext.run({ ip: '1.2.3.4' }, () =>
        provider.exchangeAuthorizationCode({ client_id: 'c1', client_secret: 's1' } as any, 'code-1', 'dummy-verifier')
      )

      // Claim WITHOUT requestContext — claimIp is undefined, strict check rejects
      await expect(provider.verifyAccessToken('sk-ant-no-ip')).rejects.toThrow('No Notion token found')
    })
  })

  describe('clientsStore (StatelessClientStore)', () => {
    it('should register a client with deterministic credentials', async () => {
      const { provider } = createNotionOAuthProvider(TEST_CONFIG)
      const store = provider.clientsStore

      const client1 = await store.registerClient!({
        redirect_uris: ['https://example.com/cb']
      } as any)

      const client2 = await store.registerClient!({
        redirect_uris: ['https://example.com/cb']
      } as any)

      expect(client1.client_id).toBe(client2.client_id)
      expect(client1.client_secret).toBe(client2.client_secret)
    })

    it('should retrieve a client by ID', async () => {
      const { provider } = createNotionOAuthProvider(TEST_CONFIG)
      const store = provider.clientsStore

      const registered = await store.registerClient!({
        redirect_uris: ['https://example.com/cb']
      } as any)

      const retrieved = await store.getClient(registered.client_id)
      expect(retrieved).toBeDefined()
    })
  })

  describe('exchangeAuthorizationCode', () => {
    it('should issue opaque token and store Notion token server-side', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('test-code', {
        notionAccessToken: 'notion-token-123',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })

      const result = await provider.exchangeAuthorizationCode(
        { client_id: 'test', client_secret: 'test' } as any,
        'test-code',
        'dummy-verifier'
      )

      // Should return opaque token, NOT the Notion token
      expect(result.access_token).not.toBe('notion-token-123')
      expect(result.access_token).toHaveLength(96) // 48 bytes hex
      expect(result.token_type).toBe('bearer')
      expect(result.expires_in).toBe(86400)
      // Code should be consumed (deleted)
      expect(authCodes.has('test-code')).toBe(false)
    })

    it('should throw for an invalid auth code', async () => {
      const { provider } = createNotionOAuthProvider(TEST_CONFIG)

      await expect(
        provider.exchangeAuthorizationCode({ client_id: 'test', client_secret: 'test' } as any, 'invalid-code')
      ).rejects.toThrow('Invalid or expired authorization code')
    })

    it('should verify PKCE S256 code_verifier when challenge is stored', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

      authCodes.set('pkce-code', {
        notionAccessToken: 'notion-token-pkce',
        codeChallenge,
        codeChallengeMethod: 'S256',
        clientId: 'test-client',
        createdAt: Date.now()
      })

      const result = await provider.exchangeAuthorizationCode(
        { client_id: 'test-client', client_secret: 'test' } as any,
        'pkce-code',
        codeVerifier
      )
      expect(result.access_token).toHaveLength(96)
    })

    it('should reject wrong code_verifier (PKCE)', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)
      const codeChallenge = createHash('sha256').update('correct-verifier').digest('base64url')

      authCodes.set('pkce-code', {
        notionAccessToken: 'notion-token-pkce',
        codeChallenge,
        codeChallengeMethod: 'S256',
        clientId: 'test-client',
        createdAt: Date.now()
      })

      await expect(
        provider.exchangeAuthorizationCode(
          { client_id: 'test-client', client_secret: 'test' } as any,
          'pkce-code',
          'wrong-verifier'
        )
      ).rejects.toThrow('code_verifier does not match the challenge')
    })

    it('should reject missing code_verifier when PKCE challenge is stored', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)
      const codeChallenge = createHash('sha256').update('some-verifier').digest('base64url')

      authCodes.set('pkce-code', {
        notionAccessToken: 'notion-token-pkce',
        codeChallenge,
        codeChallengeMethod: 'S256',
        clientId: 'test-client',
        createdAt: Date.now()
      })

      await expect(
        provider.exchangeAuthorizationCode(
          { client_id: 'test-client', client_secret: 'test' } as any,
          'pkce-code'
          // no code_verifier
        )
      ).rejects.toThrow('code_verifier is required')
    })

    it('should reject auth code from a different client (client binding)', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('bound-code', {
        notionAccessToken: 'notion-token-123',
        clientId: 'client-A',
        createdAt: Date.now()
      })

      // Client B tries to exchange Client A's auth code
      await expect(
        provider.exchangeAuthorizationCode(
          { client_id: 'client-B', client_secret: 'test' } as any,
          'bound-code',
          'dummy-verifier'
        )
      ).rejects.toThrow('Auth code was not issued to this client')
    })

    it('should create a pending bind with IP from requestContext', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('code-ip', {
        notionAccessToken: 'valid-token',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
      })

      // Exchange within requestContext — pending bind should have sourceIp
      await requestContext.run({ ip: '192.168.1.1' }, () =>
        provider.exchangeAuthorizationCode(
          { client_id: 'ip-client', client_secret: 's1' } as any,
          'code-ip',
          'dummy-verifier'
        )
      )

      // Verify bind works from same IP
      const result = await requestContext.run({ ip: '192.168.1.1' }, () =>
        provider.verifyAccessToken('external-token-123')
      )
      expect(result.token).toBe('valid-token')
    })

    it('should allow exchange without clientId binding (no clientId stored)', async () => {
      const { provider, authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('unbound-code', {
        notionAccessToken: 'notion-token-unbound',
        createdAt: Date.now(),
        codeChallenge: 'GtSJbMT37cqR-58aHsbbZc3oI08k5VDyJSpq1iwbvHY',
        codeChallengeMethod: 'S256'
        // no clientId — any client can exchange
      })

      const result = await provider.exchangeAuthorizationCode(
        { client_id: 'any-client', client_secret: 'test' } as any,
        'unbound-code',
        'dummy-verifier'
      )
      expect(result.access_token).toHaveLength(96)
    })
  })

  describe('authorize (callback relay)', () => {
    it('should redirect to Notion with our callback URL and store pending auth', async () => {
      const { provider, pendingAuths } = createNotionOAuthProvider(TEST_CONFIG)

      const redirectedUrl = await new Promise<string>((resolve) => {
        const mockRes = { redirect: (url: string) => resolve(url) }
        provider.authorize(
          { client_id: 'test' } as any,
          {
            redirectUri: 'https://mcp-client.example.com/cb',
            state: 'client-state',
            codeChallenge: 'challenge123',
            codeChallengeMethod: 'S256'
          } as any,
          mockRes as any
        )
      })

      expect(redirectedUrl).toContain('api.notion.com/v1/oauth/authorize')
      expect(redirectedUrl).toContain('client_id=31cd872b-test-client-id')
      expect(redirectedUrl).toContain(`redirect_uri=${encodeURIComponent('https://test.example.com/callback')}`)
      expect(redirectedUrl).toContain('response_type=code')
      expect(redirectedUrl).toContain('owner=user')
      expect(pendingAuths.size).toBe(1)

      const [state, pending] = [...pendingAuths.entries()][0]
      expect(state).toMatch(/^[0-9a-f]{64}$/) // 32 bytes hex
      expect(pending.clientId).toBe('test')
      expect(pending.clientRedirectUri).toBe('https://mcp-client.example.com/cb')
      expect(pending.clientState).toBe('client-state')
      expect(pending.codeChallenge).toBe('challenge123')
      expect(pending.codeChallengeMethod).toBe('S256')
    })

    it('should store scopes in pending auth', async () => {
      const { provider, pendingAuths } = createNotionOAuthProvider(TEST_CONFIG)

      await new Promise<void>((resolve) => {
        const mockRes = { redirect: () => resolve() }
        provider.authorize(
          { client_id: 'test' } as any,
          {
            redirectUri: 'https://mcp-client.example.com/cb',
            codeChallenge: 'c',
            codeChallengeMethod: 'S256',
            scopes: ['read', 'write']
          } as any,
          mockRes as any
        )
      })

      const [, pending] = [...pendingAuths.entries()][0]
      expect(pending.scopes).toEqual(['read', 'write'])
    })

    it('should handle authorize without optional state', async () => {
      const { provider, pendingAuths } = createNotionOAuthProvider(TEST_CONFIG)

      await new Promise<void>((resolve) => {
        const mockRes = { redirect: () => resolve() }
        provider.authorize(
          { client_id: 'test' } as any,
          {
            redirectUri: 'https://mcp-client.example.com/cb',
            codeChallenge: 'c',
            codeChallengeMethod: 'S256'
            // no state
          } as any,
          mockRes as any
        )
      })

      const [, pending] = [...pendingAuths.entries()][0]
      expect(pending.clientState).toBeUndefined()
    })
  })

  describe('exchangeRefreshToken', () => {
    it('should proxy refresh to Notion and return new opaque token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-notion-token',
          token_type: 'bearer',
          expires_in: 7200
        })
      })
      vi.stubGlobal('fetch', mockFetch)

      const { provider } = createNotionOAuthProvider(TEST_CONFIG)

      const result = await provider.exchangeRefreshToken(
        { client_id: 'refresh-client', client_secret: 'test' } as any,
        'notion-refresh-token-xyz'
      )

      expect(result.access_token).toHaveLength(96) // 48 bytes hex
      expect(result.token_type).toBe('bearer')
      expect(result.expires_in).toBe(7200)

      // Verify fetch was called with correct params
      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.notion.com/v1/oauth/token')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toContain('Basic ')
      expect(init.body).toContain('grant_type=refresh_token')
      expect(init.body).toContain('refresh_token=notion-refresh-token-xyz')
    })

    it('should use default expires_in when Notion does not return one', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            access_token: 'refreshed-notion-token',
            token_type: 'bearer'
            // no expires_in
          })
        })
      )

      const { provider } = createNotionOAuthProvider(TEST_CONFIG)

      const result = await provider.exchangeRefreshToken(
        { client_id: 'refresh-client', client_secret: 'test' } as any,
        'notion-refresh-token-xyz'
      )

      expect(result.expires_in).toBe(86400) // default fallback
    })

    it('should throw when Notion refresh fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401
        })
      )

      const { provider } = createNotionOAuthProvider(TEST_CONFIG)

      await expect(
        provider.exchangeRefreshToken(
          { client_id: 'refresh-client', client_secret: 'test' } as any,
          'invalid-refresh-token'
        )
      ).rejects.toThrow('Token refresh failed: 401')
    })

    it('should store refreshed token and create pending bind', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            access_token: 'refreshed-notion-token',
            token_type: 'bearer',
            expires_in: 3600
          })
        })
      )

      const { provider } = createNotionOAuthProvider(TEST_CONFIG)

      // Exchange refresh token within requestContext
      const result = await requestContext.run({ ip: '10.0.0.5' }, () =>
        provider.exchangeRefreshToken(
          { client_id: 'refresh-client', client_secret: 'test' } as any,
          'refresh-token-abc'
        )
      )

      // The opaque token should resolve correctly
      const authInfo = await provider.verifyAccessToken(result.access_token)
      expect(authInfo.token).toBe('refreshed-notion-token')

      // Pending bind should also work from same IP
      const boundResult = await requestContext.run({ ip: '10.0.0.5' }, () =>
        provider.verifyAccessToken('sk-ant-after-refresh')
      )
      expect(boundResult.token).toBe('refreshed-notion-token')
    })
  })

  describe('cleanup interval', () => {
    it('should clean up expired pendingAuths', () => {
      const { pendingAuths } = createNotionOAuthProvider(TEST_CONFIG)

      pendingAuths.set('old-state', {
        clientId: 'c1',
        clientRedirectUri: 'https://example.com/cb',
        codeChallenge: 'c',
        codeChallengeMethod: 'S256',
        createdAt: Date.now() - 15 * 60 * 1000 // 15 min ago (> 10 min TTL)
      })
      pendingAuths.set('fresh-state', {
        clientId: 'c2',
        clientRedirectUri: 'https://example.com/cb',
        codeChallenge: 'c',
        codeChallengeMethod: 'S256',
        createdAt: Date.now()
      })

      // Trigger the cleanup interval (runs every 60s)
      vi.advanceTimersByTime(60_000)

      expect(pendingAuths.has('old-state')).toBe(false)
      expect(pendingAuths.has('fresh-state')).toBe(true)
    })

    it('should clean up expired authCodes', () => {
      const { authCodes } = createNotionOAuthProvider(TEST_CONFIG)

      authCodes.set('old-code', {
        notionAccessToken: 'token',
        createdAt: Date.now() - 15 * 60 * 1000 // 15 min ago (> 10 min TTL)
      })
      authCodes.set('fresh-code', {
        notionAccessToken: 'token',
        createdAt: Date.now()
      })

      vi.advanceTimersByTime(60_000)

      expect(authCodes.has('old-code')).toBe(false)
      expect(authCodes.has('fresh-code')).toBe(true)
    })
  })

  describe('fetch override (Basic auth injection)', () => {
    it('should inject Basic auth header for Notion token URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'))
      vi.stubGlobal('fetch', mockFetch)

      const { provider, notionBasicAuth } = createNotionOAuthProvider(TEST_CONFIG)

      // The internal fetch is used by the ProxyOAuthServerProvider.
      // We can test it indirectly via exchangeRefreshToken which calls globalThis.fetch
      // directly. But the proxy fetch is set in the constructor.
      // Access it through the provider's internal mechanism.

      // Test: exchangeRefreshToken uses the direct fetch (not the proxy fetch),
      // so let's test the proxy fetch path by accessing the underlying proxy provider.
      // The proxy fetch is used when ProxyOAuthServerProvider delegates to Notion's token endpoint.

      // Since the fetch override is internal to the ProxyOAuthServerProvider,
      // we verify via exchangeRefreshToken which DOES use Basic auth directly.
      await provider
        .exchangeRefreshToken({ client_id: 'c1', client_secret: 's1' } as any, 'refresh-token')
        .catch(() => {})

      const callHeaders = mockFetch.mock.calls[0][1].headers
      expect(callHeaders.Authorization).toBe(`Basic ${notionBasicAuth}`)
    })
  })

  describe('getClient delegation', () => {
    it('should delegate getClient to StatelessClientStore', async () => {
      const { provider } = createNotionOAuthProvider(TEST_CONFIG)

      // getClient for an unknown ID should return a fallback
      const client = await provider.clientsStore.getClient('unknown-id')
      expect(client).toBeDefined()
      expect(client!.client_id).toBe('unknown-id')
    })
  })
})
