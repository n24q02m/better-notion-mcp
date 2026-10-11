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
