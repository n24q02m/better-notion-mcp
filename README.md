# Better Notion MCP

mcp-name: io.github.n24q02m/better-notion-mcp

**Markdown-first Notion for AI agents -- pages, databases, blocks, and comments in one call.**

<!-- Badge Row 1: Status -->
[![CI](https://github.com/n24q02m/better-notion-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/n24q02m/better-notion-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/n24q02m/better-notion-mcp/graph/badge.svg?token=D7FSDVVTAN)](https://codecov.io/gh/n24q02m/better-notion-mcp)
[![npm](https://img.shields.io/npm/v/@n24q02m/better-notion-mcp?logo=npm&logoColor=white)](https://www.npmjs.com/package/@n24q02m/better-notion-mcp)
[![Docker](https://img.shields.io/docker/v/n24q02m/better-notion-mcp?label=docker&logo=docker&logoColor=white&sort=semver)](https://hub.docker.com/r/n24q02m/better-notion-mcp)
[![License: MIT](https://img.shields.io/github/license/n24q02m/better-notion-mcp)](LICENSE)

<!-- Badge Row 2: Tech -->
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=nodedotjs&logoColor=white)](#)
[![Notion](https://img.shields.io/badge/Notion_API-000000?logo=notion&logoColor=white)](#)
[![semantic-release](https://img.shields.io/badge/semantic--release-e10079?logo=semantic-release&logoColor=white)](https://github.com/python-semantic-release/python-semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-1A1F6C?logo=renovatebot&logoColor=white)](https://developer.mend.io/)

<!-- BEGIN: AUTO-GENERATED-CROSS-PROMO -->
<details>
  <summary><strong>Sister projects from n24q02m</strong> (click to expand)</summary>

| Project | Tagline | Tag |
|---|---|---|
| [better-code-review-graph](https://github.com/n24q02m/better-code-review-graph) | Knowledge graph for token-efficient code reviews -- semantic search and call-... | MCP |
| [better-email-mcp](https://github.com/n24q02m/better-email-mcp) | IMAP/SMTP email for AI agents -- read, send, organize folders, and manage att... | MCP |
| [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) | Composite MCP server for Godot Engine -- 17 composite tools for AI-assisted g... | MCP |
| [better-notion-mcp](https://github.com/n24q02m/better-notion-mcp) | Markdown-first Notion for AI agents -- pages, databases, blocks, and comments... | MCP |
| [better-telegram-mcp](https://github.com/n24q02m/better-telegram-mcp) | Telegram for AI agents -- messages, chats, media, and contacts across both bo... | MCP |
| [claude-plugins](https://github.com/n24q02m/claude-plugins) | Claude Code plugin marketplace for the n24q02m MCP servers -- install web sea... | Marketplace |
| [imagine-mcp](https://github.com/n24q02m/imagine-mcp) | Image and video understanding + generation for AI agents -- across Gemini, Op... | MCP |
| [jules-task-archiver](https://github.com/n24q02m/jules-task-archiver) | Chrome Extension for bulk operations on Jules tasks via batchexecute API -- a... | Tooling |
| [mcp-core](https://github.com/n24q02m/mcp-core) | Shared foundation for building MCP servers -- Streamable HTTP transport, OAut... | MCP |
| [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) | Persistent AI memory with hybrid search and embedded sync. Open, free, unlimi... | MCP |
| [qwen3-embed](https://github.com/n24q02m/qwen3-embed) | Lightweight Qwen3 text embedding and reranking via ONNX Runtime and GGUF | Library |
| [skret](https://github.com/n24q02m/skret) | Secrets without the server. | CLI |
| [tacet](https://github.com/n24q02m/tacet) | TACET: a self-distilling neuro-symbolic cascade that amortises LLM cost in kn... | Tooling |
| [web-core](https://github.com/n24q02m/web-core) | Shared web infrastructure package for search, scraping, HTTP security, and st... | Library |
| [wet-mcp](https://github.com/n24q02m/wet-mcp) | Open-source MCP server for AI agents: web search, content extraction, and lib... | MCP |

</details>
<!-- END: AUTO-GENERATED-CROSS-PROMO -->

## Table of contents

- [Features](#features)
- [Install](#install)
- [Status](#status)
- [Documentation](#documentation)
- [Tools](#tools)
- [Configuration](#configuration)
- [Deploy to Cloudflare](#deploy-to-cloudflare)
- [Comparison](#comparison)
- [Security](#security)
- [Build from Source](#build-from-source)
- [Trust Model](#trust-model)
- [License](#license)



<a href="https://glama.ai/mcp/servers/n24q02m/better-notion-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/n24q02m/better-notion-mcp/badge" alt="Better Notion MCP server" />
</a>

## Features

- **Markdown in, Markdown out** -- human-readable content instead of raw JSON blocks
- **8 composite tools, 39 actions** -- one call instead of chaining 2+ atomic Notion endpoints (plus `config`, `help`, and a relay-setup tool)
- **Auto-pagination and bulk operations** -- no manual cursor handling or looping
- **Tiered token optimization** -- ~77% reduction via compressed descriptions + on-demand `help` tool
- **Dual transport** -- local stdio (integration token) or remote HTTP (OAuth 2.1, no token to paste)

## Install

Run with `npx` (Node.js >= 24) and a Notion integration token from <https://www.notion.so/my-integrations> (starts with `ntn_`):

```jsonc
// MCP client config (e.g. .mcp.json / Claude Code / Cursor)
{
  "mcpServers": {
    "better-notion-mcp": {
      "command": "npx",
      "args": ["--yes", "@n24q02m/better-notion-mcp@latest"],
      "env": { "NOTION_TOKEN": "ntn_your_token_here" }
    }
  }
}
```

Or run the published Docker image (stdio):

```bash
docker run --rm -i -e NOTION_TOKEN=ntn_your_token_here n24q02m/better-notion-mcp:latest
```

See the [Documentation](#documentation) section for per-client setup (Claude Code, Codex, Gemini CLI, Cursor, Windsurf) and HTTP/OAuth mode.

## Status

> **2026-05-02 -- Architecture stabilization update**
>
> Past months saw significant churn around credential handling and the daemon-bridge auto-spawn pattern. This caused multi-process races, browser tab spam, and inconsistent setup UX across plugins. **The architecture is now stable**: 2 clean modes (stdio + HTTP), no daemon-bridge layer, no auto-spawn from stdio.
>
> Apologies for the instability period. If you encountered issues with prior versions, please update to the latest release and follow the current [Setup guide](https://mcp.n24q02m.com/servers/better-notion-mcp/setup/) -- most prior workarounds are no longer needed.
>
> **Related plugins from the same author**:
> - [wet-mcp](https://github.com/n24q02m/wet-mcp) -- Web search + content extraction
> - [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) -- Persistent AI memory
> - [imagine-mcp](https://github.com/n24q02m/imagine-mcp) -- Image/video understanding + generation
> - [better-email-mcp](https://github.com/n24q02m/better-email-mcp) -- Email management
> - [better-telegram-mcp](https://github.com/n24q02m/better-telegram-mcp) -- Telegram
> - [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) -- Godot Engine
> - [better-code-review-graph](https://github.com/n24q02m/better-code-review-graph) -- Code review knowledge graph
>
> All plugins share the same architecture -- install once, learn pattern transfers.

## Documentation

Full docs at **[mcp.n24q02m.com/servers/better-notion-mcp/](https://mcp.n24q02m.com/servers/better-notion-mcp/)**:

- [Setup](https://mcp.n24q02m.com/servers/better-notion-mcp/setup/) -- install methods for Claude Code, Codex, Gemini CLI, Cursor, Windsurf, mcp.json
- [Modes overview](https://mcp.n24q02m.com/get-started/modes-overview/) -- stdio (local, integration token) and HTTP (remote, OAuth 2.1)
- [Multi-user setup](https://mcp.n24q02m.com/get-started/multi-user/) -- per-JWT-sub credential model (HTTP mode)

**Install with AI agent** -- paste this to your AI coding agent:

> Install MCP server `better-notion-mcp` following the steps at
> https://raw.githubusercontent.com/n24q02m/claude-plugins/main/plugins/better-notion-mcp/setup-with-agent.md

## Tools

Eight composite Notion tools (39 actions) plus three infrastructure tools (`config`, `config__open_relay`, `help`):

| Tool | Actions | Description |
|:-----|:--------|:------------|
| `pages` | `create`, `get`, `get_property`, `update`, `move`, `archive`, `restore`, `duplicate` | Create, read, update, and organize pages |
| `databases` | `create`, `get`, `query`, `create_page`, `update_page`, `delete_page`, `create_data_source`, `update_data_source`, `update_database`, `list_templates` | Database CRUD and page management within databases |
| `blocks` | `get`, `children`, `append`, `update`, `delete` | Read and manipulate block content |
| `users` | `list`, `get`, `me`, `from_workspace` | List and retrieve user information |
| `workspace` | `info`, `search` | Workspace metadata and cross-workspace search |
| `comments` | `list`, `get`, `create` | Page comments and discussion replies |
| `content_convert` | `markdown-to-blocks`, `blocks-to-markdown` | Convert between Markdown and Notion blocks (uses a `direction` parameter) |
| `file_uploads` | `create`, `send`, `complete`, `retrieve`, `list` | Upload files to Notion (single or multi-part) |
| `config` | `status`, `setup_start`, `setup_reset`, `setup_complete`, `set`, `cache_clear` | Inspect and manage credential state and configuration lifecycle |
| `config__open_relay` | - | Open the relay configuration form in the browser and return the relay URL + credential state |
| `help` | - | Get full documentation for any composite tool (`tool_name` parameter) |

### MCP Resources

| URI | Description |
|:----|:------------|
| `notion://docs/pages` | Page operations reference |
| `notion://docs/databases` | Database operations reference |
| `notion://docs/blocks` | Block operations reference |
| `notion://docs/users` | User operations reference |
| `notion://docs/workspace` | Workspace operations reference |
| `notion://docs/comments` | Comment operations reference |
| `notion://docs/content_convert` | Content conversion reference |
| `notion://docs/file_uploads` | File upload reference |

## Configuration

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `NOTION_TOKEN` | Yes (stdio) | - | Notion integration token |
| `TRANSPORT_MODE` / `MCP_TRANSPORT` | No | `stdio` | Set either to `http` for remote mode (or pass `--http`) |
| `PUBLIC_URL` | No (http) | - | Server's public URL for OAuth redirect links |
| `NOTION_OAUTH_CLIENT_ID` | Yes (http) | - | Notion Public Integration client ID |
| `NOTION_OAUTH_CLIENT_SECRET` | Yes (http) | - | Notion Public Integration client secret |
| `MCP_AUTH_DISABLE` | No (http) | - | Set to `1` to skip Bearer JWT verification when behind an external auth gateway |
| `PORT` | No | `0` (OS-assigned) | Server port; set explicitly (e.g. `8080`) to bind a fixed port |
| `HOST` | No | - | Bind address (http mode) |

### Self-Hosting (Remote Mode)

You can self-host the remote server with your own Notion OAuth app.

**Prerequisites:**
1. Create a **Public Integration** at <https://www.notion.so/my-integrations>
2. Set the redirect URI to `https://your-domain.com/callback`
3. Note your `client_id` and `client_secret`

```bash
docker run -p 8080:8080 \
  -e TRANSPORT_MODE=http \
  -e PORT=8080 \
  -e PUBLIC_URL=https://your-domain.com \
  -e NOTION_OAUTH_CLIENT_ID=your-client-id \
  -e NOTION_OAUTH_CLIENT_SECRET=your-client-secret \
  n24q02m/better-notion-mcp:latest
```

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/n24q02m/better-notion-mcp)

Run your own multi-user better-notion-mcp serverless on Cloudflare (Worker + Container + KV).

**Prerequisites:** a Cloudflare account on the Workers Paid plan and the `wrangler` CLI.

1. `git clone https://github.com/n24q02m/better-notion-mcp && cd better-notion-mcp`
2. `wrangler login`
3. Provision the KV namespace and paste its id into `wrangler.jsonc`:
   ```
   wrangler kv namespace create better-notion-kv
   ```
4. Set secrets:
   ```
   wrangler secret put CREDENTIAL_SECRET
   wrangler secret put NOTION_OAUTH_CLIENT_ID
   wrangler secret put NOTION_OAUTH_CLIENT_SECRET
   ```
   `CREDENTIAL_SECRET` is REQUIRED: it derives a deterministic OAuth signing key so
   user identity survives container recreation.
5. Push the http image to the CF managed registry and deploy:
   ```
   wrangler containers push better-notion-mcp:beta
   wrangler deploy
   ```
6. Complete the Notion OAuth flow in the browser at your Worker domain.

Per-user Notion access tokens are encrypted into KV (`MCP_STORAGE_BACKEND=cf-kv`),
so they survive scale-to-zero. Do NOT set `MCP_AUTH_DISABLE` on a shared/public
deployment — it collapses all users into a single token bucket.

## Comparison

How better-notion-mcp stacks up against direct competitors in each pillar:

| Capability | better-notion-mcp | makenotion/notion-mcp-server | suekou/mcp-notion-server | awkoy/notion-mcp-server |
|---|---|---|---|---|
| Markdown in / out | Yes (round-trip on pages + blocks) | No (raw Notion JSON) | partial (experimental, append + opt-in convert) | Yes (round-trip + GFM) |
| Composite tool design | Yes (8 composite tools, 39 actions) | No (22 endpoint-mapped tools) | partial (simplified + raw JSON tools) | Yes (2 dispatch tools, 35+ ops) |
| File uploads to Notion | Yes (`file_uploads`, single + multi-part) | No | No | Yes (`upload_file`, single + multi-part) |
| Comments | Yes (`comments`: list/get/create) | Yes | Yes | Yes |
| Remote HTTP + OAuth 2.1 transport | Yes (per-JWT-sub multi-user) | partial (HTTP + bearer token, no OAuth) | No (stdio token only) | No (stdio token only) |
| Self-hostable | Yes (Docker, own OAuth app) | Yes | Yes | Yes |
| License | MIT | ? | MIT | MIT |

## Security

- **OAuth 2.1 + PKCE S256** -- Secure authorization with code challenge
- **Rate limiting** -- 120 req/min/IP on HTTP transport
- **Session owner binding** -- IP check + TTL for pending token binds
- **Null safety** -- Handles Notion API quirks (comments.list 404, undefined rich_text)

## Build from Source

```bash
git clone https://github.com/n24q02m/better-notion-mcp.git
cd better-notion-mcp
bun install
bun run dev
```

## Trust Model

This plugin implements **TC-NearZK** (in-memory, ephemeral). See [the trust model reference](https://mcp.n24q02m.com/servers/mcp-core/trust-model/) for full classification.

| Mode | Storage | Encryption | Who can read your data? |
|---|---|---|---|
| HTTP n24q02m-hosted (default) | In-memory `Map<sub, OAuthToken>` | In-process only | Server process (cleared on restart) |
| HTTP self-host | Same as hosted | Same | Only you (admin = user) |
| stdio (local) | `config.enc` in the OS config dir (`%APPDATA%\mcp\Config\config.enc` on Windows, `~/.config/mcp/config.enc` on Linux/macOS) | AES-GCM, machine-bound key | Only your OS user |

## License

MIT -- See [LICENSE](LICENSE).
