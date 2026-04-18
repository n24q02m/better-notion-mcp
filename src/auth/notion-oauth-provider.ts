/**
 * Notion OAuth provider module.
 * Handles OAuth 2.1 flow with Notion, including token storage,
 * PKCE verification, and callback relay.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js'
import { Client } from '@notionhq/client'
import { NotionMCPError } from '../tools/helpers/errors.js'
import { StatelessClientStore } from './stateless-client-store.js'

/** Request context propagated via AsyncLocalStorage for IP-scoped pending binds */
export const requestContext = new AsyncLocalStorage<{ ip?: string }>()

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize'
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token'
const AUTH_CODE_TTL = 10 * 60 * 1000 // 10 minutes
const PENDING_AUTH_TTL = 10 * 60 * 1000 // 10 minutes
const NOTION_TOKEN_TTL = 24 * 60 * 60 * 1000 // 24 hours
const PENDING_BIND_TTL = 30 * 1000 // 30 seconds to claim a pending bind after OAuth
const VERIFY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache for token verification

export interface NotionOAuthConfig {
  notionClientId: string
  notionClientSecret: string
  dcrSecret: string
  publicUrl: string
}

interface PendingAuth {
  clientId: string
  clientRedirectUri: string
  clientState?: string
  codeChallenge: string
  codeChallengeMethod: string
  scopes?: string[]
  createdAt: number
}

interface StoredAuthCode {
  notionAccessToken: string
  notionRefreshToken?: string
  expiresIn?: number
  codeChallenge?: string
  codeChallengeMethod?: string
  clientId?: string
  createdAt: number
}

interface StoredNotionToken {
  notionAccessToken: string
  createdAt: number
}

/** Internal state for the Notion OAuth provider */
interface ProviderState {
  config: NotionOAuthConfig
  pendingAuths: Map<string, PendingAuth>
  authCodes: Map<string, StoredAuthCode>
  notionTokens: Map<string, StoredNotionToken>
  boundTokens: Map<string, StoredNotionToken>
  verifyCache: Map<string, { expiresAt: number; userId: string; userName: string | null }>
  pendingBinds: Map<string, { notionToken: StoredNotionToken; expiresAt: number; sourceIp?: string }>
  callbackUrl: string
  notionBasicAuth: string
}

/** Resolve a bearer token to a Notion access token */
function resolveNotionToken(bearerToken: string, state: ProviderState): string | undefined {
  // 1. Direct lookup by our opaque access token
  const byToken = state.notionTokens.get(bearerToken)
  if (byToken) return byToken.notionAccessToken

  // 2. Previously bound external token (e.g., Claude Code's sk-ant-*)
  const bound = state.boundTokens.get(bearerToken)
  if (bound) return bound.notionAccessToken

  // 3. One-shot pending bind - claim the first available unexpired slot.
  const now = Date.now()
  const claimIp = requestContext.getStore()?.ip
  for (const [clientId, pending] of state.pendingBinds) {
    if (now > pending.expiresAt) {
      state.pendingBinds.delete(clientId)
      continue
    }
    // Strict IP check: both IPs must be known and must match.
    if (!pending.sourceIp || !claimIp || pending.sourceIp !== claimIp) {
      continue
    }
    // Consume the pending bind - one-shot, no other token can claim this
    state.pendingBinds.delete(clientId)
    state.boundTokens.set(bearerToken, pending.notionToken)
    return pending.notionToken.notionAccessToken
  }
  return undefined
}

/** Verify an access token and return authentication info */
async function verifyAccessToken(token: string, state: ProviderState) {
  const notionToken = resolveNotionToken(token, state)
  if (!notionToken) {
    throw new InvalidTokenError('No Notion token found. Please re-authenticate.')
  }

  // Check verification cache
  const cached = state.verifyCache.get(notionToken)
  if (cached && Date.now() < cached.expiresAt) {
    return {
      token: notionToken,
      clientId: state.config.notionClientId,
      scopes: ['notion:read', 'notion:write'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { userId: cached.userId, userName: cached.userName }
    }
  }

  try {
    const notion = new Client({ auth: notionToken, notionVersion: '2025-09-03' })
    const me = await notion.users.me({})

    state.verifyCache.set(notionToken, {
      expiresAt: Date.now() + VERIFY_CACHE_TTL,
      userId: me.id,
      userName: me.name
    })

    return {
      token: notionToken,
      clientId: state.config.notionClientId,
      scopes: ['notion:read', 'notion:write'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { userId: me.id, userName: me.name }
    }
  } catch {
    state.verifyCache.delete(notionToken)
    throw new InvalidTokenError('Invalid or expired Notion token')
  }
}

/** Handle authorization request by redirecting to Notion */
async function authorize(client: any, params: any, res: any, state: ProviderState) {
  const ourState = randomBytes(32).toString('hex')

  state.pendingAuths.set(ourState, {
    clientId: client.client_id,
    clientRedirectUri: params.redirectUri,
    clientState: params.state,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: 'S256',
    scopes: params.scopes,
    createdAt: Date.now()
  })

  const notionUrl = new URL(NOTION_AUTH_URL)
  notionUrl.searchParams.set('client_id', state.config.notionClientId)
  notionUrl.searchParams.set('response_type', 'code')
  notionUrl.searchParams.set('redirect_uri', state.callbackUrl)
  notionUrl.searchParams.set('state', ourState)
  notionUrl.searchParams.set('owner', 'user')

  res.redirect(notionUrl.toString())
}

/** Exchange an authorization code for an opaque access token */
async function exchangeAuthorizationCode(
  client: any,
  authorizationCode: string,
  codeVerifier: string | undefined,
  state: ProviderState
) {
  const stored = state.authCodes.get(authorizationCode)
  if (!stored) {
    throw new InvalidTokenError('Invalid or expired authorization code')
  }

  if (stored.clientId && stored.clientId !== client.client_id) {
    throw new InvalidTokenError('Auth code was not issued to this client')
  }

  if (!stored.codeChallenge || stored.codeChallengeMethod !== 'S256') {
    throw new InvalidTokenError('PKCE code_challenge is required and method must be S256')
  }

  if (!codeVerifier) {
    throw new InvalidTokenError('code_verifier is required')
  }

  const expectedChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const expectedBuffer = Buffer.from(expectedChallenge, 'utf8')
  const storedBuffer = Buffer.from(stored.codeChallenge, 'utf8')

  if (expectedBuffer.byteLength !== storedBuffer.byteLength || !timingSafeEqual(expectedBuffer, storedBuffer)) {
    throw new InvalidTokenError('code_verifier does not match the challenge')
  }

  state.authCodes.delete(authorizationCode)

  const opaqueToken = randomBytes(48).toString('hex')
  const entry: StoredNotionToken = {
    notionAccessToken: stored.notionAccessToken,
    createdAt: Date.now()
  }

  state.notionTokens.set(opaqueToken, entry)

  state.pendingBinds.set(client.client_id, {
    notionToken: entry,
    expiresAt: Date.now() + PENDING_BIND_TTL,
    sourceIp: requestContext.getStore()?.ip
  })

  return {
    access_token: opaqueToken,
    token_type: 'bearer',
    expires_in: 86400
  }
}

/** Exchange a refresh token for a new opaque access token */
async function exchangeRefreshToken(client: any, refreshToken: string, state: ProviderState) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  })

  const response = await globalThis.fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${state.notionBasicAuth}`
    },
    body: params.toString()
  })

  if (!response.ok) {
    throw new NotionMCPError(
      `Token refresh failed: ${response.status}`,
      'AUTHENTICATION_ERROR',
      'Check OAuth token and scopes'
    )
  }

  const data = (await response.json()) as { access_token: string; token_type: string; expires_in?: number }

  const opaqueToken = randomBytes(48).toString('hex')
  const entry: StoredNotionToken = {
    notionAccessToken: data.access_token,
    createdAt: Date.now()
  }
  state.notionTokens.set(opaqueToken, entry)
  state.pendingBinds.set(client.client_id, {
    notionToken: entry,
    expiresAt: Date.now() + PENDING_BIND_TTL,
    sourceIp: requestContext.getStore()?.ip
  })

  return {
    access_token: opaqueToken,
    token_type: 'bearer',
    expires_in: data.expires_in ?? 86400
  }
}

/** Periodically clean up expired entries from state maps */
function setupCleanup(state: ProviderState) {
  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of state.pendingAuths) {
      if (now - val.createdAt > PENDING_AUTH_TTL) state.pendingAuths.delete(key)
    }
    for (const [key, val] of state.authCodes) {
      if (now - val.createdAt > AUTH_CODE_TTL) state.authCodes.delete(key)
    }
    for (const [key, val] of state.notionTokens) {
      if (now - val.createdAt > NOTION_TOKEN_TTL) state.notionTokens.delete(key)
    }
    for (const [key, val] of state.pendingBinds) {
      if (now > val.expiresAt) state.pendingBinds.delete(key)
    }
    for (const [key, val] of state.boundTokens) {
      if (now - val.createdAt > NOTION_TOKEN_TTL) state.boundTokens.delete(key)
    }
    for (const [key, val] of state.verifyCache) {
      if (now > val.expiresAt) state.verifyCache.delete(key)
    }
  }, 60_000)
}

/**
 * Creates a ProxyOAuthServerProvider that delegates OAuth to Notion
 * with a callback relay pattern.
 */
export function createNotionOAuthProvider(config: NotionOAuthConfig) {
  const callbackUrl = `${config.publicUrl.replace(/\/$/, '')}/callback`
  const notionBasicAuth = Buffer.from(`${config.notionClientId}:${config.notionClientSecret}`).toString('base64')
  const clientStore = new StatelessClientStore(config.dcrSecret)

  const state: ProviderState = {
    config,
    pendingAuths: new Map(),
    authCodes: new Map(),
    notionTokens: new Map(),
    boundTokens: new Map(),
    verifyCache: new Map(),
    pendingBinds: new Map(),
    callbackUrl,
    notionBasicAuth
  }

  const provider = new ProxyOAuthServerProvider({
    endpoints: {
      authorizationUrl: NOTION_AUTH_URL,
      tokenUrl: NOTION_TOKEN_URL
    },

    verifyAccessToken: async (token: string) => verifyAccessToken(token, state),

    getClient: async (clientId: string) => clientStore.getClient(clientId),

    fetch: async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as { url: string }).url
      if (urlStr === NOTION_TOKEN_URL) {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Basic ${notionBasicAuth}`)
        return globalThis.fetch(url as Parameters<typeof globalThis.fetch>[0], { ...init, headers })
      }
      return globalThis.fetch(url as Parameters<typeof globalThis.fetch>[0], init)
    }
  })

  provider.skipLocalPkceValidation = true

  Object.defineProperty(provider, 'clientsStore', {
    get: () => clientStore
  })

  provider.authorize = async (client, params, res) => authorize(client, params, res, state)

  provider.exchangeAuthorizationCode = async (client, code, verifier) =>
    exchangeAuthorizationCode(client, code, verifier, state)

  provider.exchangeRefreshToken = async (client, token) => exchangeRefreshToken(client, token, state)

  setupCleanup(state)

  return {
    provider,
    clientStore,
    pendingAuths: state.pendingAuths,
    authCodes: state.authCodes,
    callbackUrl,
    notionBasicAuth
  }
}
