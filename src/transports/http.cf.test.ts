import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
