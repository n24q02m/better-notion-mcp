# Better Notion MCP

**Markdown-First MCP Server for Notion - Optimized for AI Agents**

[![CI](https://github.com/n24q02m/better-notion-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/n24q02m/better-notion-mcp/actions/workflows/ci.yml)
[![Codecov](https://img.shields.io/codecov/c/github/n24q02m/better-notion-mcp?logo=codecov&logoColor=white)](https://codecov.io/gh/n24q02m/better-notion-mcp)
[![npm](https://img.shields.io/npm/v/@n24q02m/better-notion-mcp?logo=npm&logoColor=white)](https://www.npmjs.com/package/@n24q02m/better-notion-mcp)
[![Docker](https://img.shields.io/docker/v/n24q02m/better-notion-mcp?label=docker&logo=docker&logoColor=white&sort=semver)](https://hub.docker.com/r/n24q02m/better-notion-mcp)
[![License: MIT](https://img.shields.io/github/license/n24q02m/better-notion-mcp)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-5FA04E?logo=nodedotjs&logoColor=white)](#)
[![Notion](https://img.shields.io/badge/Notion_API-000000?logo=notion&logoColor=white)](#)
[![semantic-release](https://img.shields.io/badge/semantic--release-e10079?logo=semantic-release&logoColor=white)](https://github.com/python-semantic-release/python-semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-1A1F6C?logo=renovatebot&logoColor=white)](https://developer.mend.io/)

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

Get your token: <https://www.notion.so/my-integrations> → Create integration → Copy token → Share pages

### Option 1: Package Manager (Recommended)

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

### Option 2: Docker

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT - See [LICENSE](LICENSE)
