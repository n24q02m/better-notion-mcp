/**
 * Interface satisfied by both the in-memory NotionTokenStore (stdio / local
 * single-process) and the KV write-through KvNotionTokenStore (Cloudflare
 * deploy), so the HTTP transport can select either without branching on the
 * concrete type. `save`/`clear` allow an async return because the KV variant
 * writes through to Workers KV; the in-memory store satisfies it synchronously.
 */
export interface NotionTokenStoreLike {
  save(sub: string, accessToken: string): Promise<void> | void
  /**
   * Synchronous read of the in-memory cache only (hot path: the Notion client
   * factory runs per tool invocation). The durable KV variant returns the
   * cached value here; a cold cache after container recreate is warmed by
   * ``getAsync`` (called once per request in the HTTP transport's authScope).
   */
  get(sub: string): string | undefined
  /**
   * Read through to the durable layer, warming the cache on a hit. The
   * in-memory store has no durable layer so this resolves to the cached value.
   * The KV store loads + decrypts the per-(plugin, sub) blob from Workers KV,
   * which is what makes a token survive container delete+recreate.
   */
  getAsync(sub: string): Promise<string | undefined>
  clear(sub: string): Promise<void> | void
  /**
   * Optional durable-store readiness probe (KV deploy). When present, the HTTP
   * transport calls it at startup so a broken container -> Worker outbound path
   * surfaces in deploy logs instead of silently dropping the first token write.
   */
  ready?(): Promise<void>
}

/**
 * In-process per-user Notion access token store, keyed by JWT subject.
 *
 * Populated by the delegated OAuth `onTokenReceived` callback and consumed
 * by the Notion client factory on each MCP tool invocation. Tokens are
 * ephemeral (process lifetime only); refresh is handled by re-running the
 * delegated OAuth flow when a call returns 401.
 */
export class NotionTokenStore {
  private tokens = new Map<string, string>()

  save(sub: string, accessToken: string): void {
    this.tokens.set(sub, accessToken)
  }

  get(sub: string): string | undefined {
    return this.tokens.get(sub)
  }

  // No durable layer: the cache IS the source of truth, so getAsync just mirrors
  // the synchronous read (satisfies NotionTokenStoreLike uniformly).
  async getAsync(sub: string): Promise<string | undefined> {
    return this.tokens.get(sub)
  }

  clear(sub: string): void {
    this.tokens.delete(sub)
  }
}
