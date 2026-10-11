import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NotionTokenStore } from '../auth/notion-token-store.js'
import { deriveSubject } from './http.js'

describe('CREDENTIAL_SECRET -> EdDSA signing (deterministic, no-disk)', () => {
  it('JWTIssuer selects EdDSA when CREDENTIAL_SECRET is set, RS256 when unset', async () => {
    const { JWTIssuer } = await import('@n24q02m/mcp-core')
    const withSecret = new JWTIssuer('better-notion-mcp', undefined, 'test-secret')
    const withoutSecret = new JWTIssuer('better-notion-mcp', undefined, null)
    expect(withSecret.alg).toBe('EdDSA')
    expect(withoutSecret.alg).toBe('RS256')
  })

  it('two issuers from the same CREDENTIAL_SECRET converge on the same signing key (survives recreate)', async () => {
    const { JWTIssuer } = await import('@n24q02m/mcp-core')
    const a = new JWTIssuer('better-notion-mcp', undefined, 'stable-secret')
    await a.init()
    const token = await a.issueAccessToken('user@example.com')
    // simulate container recreate: a fresh issuer derived from the same secret
    const b = new JWTIssuer('better-notion-mcp', undefined, 'stable-secret')
    await b.init()
    const payload = await b.verifyAccessToken(token)
    expect(payload.sub).toBe('user@example.com')
  })

  it('http transport documents the CREDENTIAL_SECRET requirement for EdDSA', () => {
    const src = readFileSync('src/transports/http.ts', 'utf-8')
    expect(src).toContain('CREDENTIAL_SECRET')
  })
})

describe('per-sub token isolation (anonymous-bucket-collapse guard)', () => {
  it('distinct JWT subs keep distinct Notion tokens (no bleed)', () => {
    const store = new NotionTokenStore()
    store.save('alice', 'ntn_alice')
    store.save('bob', 'ntn_bob')
    expect(store.get('alice')).toBe('ntn_alice')
    expect(store.get('bob')).toBe('ntn_bob')
    expect(store.get('alice')).not.toBe(store.get('bob'))
  })
})

describe('deriveSubject (Notion token response -> JWT sub, per-sub isolation)', () => {
  it('prefers owner.user.id (the human user)', () => {
    expect(deriveSubject({ owner: { user: { id: 'usr-1' } }, workspace_id: 'ws-1', bot_id: 'bot-1' })).toBe('usr-1')
  })

  it('falls back to workspace_id, then bot_id', () => {
    expect(deriveSubject({ workspace_id: 'ws-1', bot_id: 'bot-1' })).toBe('ws-1')
    expect(deriveSubject({ bot_id: 'bot-1' })).toBe('bot-1')
  })

  it('never reads the (non-existent) owner_user_id field', () => {
    // Guards the prior bug: Notion has no owner_user_id, so reading it collapsed
    // every caller onto the shared 'default' bucket (isolation loss).
    expect(deriveSubject({ owner_user_id: 'ghost' } as Record<string, unknown>)).toBe('default')
  })

  it('returns the default bucket only for a malformed response', () => {
    expect(deriveSubject({ access_token: 'x' })).toBe('default')
  })
})
