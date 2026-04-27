# better-notion-mcp

TypeScript MCP Server cho Notion API. 10 composite tools (pages, databases, blocks, users, workspace, comments, content_convert, file_uploads, setup, help), dual-mode stdio/http.
Xem `AGENTS.md` va `README.md` de hieu architecture va OAuth flow.

## Cau truc

- `src/init-server.ts` -- Server entry point, env validation
- `src/credential-state.ts` -- State machine (awaiting_setup/setup_in_progress/configured) + stdio fallback spawn (runLocalServer on 127.0.0.1:random)
- `src/relay-schema.ts` -- Relay form schema (Notion token field)
- `src/tools/registry.ts` -- Tool registration + routing
- `src/tools/composite/` -- 1 file per domain (pages, databases, blocks, comments, users, workspace, content_convert, file_uploads, setup)
- `src/tools/helpers/` -- errors, markdown, richtext, pagination, properties
- `src/auth/` -- OAuth 2.1 + PKCE, DCR, session management
- `src/transports/` -- stdio + http transport handlers
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

- **stdio mode** (default): `NOTION_TOKEN` (bat buoc)
- **http mode**: `TRANSPORT_MODE=http`, `PUBLIC_URL`, `NOTION_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_SECRET`, `DCR_SERVER_SECRET`
- `PORT` (default 8080)
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

## Modes (Phase L2 restored 2026-04-18)

Selected via `MCP_MODE` env var:

- **`remote-oauth` (default)**: HTTP + delegated OAuth 2.1 redirect flow tới Notion OAuth app tại `https://api.notion.com/v1/oauth/authorize`. Bắt buộc env `NOTION_OAUTH_CLIENT_ID` + `NOTION_OAUTH_CLIENT_SECRET`. Per-user access token lưu in-process keyed by JWT `sub` (= Notion `owner_user_id`). Multi-user thật — khác account OAuth độc lập. Deploy tại `https://better-notion-mcp.n24q02m.com`.
- **`local-relay`**: HTTP + `runLocalServer` với relaySchema — user paste Notion integration token vào `/authorize` form. Single-user, không external OAuth. Recommend cho local dev hoặc offline.
- **`stdio proxy`**: `--stdio` hoặc `MCP_TRANSPORT=stdio`. Backward compat.

Chuyển giữa remote-oauth ↔ local-relay qua `MCP_MODE=local-relay`/`MCP_MODE=remote-oauth`. Default = remote-oauth nếu không set.

## Stdio fallback

Khi stdio khởi động và `config.enc` trống, `credential-state.triggerRelaySetup()` spawn `runLocalServer` tại `http://127.0.0.1:<random_port>/` với `RELAY_SCHEMA` paste-token form. URL local được in ra stderr + tool response. Sau khi user paste token và submit, `onCredentialsSaved` callback:
1. Lưu vào `config.enc` qua `writeConfig`
2. Set `_state = 'configured'` + cache token in-memory
3. Schedule `handle.close()` sau 5s grace cho browser render "Connected"

**KHÔNG hit remote URL** (`https://better-notion-mcp.n24q02m.com`) trong fallback này — remote chỉ dùng khi user explicit chọn `MCP_MODE=remote-oauth`. Xem `~/.claude/skills/mcp-dev/references/mode-matrix.md` section `stdio proxy` cho canonical rule.

## Config storage path

TS servers dùng `$APPDATA\mcp\Config\config.enc` (khác Python servers `$LOCALAPPDATA\mcp\config.enc`). Khi debug, clean cả 2 paths nếu need reset state.

## E2E

Driven by `mcp-core/scripts/e2e/` (matrix-locked, 15 configs). Run a single config from this repo via `make e2e` (proxy) or directly:

```
cd ../mcp-core && uv run --project scripts/e2e python -m e2e.driver <config-id>
```

Configs for this repo: `notion-paste-token`.

Note: ``notion-oauth`` reclassified out of T2 matrix 2026-04-27 — verify post-deploy via manual smoke against ``notion-mcp.n24q02m.com`` only.

Tier policy:

- **T0** (precommit + CI on PR / main push) - runs without upstream identity. Skret keys not required.
- **T2 non-interaction** (`make e2e-config CONFIG=<id>` locally) - driver pre-fills relay form from skret AWS SSM `/better-notion-mcp/prod` (`ap-southeast-1`). No user gate.
- **T2 interaction** - driver fills relay form, then prints upstream user-gate URL; user signs in / types OTP at provider. Driver enforces per-flow timeouts (device-code 900s, oauth-redirect 300s, browser-form 600s) and emits `[poll] elapsed=Xs remaining=Ys status=<body>` every 30s. On timeout, container logs + last `setup-status` are saved to `<tmp>/e2e-diag/` BEFORE teardown for post-mortem.

Multi-user remote mode (deployment property; not a separate config) requires `MCP_DCR_SERVER_SECRET` in the same skret namespace - driver refuses to start the container without it when `PUBLIC_URL` is set.

References: `mcp-core/scripts/e2e/matrix.yaml`, `~/.claude/skills/mcp-dev/references/e2e-full-matrix.md` (harness-readiness gate), `~/.claude/skills/mcp-dev/references/secrets-skret.md` (per-server credential layout), `~/.claude/skills/mcp-dev/references/multi-user-pattern.md` (per-JWT-sub isolation).
