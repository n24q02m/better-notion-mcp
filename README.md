# Better Notion MCP

**Markdown-First MCP Server for Notion - Optimized for AI Agents**

[![CI](https://github.com/n24q02m/better-notion-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/n24q02m/better-notion-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/n24q02m/better-notion-mcp/graph/badge.svg?token=D7FSDVVTAN)](https://codecov.io/gh/n24q02m/better-notion-mcp)
[![npm](https://img.shields.io/npm/v/@n24q02m/better-notion-mcp?logo=npm&logoColor=white)](https://www.npmjs.com/package/@n24q02m/better-notion-mcp)
[![Docker](https://img.shields.io/docker/v/n24q02m/better-notion-mcp?label=docker&logo=docker&logoColor=white&sort=semver)](https://hub.docker.com/r/n24q02m/better-notion-mcp)
[![License: MIT](https://img.shields.io/github/license/n24q02m/better-notion-mcp)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=nodedotjs&logoColor=white)](#)
[![Notion](https://img.shields.io/badge/Notion_API-000000?logo=notion&logoColor=white)](#)
[![semantic-release](https://img.shields.io/badge/semantic--release-e10079?logo=semantic-release&logoColor=white)](https://github.com/python-semantic-release/python-semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-1A1F6C?logo=renovatebot&logoColor=white)](https://developer.mend.io/)

<a href="https://glama.ai/mcp/servers/n24q02m/better-notion-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/n24q02m/better-notion-mcp/badge" alt="Better Notion MCP server" />
</a>

## Why "Better"?

**9 composite tools** that consolidate Notion's 28+ REST API endpoints into action-based operations optimized for AI agents.

### vs. Official Notion MCP Server

| Feature | Better Notion MCP | Official Notion MCP |
|---------|-------------------|---------------------|
| **Content Format** | **Markdown** (human-readable) | Raw JSON blocks |
| **Operations** | **Composite actions** (1 call) | Atomic (2+ calls) |
| **Pagination** | **Auto-pagination** | Manual cursor |
| **Bulk Operations** | **Native batch support** | Loop manually |
| **Tools** | **9 tools** (39 actions) | 28+ endpoint tools |
| **Token Efficiency** | **Optimized** | Standard |

---

## Quick Start

### Remote Mode (OAuth) -- No token needed

Connect directly via URL with OAuth authentication. Your MCP client handles the OAuth flow automatically — just authorize with your Notion account when prompted.

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

> Supported by Claude Desktop, Claude Code, Cursor, VS Code Copilot, and other clients with OAuth support.

### Local Mode (Token)

Get your token: <https://www.notion.so/my-integrations> -> Create integration -> Copy token -> Share pages

#### Option 1: Package Manager (Recommended)

```jsonc
{
  "mcpServers": {
    "better-notion": {
      "command": "bun",
      "args": ["x", "@n24q02m/better-notion-mcp@latest"],
      "env": {
        "NOTION_TOKEN": "ntn_..."                  // required: Notion integration token
      }
    }
  }
}
```

Alternatively, you can use `npx`, `pnpm dlx`, or `yarn dlx`:

| Runner | `command` | `args` |
|--------|-----------|--------|
| npx | `npx` | `["-y", "@n24q02m/better-notion-mcp@latest"]` |
| pnpm | `pnpm` | `["dlx", "@n24q02m/better-notion-mcp@latest"]` |
| yarn | `yarn` | `["dlx", "@n24q02m/better-notion-mcp@latest"]` |

#### Option 2: Docker

```jsonc
{
  "mcpServers": {
    "better-notion": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--name", "mcp-notion",
        "-e", "NOTION_TOKEN",                      // required: pass-through from env below
        "n24q02m/better-notion-mcp:latest"
      ],
      "env": {
        "NOTION_TOKEN": "ntn_..."                  // required: Notion integration token
      }
    }
  }
}
```

---

## Self-Hosting (Remote Mode)

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

| Variable | Description |
|----------|-------------|
| `TRANSPORT_MODE` | Set to `http` for remote mode (default: `stdio`) |
| `PUBLIC_URL` | Your server's public URL (used for OAuth redirects) |
| `NOTION_OAUTH_CLIENT_ID` | Notion Public Integration client ID |
| `NOTION_OAUTH_CLIENT_SECRET` | Notion Public Integration client secret |
| `DCR_SERVER_SECRET` | HMAC secret for stateless client registration |
| `PORT` | Server port (default: `8080`) |

---

## Tools

| Tool | Actions |
|------|---------|
| `pages` | create, get, get_property, update, move, archive, restore, duplicate |
| `databases` | create, get, query, create_page, update_page, delete_page, create_data_source, update_data_source, update_database, list_templates |
| `blocks` | get, children, append, update, delete |
| `users` | list, get, me, from_workspace |
| `workspace` | info, search |
| `comments` | list, get, create |
| `content_convert` | markdown-to-blocks, blocks-to-markdown |
| `file_uploads` | create, send, complete, retrieve, list |
| `help` | Get full documentation for any tool |

---

## Token Optimization

**~77% token reduction** via tiered descriptions:

| Tier | Purpose | When |
|------|---------|------|
| **Tier 1** | Compressed descriptions | Always loaded |
| **Tier 2** | Full docs via `help` tool | On-demand |
| **Tier 3** | MCP Resources | Supported clients |

```json
{"name": "help", "tool_name": "pages"}
```

### MCP Resources (Tier 3)

Clients that support MCP Resources can load full tool documentation:

| URI | Description |
|-----|-------------|
| `notion://docs/pages` | Pages tool docs |
| `notion://docs/databases` | Databases tool docs |
| `notion://docs/blocks` | Blocks tool docs |
| `notion://docs/users` | Users tool docs |
| `notion://docs/workspace` | Workspace tool docs |
| `notion://docs/comments` | Comments tool docs |
| `notion://docs/content_convert` | Content Convert tool docs |
| `notion://docs/file_uploads` | File Uploads tool docs |

---

## Build from Source

```bash
git clone https://github.com/n24q02m/better-notion-mcp
cd better-notion-mcp
mise run setup
bun run build
```

**Requirements:** Node.js 24+, bun

## Compatible With

[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-F9DC7C?logo=anthropic&logoColor=black)](#quick-start)
[![Claude Code](https://img.shields.io/badge/Claude_Code-000000?logo=anthropic&logoColor=white)](#quick-start)
[![Cursor](https://img.shields.io/badge/Cursor-000000?logo=cursor&logoColor=white)](#quick-start)
[![VS Code Copilot](https://img.shields.io/badge/VS_Code_Copilot-007ACC?logo=visualstudiocode&logoColor=white)](#quick-start)
[![Antigravity](https://img.shields.io/badge/Antigravity-4285F4?logo=google&logoColor=white)](#quick-start)
[![Gemini CLI](https://img.shields.io/badge/Gemini_CLI-8E75B2?logo=googlegemini&logoColor=white)](#quick-start)
[![OpenAI Codex](https://img.shields.io/badge/Codex-412991?logo=openai&logoColor=white)](#quick-start)
[![OpenCode](https://img.shields.io/badge/OpenCode-F7DF1E?logoColor=black)](#quick-start)

## Also by n24q02m

| Server | Description | Install |
|--------|-------------|---------|
| [wet-mcp](https://github.com/n24q02m/wet-mcp) | Web search, content extraction, library docs | `uvx --python 3.13 wet-mcp@latest` |
| [mnemo-mcp](https://github.com/n24q02m/mnemo-mcp) | Persistent AI memory with hybrid search | `uvx mnemo-mcp@latest` |
| [better-email-mcp](https://github.com/n24q02m/better-email-mcp) | Email (IMAP/SMTP) for AI agents | `npx -y @n24q02m/better-email-mcp@latest` |
| [better-godot-mcp](https://github.com/n24q02m/better-godot-mcp) | Godot Engine for AI agents | `npx -y @n24q02m/better-godot-mcp@latest` |
| [better-telegram-mcp](https://github.com/n24q02m/better-telegram-mcp) | Telegram Bot API + MTProto for AI agents | `uvx --python 3.13 better-telegram-mcp@latest` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT - See [LICENSE](LICENSE)
