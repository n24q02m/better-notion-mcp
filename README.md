# Better Notion MCP

mcp-name: io.github.n24q02m/better-notion-mcp

**Markdown-first Notion API server for AI agents -- 10 composite tools replacing 28+ endpoint calls**

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

<a href="https://glama.ai/mcp/servers/n24q02m/better-notion-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/n24q02m/better-notion-mcp/badge" alt="Better Notion MCP server" />
</a>

## Features

- **Markdown in, Markdown out** -- human-readable content instead of raw JSON blocks
- **10 composite tools** with 44 actions -- one call instead of chaining 2+ atomic endpoints
- **Auto-pagination and bulk operations** -- no manual cursor handling or looping
- **Tiered token optimization** -- ~77% reduction via compressed descriptions + on-demand `help` tool
- **Dual transport** -- local stdio (token) or remote HTTP (OAuth 2.1, no token needed)

## Status

> **2026-05-02 -- Architecture stabilization update**
>
> Past months saw significant churn around credential handling and the daemon-bridge auto-spawn pattern. This caused multi-process races, browser tab spam, and inconsistent setup UX across plugins. **As of v<auto>, the architecture is stable**: 2 clean modes (stdio + HTTP), no daemon-bridge layer, no auto-spawn from stdio.
>
> Apologies for the instability period. If you encountered issues with prior versions, please update to v<auto>+ and follow the current `docs/setup-manual.md` -- most prior workarounds are no longer needed.
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

## Setup

- **Stdio mode** (default) -- env var creds (`NOTION_TOKEN`), single-user local. See [setup-manual.md](docs/setup-manual.md).
- **HTTP mode** (optional, encouraged) -- multi-user, OAuth 2.1, browser-based setup. See [setup-manual.md](docs/setup-manual.md) "Method 5: Self-Hosting HTTP Mode".

**With AI Agent** -- copy and send this to your AI agent:

> Please set up @n24q02m/better-notion-mcp for me. Follow this guide:
> https://raw.githubusercontent.com/n24q02m/better-notion-mcp/main/docs/setup-with-agent.md

**Manual Setup** -- follow [docs/setup-manual.md](docs/setup-manual.md)

## Tools

| Tool | Actions | Description |
|:-----|:--------|:------------|
| `pages` | `create`, `get`, `get_property`, `update`, `move`, `archive`, `restore`, `duplicate` | Create, read, update, and organize pages |
| `databases` | `create`, `get`, `query`, `create_page`, `update_page`, `delete_page`, `create_data_source`, `update_data_source`, `update_database`, `list_templates` | Database CRUD and page management within databases |
| `blocks` | `get`, `children`, `append`, `update`, `delete` | Read and manipulate block content |
| `users` | `list`, `get`, `me`, `from_workspace` | List and retrieve user information |
| `workspace` | `info`, `search` | Workspace metadata and cross-workspace search |
| `comments` | `list`, `get`, `create` | Page and block comments |
| `content_convert` | `markdown-to-blocks`, `blocks-to-markdown` | Convert between Markdown and Notion blocks |
| `file_uploads` | `create`, `send`, `complete`, `retrieve`, `list` | Upload files to Notion |
| `setup` | `status`, `start`, `reset`, `complete` | Credential setup via browser relay, status check, reset, re-resolve |
| `help` | - | Get full documentation for any tool |

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
| `TRANSPORT_MODE` | No | `stdio` | Set to `http` for remote mode |
| `PUBLIC_URL` | Yes (http) | - | Server's public URL for OAuth redirects |
| `NOTION_OAUTH_CLIENT_ID` | Yes (http) | - | Notion Public Integration client ID |
| `NOTION_OAUTH_CLIENT_SECRET` | Yes (http) | - | Notion Public Integration client secret |
| `DCR_SERVER_SECRET` | Yes (http) | - | HMAC secret for stateless client registration |
| `PORT` | No | `8080` | Server port |

### Self-Hosting (Remote Mode)

You can self-host the remote server with your own Notion OAuth app.

**Prerequisites:**
1. Create a **Public Integration** at <https://www.notion.so/my-integrations>
2. Set the redirect URI to `https://your-domain.com/callback`
3. Note your `client_id` and `client_secret`

```bash
docker run -p 8080:8080 \
  -e TRANSPORT_MODE=http \
  -e PUBLIC_URL=https://your-domain.com \
  -e NOTION_OAUTH_CLIENT_ID=your-client-id \
  -e NOTION_OAUTH_CLIENT_SECRET=your-client-secret \
  -e DCR_SERVER_SECRET=$(openssl rand -hex 32) \
  n24q02m/better-notion-mcp:latest
```

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

This plugin implements **TC-NearZK** (in-memory, ephemeral). See [mcp-core/docs/TRUST-MODEL.md](https://github.com/n24q02m/mcp-core/blob/main/docs/TRUST-MODEL.md) for full classification.

| Mode | Storage | Encryption | Who can read your data? |
|---|---|---|---|
| HTTP n24q02m-hosted (default) | In-memory `Map<sub, OAuthToken>` | In-process only | Server process (cleared on restart) |
| HTTP self-host | Same as hosted | Same | Only you (admin = user) |
| stdio proxy | `~/.better-notion-mcp/config.json` | AES-GCM, machine-bound key | Only your OS user (file perm 0600) |

## License

MIT -- See [LICENSE](LICENSE).
