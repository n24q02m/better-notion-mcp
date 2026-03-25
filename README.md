# Better Notion MCP

mcp-name: io.github.n24q02m/better-notion-mcp

**Markdown-first Notion API server for AI agents -- 9 composite tools replacing 28+ endpoint calls**

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
- **9 composite tools** with 39 actions -- one call instead of chaining 2+ atomic endpoints
- **Auto-pagination and bulk operations** -- no manual cursor handling or looping
- **Tiered token optimization** -- ~77% reduction via compressed descriptions + on-demand `help` tool
- **Dual transport** -- local stdio (token) or remote HTTP (OAuth 2.1, no token needed)

## Quick Start

### Claude Code Plugin (Recommended)

Via marketplace (includes skills: /organize-database, /bulk-update):

```bash
/plugin marketplace add n24q02m/claude-plugins
/plugin install better-notion-mcp@claude-plugins
```

Or install this plugin only:

```bash
/plugin marketplace add n24q02m/better-notion-mcp
/plugin install better-notion-mcp
```

Plugin uses remote OAuth — no `NOTION_TOKEN` needed. Browser opens for Notion authorization on first use.

### MCP Server

#### Option 1: Remote (OAuth) -- No token needed

Connect directly via URL with OAuth authentication. Your MCP client handles the OAuth flow automatically.

```jsonc
{
  "mcpServers": {
    "better-notion": {
      "type": "http",
      "url": "https://better-notion-mcp.n24q02m.com/mcp"
    }
  }
}
```

#### Option 2: npx

Get your token: <https://www.notion.so/my-integrations> -> Create integration -> Copy token -> Share pages

Set `NOTION_TOKEN` in `~/.claude/settings.local.json` or your shell profile:

```bash
export NOTION_TOKEN="ntn_..."
```

Then add to your MCP client config:

```jsonc
{
  "mcpServers": {
    "better-notion": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-notion-mcp@latest"]
    }
  }
}
```

Other runners: `bun x`, `pnpm dlx`, `yarn dlx` also work.

<details>
<summary>Other MCP clients (Cursor, Codex, Gemini CLI)</summary>

```jsonc
// Cursor (~/.cursor/mcp.json), Windsurf, Cline, Amp, OpenCode
{
  "mcpServers": {
    "better-notion": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-notion-mcp@latest"]
    }
  }
}
```

```toml
# Codex (~/.codex/config.toml)
[mcp_servers.better-notion]
command = "npx"
args = ["-y", "@n24q02m/better-notion-mcp@latest"]
```

</details>

#### Option 3: Docker

```jsonc
{
  "mcpServers": {
    "better-notion": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "NOTION_TOKEN",
        "n24q02m/better-notion-mcp:latest"
      ]
    }
  }
}
```

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

## Zero-Config Setup

No environment variables needed. On first start, the server opens a setup page in your browser:

1. Start the server (via plugin, `npx`, or Docker)
2. A setup URL appears -- open it in any browser
3. Fill in your credentials on the guided form
4. Credentials are encrypted and stored locally

Your credentials never leave your machine. The relay server only sees encrypted data.

For CI/automation, you can still use environment variables (see below).

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

### Security

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

## Compatible With

[![Claude Code](https://img.shields.io/badge/Claude_Code-000000?logo=anthropic&logoColor=white)](#quick-start)
[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-F9DC7C?logo=anthropic&logoColor=black)](#quick-start)
[![Cursor](https://img.shields.io/badge/Cursor-000000?logo=cursor&logoColor=white)](#quick-start)
[![VS Code Copilot](https://img.shields.io/badge/VS_Code_Copilot-007ACC?logo=visualstudiocode&logoColor=white)](#quick-start)
[![Antigravity](https://img.shields.io/badge/Antigravity-4285F4?logo=google&logoColor=white)](#quick-start)
[![Gemini CLI](https://img.shields.io/badge/Gemini_CLI-8E75B2?logo=googlegemini&logoColor=white)](#quick-start)
[![OpenAI Codex](https://img.shields.io/badge/Codex-412991?logo=openai&logoColor=white)](#quick-start)
[![OpenCode](https://img.shields.io/badge/OpenCode-F7DF1E?logoColor=black)](#quick-start)

## Also by n24q02m

| Server | Description |
|--------|-------------|
| [wet-mcp](https://github.com/n24q02m/wet-mcp) | Web search, content extraction, and documentation indexing |
| [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) | Persistent AI memory with hybrid search and cross-machine sync |
| [better-email-mcp](https://github.com/n24q02m/better-email-mcp) | Email (IMAP/SMTP) with multi-account and auto-discovery |
| [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) | Godot Engine 4.x with 18 tools for scenes, scripts, and shaders |
| [better-telegram-mcp](https://github.com/n24q02m/better-telegram-mcp) | Telegram dual-mode (Bot API + MTProto) with 6 composite tools |
| [better-code-review-graph](https://github.com/n24q02m/better-code-review-graph) | Knowledge graph for token-efficient code reviews |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT -- See [LICENSE](LICENSE).
