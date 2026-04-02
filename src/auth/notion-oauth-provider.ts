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

/** Resolve a bearer token to a Notion access token */
function resolveNotionToken(
  bearerToken: string,
  notionTokens: Map<string, StoredNotionToken>,
  boundTokens: Map<string, StoredNotionToken>,
  pendingBinds: Map<string, { notionToken: StoredNotionToken; expiresAt: number; sourceIp?: string }>
): string | undefined {
  // 1. Direct lookup by our opaque access token
  const byToken = notionTokens.get(bearerToken)
  if (byToken) return byToken.notionAccessToken

  // 2. Previously bound external token (e.g., Claude Code's sk-ant-*)
  const bound = boundTokens.get(bearerToken)
  if (bound) return bound.notionAccessToken

  // 3. One-shot pending bind — claim the first available unexpired slot.
  const now = Date.now()
  const claimIp = requestContext.getStore()?.ip
  for (const [clientId, pending] of pendingBinds) {
    if (now > pending.expiresAt) {
      pendingBinds.delete(clientId)
      continue
    }
    // Strict IP check: both IPs must be known and must match.
    if (!pending.sourceIp || !claimIp || pending.sourceIp !== claimIp) {
      continue
    }
    // Consume the pending bind — one-shot, no other token can claim this
    pendingBinds.delete(clientId)
    boundTokens.set(bearerToken, pending.notionToken)
    return pending.notionToken.notionAccessToken
  }
  return undefined
}

async function verifyAccessToken(
  token: string,
  config: NotionOAuthConfig,
  notionTokens: Map<string, StoredNotionToken>,
  boundTokens: Map<string, StoredNotionToken>,
  pendingBinds: Map<string, { notionToken: StoredNotionToken; expiresAt: number; sourceIp?: string }>,
  verifyCache: Map<string, { expiresAt: number; userId: string; userName: string | null }>
) {
  const notionToken = resolveNotionToken(token, notionTokens, boundTokens, pendingBinds)
  if (!notionToken) {
    throw new InvalidTokenError('No Notion token found. Please re-authenticate.')
  }

  const cached = verifyCache.get(notionToken)
  if (cached && Date.now() < cached.expiresAt) {
    return {
      token: notionToken,
      clientId: config.notionClientId,
      scopes: ['notion:read', 'notion:write'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { userId: cached.userId, userName: cached.userName }
    }
  }

  try {
    const notion = new Client({ auth: notionToken, notionVersion: '2025-09-03' })
    const me = await notion.users.me({})
    verifyCache.set(notionToken, {
      expiresAt: Date.now() + VERIFY_CACHE_TTL,
      userId: me.id,
      userName: me.name
    })

    return {
      token: notionToken,
      clientId: config.notionClientId,
      scopes: ['notion:read', 'notion:write'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { userId: me.id, userName: me.name }
    }
  } catch {
    verifyCache.delete(notionToken)
    throw new InvalidTokenError('Invalid or expired Notion token')
  }
}

async function exchangeAuthorizationCode(
  client: { client_id: string },
  authorizationCode: string,
  codeVerifier: string | undefined,
  authCodes: Map<string, StoredAuthCode>,
  notionTokens: Map<string, StoredNotionToken>,
  pendingBinds: Map<string, { notionToken: StoredNotionToken; expiresAt: number; sourceIp?: string }>
) {
  const stored = authCodes.get(authorizationCode)
  if (!stored) throw new InvalidTokenError('Invalid or expired authorization code')
  if (stored.clientId && stored.clientId !== client.client_id) {
    throw new InvalidTokenError('Auth code was not issued to this client')
  }

  if (stored.codeChallenge && stored.codeChallengeMethod === 'S256') {
    if (!codeVerifier) throw new InvalidTokenError('code_verifier is required')
    const expectedChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const expectedBuffer = Buffer.from(expectedChallenge, 'utf8')
    const storedBuffer = Buffer.from(stored.codeChallenge, 'utf8')
    if (expectedBuffer.byteLength !== storedBuffer.byteLength || !timingSafeEqual(expectedBuffer, storedBuffer)) {
      throw new InvalidTokenError('code_verifier does not match the challenge')
    }
  }

  authCodes.delete(authorizationCode)
  const opaqueToken = randomBytes(48).toString('hex')
  const entry: StoredNotionToken = { notionAccessToken: stored.notionAccessToken, createdAt: Date.now() }
  notionTokens.set(opaqueToken, entry)
  pendingBinds.set(client.client_id, {
    notionToken: entry,
    expiresAt: Date.now() + PENDING_BIND_TTL,
    sourceIp: requestContext.getStore()?.ip
  })

  return { access_token: opaqueToken, token_type: 'bearer', expires_in: 86400 }
}

async function exchangeRefreshToken(
  client: { client_id: string },
  refreshToken: string,
  notionBasicAuth: string,
  notionTokens: Map<string, StoredNotionToken>,
  pendingBinds: Map<string, { notionToken: StoredNotionToken; expiresAt: number; sourceIp?: string }>
) {
  const params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  const response = await globalThis.fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${notionBasicAuth}` },
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
  const entry: StoredNotionToken = { notionAccessToken: data.access_token, createdAt: Date.now() }
  notionTokens.set(opaqueToken, entry)
  pendingBinds.set(client.client_id, {
    notionToken: entry,
    expiresAt: Date.now() + PENDING_BIND_TTL,
    sourceIp: requestContext.getStore()?.ip
  })

  return { access_token: opaqueToken, token_type: 'bearer', expires_in: data.expires_in ?? 86400 }
}

/** Cleanup expired entries periodically */
function startCleanupInterval(
  pendingAuths: Map<string, PendingAuth>,
  authCodes: Map<string, StoredAuthCode>,
  notionTokens: Map<string, StoredNotionToken>,
  pendingBinds: Map<string, { notionToken: StoredNotionToken; expiresAt: number; sourceIp?: string }>,
  boundTokens: Map<string, StoredNotionToken>,
  verifyCache: Map<string, { expiresAt: number; userId: string; userName: string | null }>
) {
  return setInterval(() => {
    const now = Date.now()
    for (const [key, val] of pendingAuths) {
      if (now - val.createdAt > PENDING_AUTH_TTL) pendingAuths.delete(key)
    }
    for (const [key, val] of authCodes) {
      if (now - val.createdAt > AUTH_CODE_TTL) authCodes.delete(key)
    }
    for (const [key, val] of notionTokens) {
      if (now - val.createdAt > NOTION_TOKEN_TTL) notionTokens.delete(key)
    }
    for (const [key, val] of pendingBinds) {
      if (now > val.expiresAt) pendingBinds.delete(key)
    }
    for (const [key, val] of boundTokens) {
      if (now - val.createdAt > NOTION_TOKEN_TTL) boundTokens.delete(key)
    }
    for (const [key, val] of verifyCache) {
      if (now > val.expiresAt) verifyCache.delete(key)
    }
  }, 60_000)
}

/**
 * Creates a ProxyOAuthServerProvider that delegates OAuth to Notion
 * with a callback relay pattern.
 */
export function createNotionOAuthProvider(config: NotionOAuthConfig) {
  const clientStore = new StatelessClientStore(config.dcrSecret)
  const callbackUrl = `${config.publicUrl}/callback`
  const notionBasicAuth = Buffer.from(`${config.notionClientId}:${config.notionClientSecret}`).toString('base64')

  const pendingAuths = new Map<string, PendingAuth>()
  const authCodes = new Map<string, StoredAuthCode>()
  const notionTokens = new Map<string, StoredNotionToken>()
  const boundTokens = new Map<string, StoredNotionToken>()
  const verifyCache = new Map<string, { expiresAt: number; userId: string; userName: string | null }>()
  const pendingBinds = new Map<string, { notionToken: StoredNotionToken; expiresAt: number; sourceIp?: string }>()

  const provider = new ProxyOAuthServerProvider({
    endpoints: { authorizationUrl: NOTION_AUTH_URL, tokenUrl: NOTION_TOKEN_URL },
    verifyAccessToken: (token) =>
      verifyAccessToken(token, config, notionTokens, boundTokens, pendingBinds, verifyCache),
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
  Object.defineProperty(provider, 'clientsStore', { get: () => clientStore })

  provider.authorize = async (client, params, res) => {
    const ourState = randomBytes(32).toString('hex')
    pendingAuths.set(ourState, {
      clientId: client.client_id,
      clientRedirectUri: params.redirectUri,
      clientState: params.state,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      scopes: params.scopes,
      createdAt: Date.now()
    })

    const notionUrl = new URL(NOTION_AUTH_URL)
    notionUrl.searchParams.set('client_id', config.notionClientId)
    notionUrl.searchParams.set('response_type', 'code')
    notionUrl.searchParams.set('redirect_uri', callbackUrl)
    notionUrl.searchParams.set('state', ourState)
    notionUrl.searchParams.set('owner', 'user')
    res.redirect(notionUrl.toString())
  }

  provider.exchangeAuthorizationCode = (client, authorizationCode, codeVerifier) =>
    exchangeAuthorizationCode(client, authorizationCode, codeVerifier, authCodes, notionTokens, pendingBinds)

  provider.exchangeRefreshToken = (client, refreshToken) =>
    exchangeRefreshToken(client, refreshToken, notionBasicAuth, notionTokens, pendingBinds)

  startCleanupInterval(pendingAuths, authCodes, notionTokens, pendingBinds, boundTokens, verifyCache)

  return { provider, clientStore, pendingAuths, authCodes, callbackUrl, notionBasicAuth }
}
