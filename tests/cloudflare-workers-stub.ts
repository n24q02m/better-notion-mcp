// Stub for the `cloudflare:workers` virtual module, which only exists inside the
// workerd runtime. The worker handler test runs in plain node, where importing
// `@cloudflare/containers` (the NotionContainer base) would otherwise fail to
// resolve `cloudflare:workers`.
export class DurableObject<Env = unknown> {
  protected ctx: unknown
  protected env: Env
  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx
    this.env = env
  }
}

export class WorkerEntrypoint<Env = unknown> {
  protected ctx: unknown
  protected env: Env
  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx
    this.env = env
  }
}
