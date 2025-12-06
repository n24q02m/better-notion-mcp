# Better Notion MCP

**Markdown-First MCP Server for Notion - Optimized for AI Agents**

[![GitHub stars](https://img.shields.io/github/stars/n24q02m/better-notion-mcp)](https://github.com/n24q02m/better-notion-mcp/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/%40n24q02m%2Fbetter-notion-mcp.svg)](https://www.npmjs.com/package/@n24q02m/better-notion-mcp)
[![Docker](https://img.shields.io/docker/v/n24q02m/better-notion-mcp?label=docker)](https://hub.docker.com/r/n24q02m/better-notion-mcp)

## Why "Better"?

**7 mega action-based tools** that consolidate Notion's 28+ REST API endpoints into composite operations optimized for AI agents.

### vs. Official Notion MCP Server

| Feature               | Better Notion MCP                                                      | Official Notion MCP                            |
| --------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| **Content Format**    | **Markdown** (human-readable)                                          | Raw JSON blocks (verbose)                      |
| **Operations**        | **Composite actions** (create page + content + properties in 1 call)   | Atomic operations (2+ separate calls required) |
| **Pagination**        | **Auto-pagination** (transparent)                                      | Manual cursor management                       |
| **Bulk Operations**   | **Native batch support** (create/update/delete multiple items at once) | Loop through items manually                    |
| **Tool Architecture** | **7 mega action-based tools** (30+ actions)                            | 28+ individual endpoint tools                  |
| **Database Query**    | **Smart search** (auto-detect best match)                              | Manual filters + sorts required                |
| **Token Efficiency**  | **Optimized for AI context**                                           | Standard API responses                         |
| **Setup**             | Simple (NOTION_TOKEN only)                                             | OAuth flow or token                            |

---

## Installation

Get your Notion token: <https://www.notion.so/my-integrations> → Create integration → Copy token → Share pages with integration

### Quick Start

### NPX (Recommended)

```json
{
  "mcpServers": {
    "better-notion": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-notion-mcp@latest"],
      "env": {
        "NOTION_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Docker

```json
{
  "mcpServers": {
    "better-notion": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "NOTION_TOKEN", "n24q02m/better-notion-mcp:latest"],
      "env": {
        "NOTION_TOKEN": "your_token_here"
      }
    }
  }
}
```

---

## Tools Overview

**7 mega tools with 30+ actions:**

- **Composite Actions**: Combine operations (e.g., create page + content + properties in 1 call)
- **Auto-Pagination**: Transparent handling of large datasets
- **Bulk Operations**: Process multiple items efficiently
- **Smart Search**: Auto-detect best matches in database queries

---

## Development

### Build from Source

```bash
git clone https://github.com/n24q02m/better-notion-mcp
cd better-notion-mcp
mise trust && mise install  # Install Node.js 22 + pnpm via mise
pnpm build                  # Build the project
```

**Prerequisites:** [mise](https://mise.jdx.dev/) for managing Node.js and pnpm versions.

### Available Commands

```bash
pnpm run dev
pnpm run build
pnpm run test
pnpm run test:watch
pnpm run test:coverage
pnpm run lint
pnpm run format:check
pnpm run type-check
pnpm run check
pnpm run changeset
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow with changesets
- Commit convention (enforced via git hooks)
- Testing and code quality standards

---

## License

MIT License - See [LICENSE](LICENSE)

---

**Star this repo if you find it useful! ⭐**
