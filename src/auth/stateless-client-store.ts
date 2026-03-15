import { createHmac } from 'node:crypto'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'

/**
 * Stateless HMAC-based Dynamic Client Registration (DCR) store.
 *
 * Instead of persisting registered clients in a database, this derives
 * deterministic client_id and client_secret from the registration input
 * using HMAC-SHA256. This means:
 *
 * - Same input always produces the same credentials (idempotent)
 * - Survives cold starts / server restarts without any storage
 * - Rotating the HMAC secret invalidates all existing registrations
 *
 * A warm cache (Map) stores registered client metadata (redirect_uris etc.)
 * so that getClient can return the full client info for authorize validation.
 * On cold start, clients re-register (instant, same credentials) to repopulate.
 */
export class StatelessClientStore implements OAuthRegisteredClientsStore {
  private cache = new Map<string, OAuthClientInformationFull>()

  constructor(private readonly secret: string) {}

  private deriveClientId(redirectUris: string[], clientName?: string): string {
    const input = JSON.stringify({ redirectUris, clientName })
    return createHmac('sha256', this.secret).update(`client_id:${input}`).digest('hex').slice(0, 32)
  }

  private deriveClientSecret(clientId: string): string {
    return createHmac('sha256', this.secret).update(`client_secret:${clientId}`).digest('hex')
  }

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    // Return cached client if available (has full metadata incl. redirect_uris)
    const cached = this.cache.get(clientId)
    if (cached) return cached

    // Fallback: derive secret only (redirect_uris unknown — client must re-register)
    const clientSecret = this.deriveClientSecret(clientId)
    return {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [],
      client_id_issued_at: 0,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post'
    } as OAuthClientInformationFull
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>
  ): OAuthClientInformationFull {
    const redirectUris = (client.redirect_uris ?? []).map(String)
    const clientId = this.deriveClientId(redirectUris, client.client_name)
    const clientSecret = this.deriveClientSecret(clientId)

    const registered = {
      ...client,
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000)
    } as OAuthClientInformationFull

    // Cache for getClient lookups (authorize flow needs redirect_uris)
    this.cache.set(clientId, registered)

    return registered
  }
}
