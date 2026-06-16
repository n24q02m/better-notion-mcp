/**
 * KV write-through per-sub Notion access token store (Cloudflare deploy).
 *
 * In-memory Map is a read cache; the durable layer is Workers KV reached via the
 * Worker's kv.internal outbound handler (MCP_KV_BASE_URL). The token is embedded
 * in a per-(plugin, sub) config blob encrypted by mcp-core's PerPluginStore
 * (AES-256-GCM) before it hits KV -- this module NEVER re-implements crypto.
 * Selecting this store (cf-kv backend) is what makes the Notion token survive
 * container delete+recreate; the in-memory-only path is for stdio/local self-host.
 *
 * PerPluginStore stores ONE config blob per (plugin, sub) at
 * `better-notion/subs/<sub>/config` (there is no per-token sub-namespace), so the
 * token lives INSIDE that blob as { access_token }.
 */
import { backendFromEnv, CfKvBackend, PerPluginStore } from '@n24q02m/mcp-core/storage'
import type { NotionTokenStoreLike } from './notion-token-store.js'

const PLUGIN_NAME = 'better-notion'

// Minimal structural shape of mcp-core's injectable Http (storage/backends.ts):
// request(method, url, data?, headers?) -> { status, body }. Declared locally so
// the module does not depend on Http being re-exported from the package subpath.
interface KvHttp {
  request(
    method: string,
    url: string,
    data?: Uint8Array | Buffer,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: Uint8Array | Buffer }>
}

interface KvNotionTokenStoreOptions {
  // Injectable Http for CfKvBackend (tests). Production: backendFromEnv() builds
  // a CfKvBackend from MCP_STORAGE_BACKEND=cf-kv + MCP_KV_BASE_URL.
  http?: KvHttp
}

export class KvNotionTokenStore implements NotionTokenStoreLike {
  private cache = new Map<string, string>()
  private backend: CfKvBackend | ReturnType<typeof backendFromEnv>

  constructor(opts: KvNotionTokenStoreOptions = {}) {
    // CfKvBackend is positional: (baseUrl, token?, http?). No KV bearer token is
    // needed here (the Worker's kv.internal handler authorizes via the binding),
    // so pass undefined for token and inject http for tests.
    this.backend = opts.http
      ? new CfKvBackend(process.env.MCP_KV_BASE_URL ?? 'http://kv.internal', undefined, opts.http as never)
      : backendFromEnv()
  }

  // PerPluginStore is scoped to (plugin, sub) by its constructor and keyed at
  // `better-notion/subs/<sub>/config`. Three positional args: (pluginName, sub,
  // backend) -- there is NO 4th subkey arg.
  private storeFor(sub: string): PerPluginStore {
    return new PerPluginStore(PLUGIN_NAME, sub, this.backend)
  }

  async save(sub: string, accessToken: string): Promise<void> {
    this.cache.set(sub, accessToken)
    // Token embedded in the (plugin, sub) config blob; save() takes the payload.
    await this.storeFor(sub).save({ access_token: accessToken })
  }

  // Sync cache read (hot path: factory called per tool invocation). A KV miss is
  // resolved by getAsync() on the auth path, which warms the cache.
  get(sub: string): string | undefined {
    return this.cache.get(sub)
  }

  async getAsync(sub: string): Promise<string | undefined> {
    const cached = this.cache.get(sub)
    if (cached !== undefined) return cached
    try {
      // load() returns Record<string, unknown> | null (the decrypted config blob).
      const data = (await this.storeFor(sub).load()) as { access_token?: string } | null
      const token = data?.access_token
      if (token) {
        this.cache.set(sub, token)
        return token
      }
    } catch {
      // corrupt/absent blob -> treat as no token (triggers re-auth), never throw.
    }
    return undefined
  }

  async clear(sub: string): Promise<void> {
    this.cache.delete(sub)
    // PerPluginStore has no delete(); clear() takes no args (the instance is
    // already scoped to this sub via storeFor) and removes the (plugin, sub) blob.
    await this.storeFor(sub).clear()
  }

  // Startup readiness probe: confirm the container -> Worker `kv.internal`
  // outbound path is wired BEFORE the first credential write. Hits the Worker's
  // kvOutbound `__ready` branch (reserved key, returns 200) via the backend; a
  // broken outbound interception makes the underlying fetch to kv.internal fail
  // (NXDOMAIN / connection refused) and this throws, so the HTTP transport can
  // log it loudly at startup instead of losing the first token write silently.
  async ready(): Promise<void> {
    await this.backend.get('__ready')
  }
}
