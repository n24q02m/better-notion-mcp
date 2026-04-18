# better-notion-mcp

TypeScript MCP Server cho Notion API. 9 composite tools, dual-mode stdio/http.
Xem `AGENTS.md` va `README.md` de hieu architecture va OAuth flow.

## Cau truc

- `src/init-server.ts` -- Server entry point, env validation
- `src/relay-setup.ts` -- Zero-config relay: create session, poll for config
- `src/relay-schema.ts` -- Relay form schema (Notion token field)
- `src/tools/registry.ts` -- Tool registration + routing
- `src/tools/composite/` -- 1 file per domain (pages, databases, blocks, comments, users, workspace, content_convert, file_uploads)
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
- Infisical: project `eb2a1274-f333-4f5f-b3b9-42c525cec134`

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
