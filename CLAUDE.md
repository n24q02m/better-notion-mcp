# better-notion-mcp

TypeScript MCP Server cho Notion API. 11 composite tools (pages, databases, blocks, users, workspace, comments, content_convert, file_uploads, config, config__open_relay, help), dual-mode stdio/http.
Xem `AGENTS.md` va `README.md` de hieu architecture va OAuth flow.

## Cau truc

- `src/init-server.ts` -- Transport selector; delegates to `main.ts`
- `src/main.ts` -- Server entry point: stdio (NOTION_TOKEN required) or http
- `src/credential-state.ts` -- Single-user token resolution + per-JWT-sub resolver hook
- `src/relay-schema.ts` -- Relay form schema (Notion token field)
- `src/create-server.ts` -- MCP server factory (used by http mode)
- `src/tools/registry.ts` -- Tool registration + routing
- `src/tools/composite/` -- 1 file per domain (pages, databases, blocks, comments, users, workspace, content, file-uploads, config)
- `src/tools/helpers/` -- errors, markdown, richtext, pagination, properties, covers, icons, id, security
- `src/auth/` -- `notion-token-store.ts` (in-memory per-JWT-sub access token map)
- `src/transports/http.ts` -- HTTP (remote-oauth multi-user) transport
- `src/docs/` -- Markdown docs served as MCP resources
- Tests: co-located (`*.test.ts` canh `*.ts`)

## Lenh thuong dung

```bash
bun install                 # Cai dependencies
bun run build               # tsc --build && esbuild CLI bundle
bun run check               # Biome check + tsc --noEmit (CI command)
bun run check:fix           # Auto-fix Biome + type check
bun run test                # vitest (KHONG BAO GIO dung bare "bun test")
bun run test:watch          # vitest watch
bun run test:coverage       # vitest --coverage
bun run lint                # biome lint src
bun run format              # biome format --write .
bun run type-check          # tsc --noEmit
bun run dev                 # tsx watch dev server (stdio)
bun run dev:http            # tsx watch dev server (http mode)

# Test don le
bun x vitest run src/tools/helpers/errors.test.ts
bun x vitest run -t "test name pattern"

# Mise shortcuts
mise run setup              # Full dev env setup
mise run lint               # bun run check
mise run test               # bun run test
mise run fix                # bun run check:fix
```

## Cau hinh

- Node.js >= 24, bun, ESM (`"type": "module"`)
- TypeScript: strict, target es2021, module es2022, moduleResolution Bundler
- Biome: 2 spaces, line width 120, single quotes, semicolons as needed, trailing commas none
- **LUON dung `.js` extension** trong import paths (ESM requirement)

## Env vars

- **stdio mode** (default): `NOTION_TOKEN` (bat buoc; stdio fails fast if unset, see `main.ts:76`)
- **http mode** (opt-in via `--http`, `MCP_TRANSPORT=http`, or `TRANSPORT_MODE=http`): `NOTION_OAUTH_CLIENT_ID` + `NOTION_OAUTH_CLIENT_SECRET` (bat buoc, validated `transports/http.ts:51-53`), `PUBLIC_URL` (OAuth redirect URLs), `MCP_AUTH_DISABLE=1` (optional, skip Bearer JWT verification behind external gateway)
- `PORT` (default `0` = OS-assigned random port), `HOST` (optional bind address)
- Secrets: skret SSM namespace `/better-notion-mcp/prod` (region `ap-southeast-1`)

## Release & Deploy

- Conventional Commits. Tag format: `v{version}` (config: `semantic-release.toml`)
- CD: workflow_dispatch, chon beta/stable
- Pipeline: PSR v10 -> npm publish (`@n24q02m/better-notion-mcp`) -> Docker multi-arch (amd64 + arm64) -> DockerHub + GHCR -> MCP Registry
- OCI VM deploy: Docker Compose + Watchtower. Prod `:latest` 0.125G, Staging `:beta` 0.0625G
- Domain: `better-notion-mcp.n24q02m.com` (prod), `better-notion-mcp-staging.n24q02m.com` (staging)

## Pre-commit hooks

1. `biome check --write` (lint + format)
2. `tsc --noEmit` (type check)
3. `bun run test` (vitest)
4. Commit message: enforce `feat`/`fix` prefix

## Luu y quan trong

- KHONG dung bare `bun test` -- phai dung `bun run test` (de vitest chay dung)
- Composite/Mega Tool pattern: input `{ action, ...params }`, dispatch via `switch(input.action)`
- Moi composite tool export: 1 async function + 1 interface
- Signature: `async function toolName(notion: Client, input: TypedInput): Promise<any>`
- `noExplicitAny`: off (Notion API responses dung `any`)
- Error handling: `NotionMCPError` + `withErrorHandling()` HOF wrapper
- `import type` dung rieng biet cho type imports
- Node builtins phai co `node:` prefix (`node:fs`, `node:path`)
- SDK pin `@modelcontextprotocol/sdk` v1.x -- v2 removes server-side OAuth
- Notion API bug: `comments.list` tra 404 voi OAuth tokens tren API version `2025-09-03`

## Modes

Two transports, selected in `init-server.ts:14-15` (delegated to `main.ts`). There is no `MCP_MODE` env var; the old `local-relay` / `remote-oauth` distinction was removed (see `transports/http.ts:4-9`).

- **stdio (default)**: MCP SDK `StdioServerTransport` directly. Single-user; requires `NOTION_TOKEN`. Fails fast with a stderr message if the token is unset (`main.ts:76-91`). No local relay spawn.
- **http (opt-in)**: enabled via `--http`, `MCP_TRANSPORT=http`, or `TRANSPORT_MODE=http`. Always delegated OAuth 2.1 redirect flow to Notion at `https://api.notion.com/v1/oauth/authorize`. Requires `NOTION_OAUTH_CLIENT_ID` + `NOTION_OAUTH_CLIENT_SECRET`. Per-user access token stored in-process keyed by JWT `sub` (`auth/notion-token-store.ts`, in-memory `Map`). Multi-user. Deploy at `https://better-notion-mcp.n24q02m.com`.

## Config storage path

TS servers (gồm better-notion-mcp) dùng `$APPDATA\mcp\Config\config.enc` — single shared encrypted store (`servers.<name>` section, machine-bound key) qua `@n24q02m/mcp-core/storage` `resolveConfig`/`deleteConfig`. Python servers (wet/mnemo/crg/imagine) dùng PerPluginStore `~/.<plugin>-mcp/config.json` (config.enc là legacy). Khi debug reset state, xóa `config.enc` của TS server.

## E2E

Driven by `mcp-core/scripts/e2e/` (matrix-locked, 15 configs). Run a single config from this repo via `make e2e` (proxy) or directly:

```
cd ../mcp-core && uv run --project scripts/e2e python -m e2e.driver <config-id>
```

Configs for this repo: `notion-paste-token`.

Note: ``notion-oauth`` reclassified out of T2 matrix 2026-04-27 — verify post-deploy via manual smoke against ``better-notion-mcp.n24q02m.com`` only.

Tier policy:

- **T0** (precommit + CI on PR / main push) - runs without upstream identity. Skret keys not required.
- **T2 non-interaction** (`make e2e-config CONFIG=<id>` locally) - driver pre-fills relay form from skret AWS SSM `/better-notion-mcp/prod` (`ap-southeast-1`). No user gate.
- **T2 interaction** - driver fills relay form, then prints upstream user-gate URL; user signs in / types OTP at provider. Driver enforces per-flow timeouts (device-code 900s, oauth-redirect 300s, browser-form 600s) and emits `[poll] elapsed=Xs remaining=Ys status=<body>` every 30s. On timeout, container logs + last `setup-status` are saved to `<tmp>/e2e-diag/` BEFORE teardown for post-mortem.

Multi-user remote mode (deployment property; not a separate config) requires `NOTION_OAUTH_CLIENT_ID` + `NOTION_OAUTH_CLIENT_SECRET` (validated at startup, `transports/http.ts:51-53`). Per-user access tokens are held in-process only (`auth/notion-token-store.ts`), so no credential-store encryption secret is needed.

References: `mcp-core/scripts/e2e/matrix.yaml`, `~/.claude/skills/mcp-dev/references/e2e-full-matrix.md` (harness-readiness gate), `~/.claude/skills/mcp-dev/references/secrets-skret.md` (per-server credential layout), `~/.claude/skills/mcp-dev/references/multi-user-pattern.md` (per-JWT-sub isolation).
