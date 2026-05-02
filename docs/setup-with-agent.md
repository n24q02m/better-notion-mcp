# Better Notion MCP -- Agent Setup Guide

> Give this file to your AI agent to automatically set up better-notion-mcp.

> **2026-05-02 Update (v<auto>+)**: Plugin install (Option 1) now uses pure stdio mode with `NOTION_TOKEN` env var.
> The previous "Zero-Config Relay" auto-spawn pattern has been removed.
> If you relied on the relay form to enter your token, please:
> 1. Set `NOTION_TOKEN` directly in plugin config (Option 1), OR
> 2. Switch to HTTP mode (Option 4 hosted / self-host) for browser-based OAuth.

## Option 1: Claude Code Plugin (Recommended)

Plugin marketplace install runs the server in **pure stdio mode** with `NOTION_TOKEN` env var. No daemon-bridge, no auto-spawn, no relay form.

1. Create a Notion integration token:
   - Go to https://www.notion.so/my-integrations
   - Click "New integration", name it, select your workspace
   - Copy the "Internal Integration Secret" (starts with `ntn_`)
   - Share pages/databases with the integration: open page > "..." > Connections > select your integration
2. Install the plugin:
   ```bash
   /plugin marketplace add n24q02m/claude-plugins
   /plugin install better-notion-mcp@n24q02m-plugins
   ```
3. Set `NOTION_TOKEN` in the plugin config (or your Claude Code settings).

This installs the server with skills: `/organize-database`, `/bulk-update`.

## Option 2: MCP Direct (Stdio + npx)

### Claude Code (settings.json)

Add to `.claude/settings.json` or `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "better-notion-mcp": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-notion-mcp"],
      "env": {
        "NOTION_TOKEN": "ntn_..."
      }
    }
  }
}
```

### Codex CLI (config.toml)

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.better-notion-mcp]
command = "npx"
args = ["-y", "@n24q02m/better-notion-mcp"]

[mcp_servers.better-notion-mcp.env]
NOTION_TOKEN = "ntn_..."
```

### OpenCode (opencode.json)

Add to `opencode.json` in your project root:

```json
{
  "mcpServers": {
    "better-notion-mcp": {
      "command": "npx",
      "args": ["-y", "@n24q02m/better-notion-mcp"],
      "env": {
        "NOTION_TOKEN": "ntn_..."
      }
    }
  }
}
```

## Option 3: Docker (Stdio)

```json
{
  "mcpServers": {
    "better-notion-mcp": {
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

Set `NOTION_TOKEN` in your shell profile or pass it inline.

## Why upgrade to HTTP mode?

Stdio is the default and works fine for single-user local setups. You may want to switch to HTTP mode (Option 4) when you need any of the following:

- **claude.ai web compatibility** -- claude.ai (the web UI) supports HTTP MCP servers but cannot spawn local stdio processes.
- **One server shared across N Claude Code sessions** -- a single HTTP instance serves multiple terminals/IDEs without re-spawning per session.
- **OAuth flow delegated to `api.notion.com`** -- no manual token paste; users grant access through Notion's standard authorization page.
- **Multi-device credential sync** -- sign in once on your laptop, the same OAuth grant works from your desktop / tablet without copying tokens.
- **Multi-user team sharing** -- a self-hosted server can serve multiple Notion accounts, each with isolated per-user tokens (per-JWT-sub).
- **Always-on persistent process for webhooks/agents** -- HTTP servers stay alive between sessions, enabling background work, scheduled agents, or webhook listeners.

## Option 4: HTTP Remote (Hosted)

For OAuth 2.1 mode (no local token needed -- Notion authorizes via browser):

### Claude Code (settings.json)

```json
{
  "mcpServers": {
    "better-notion-mcp": {
      "type": "http",
      "url": "https://better-notion-mcp.n24q02m.com/mcp"
    }
  }
}
```

### Codex CLI (config.toml)

```toml
[mcp_servers.better-notion-mcp]
type = "http"
url = "https://better-notion-mcp.n24q02m.com/mcp"
```

### OpenCode (opencode.json)

```json
{
  "mcpServers": {
    "better-notion-mcp": {
      "type": "http",
      "url": "https://better-notion-mcp.n24q02m.com/mcp"
    }
  }
}
```

Your MCP client handles the OAuth flow automatically. A browser window opens for Notion authorization.

For self-hosting HTTP mode (your own Notion public integration, multi-user OAuth), see [setup-manual.md](setup-manual.md) "Method 5: Self-Hosting HTTP Mode".

## Environment Variables

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `NOTION_TOKEN` | Yes (stdio) | -- | Notion internal integration token (`ntn_...`). Not needed for HTTP/OAuth mode. |
| `TRANSPORT_MODE` | No | `stdio` | Set to `http` to enable HTTP transport (multi-user OAuth). |
| `PUBLIC_URL` | Yes (http) | -- | Server's public URL for OAuth redirects. |
| `NOTION_OAUTH_CLIENT_ID` | Yes (http) | -- | Notion Public Integration client ID. |
| `NOTION_OAUTH_CLIENT_SECRET` | Yes (http) | -- | Notion Public Integration client secret. |
| `DCR_SERVER_SECRET` | Yes (http) | -- | HMAC secret for stateless client registration. |
| `PORT` | No | `8080` | Server port (http mode only). |

## Authentication

### Stdio Mode (Integration Token)

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it and select the workspace
4. Copy the "Internal Integration Secret" (starts with `ntn_`)
5. Share pages/databases with the integration (click "..." on a page > Connections > select your integration)

### HTTP Mode (OAuth 2.1)

No manual token setup. The OAuth flow opens a browser for Notion authorization. Users grant access to specific pages/databases during the flow.

## Verification

After setup, verify the server is working:

```
Use the workspace tool with action "info" to verify the server is connected to Notion.
```

Expected: workspace name, ID, and bot user information.
