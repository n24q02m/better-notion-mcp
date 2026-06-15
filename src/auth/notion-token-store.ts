/**
 * Interface satisfied by both the in-memory NotionTokenStore (stdio / local
 * single-process) and the KV write-through KvNotionTokenStore (Cloudflare
 * deploy), so the HTTP transport can select either without branching on the
 * concrete type. `save`/`clear` allow an async return because the KV variant
 * writes through to Workers KV; the in-memory store satisfies it synchronously.
 */
export interface NotionTokenStoreLike {
  save(sub: string, accessToken: string): Promise<void> | void
  get(sub: string): string | undefined
  clear(sub: string): Promise<void> | void
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

  clear(sub: string): void {
    this.tokens.delete(sub)
  }
}
