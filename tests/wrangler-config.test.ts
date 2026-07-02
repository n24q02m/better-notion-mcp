import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Minimal JSONC strip (line + block comments) for the test only.
function readJsonc(path: string): Record<string, any> {
  const raw = readFileSync(path, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
  return JSON.parse(raw)
}

describe('wrangler.jsonc', () => {
  const cfg = readJsonc('wrangler.jsonc')

  it('binds the NotionContainer DO', () => {
    expect(cfg.durable_objects.bindings[0].class_name).toBe('NotionContainer')
    expect(cfg.durable_objects.bindings[0].name).toBe('NOTION')
  })

  it('declares a KV namespace and NO D1 / Vectorize (KV-only)', () => {
    expect(cfg.kv_namespaces[0].binding).toBe('KV')
    expect(cfg.d1_databases).toBeUndefined()
    expect(cfg.vectorize).toBeUndefined()
  })

  it('forces http transport + PORT=8080 + cf-kv storage into the container', () => {
    expect(cfg.vars.MCP_TRANSPORT).toBe('http')
    expect(cfg.vars.PORT).toBe('8080')
    expect(cfg.vars.MCP_STORAGE_BACKEND).toBe('cf-kv')
    expect(cfg.vars.MCP_KV_BASE_URL).toBe('http://kv.internal')
  })

  it('binds the container to 0.0.0.0 (TS mcp-core defaults to 127.0.0.1, unreachable on CF)', () => {
    expect(cfg.vars.HOST).toBe('0.0.0.0')
  })

  it('pulls the image from the CF managed registry (not ghcr.io)', () => {
    expect(cfg.containers[0].image).toContain('registry.cloudflare.com/')
    expect(cfg.containers[0].image).not.toContain('ghcr.io')
  })

  it('keeps the route as a BYO placeholder (never hardcodes a real custom domain)', () => {
    expect(cfg.routes[0].pattern).toBe('<YOUR_WORKER_DOMAIN>')
    expect(cfg.routes[0].custom_domain).toBe(true)
  })

  it('never enables MCP_AUTH_DISABLE in vars (anonymous-bucket-collapse guard)', () => {
    expect(cfg.vars.MCP_AUTH_DISABLE).toBeUndefined()
  })
})
