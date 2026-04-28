# Better Notion MCP -- Agent Setup Guide

> Give this file to your AI agent to automatically set up better-notion-mcp.

## Option 1: Claude Code Plugin (Recommended)

```bash
/plugin marketplace add n24q02m/claude-plugins
/plugin install better-notion-mcp@n24q02m-plugins
```

This installs the server with skills: `/organize-database`, `/bulk-update`.

The plugin uses remote HTTP mode with OAuth -- no `NOTION_TOKEN` needed. A browser window opens for Notion authorization on first use.

## Option 2: MCP Direct

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

## Option 3: Docker

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

## Option 4: HTTP Remote

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

## Environment Variables

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `NOTION_TOKEN` | Yes (stdio) | -- | Notion internal integration token (`ntn_...`). Not needed for HTTP/OAuth mode. |
| `MCP_MODE` | No | `remote-oauth` (when `TRANSPORT_MODE=http`) | Selects the HTTP relay flavour: `remote-oauth` (delegated OAuth 2.1 to `api.notion.com`; multi-user) or `local-relay` (paste-form for the integration token; single-user). |
| `TRANSPORT_MODE` | No | `stdio` | Legacy alias still honoured — set to `http` to enable HTTP transport (then pick `MCP_MODE`). |
| `PUBLIC_URL` | Yes (http) | -- | Server's public URL for OAuth redirects. |
| `NOTION_OAUTH_CLIENT_ID` | Yes (`MCP_MODE=remote-oauth`) | -- | Notion Public Integration client ID. |
| `NOTION_OAUTH_CLIENT_SECRET` | Yes (`MCP_MODE=remote-oauth`) | -- | Notion Public Integration client secret. |
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

### Zero-Config Relay

> **Recommended.** The relay is the primary setup method. Credentials are encrypted end-to-end and stored locally. Environment variables are supported for backward compatibility.

If `NOTION_TOKEN` is not set, the server opens a relay setup page:
1. A setup URL appears in the terminal
2. Open it in a browser
3. Enter your integration token in the form
4. The token is encrypted and stored locally

## Verification

After setup, verify the server is working:

```
Use the workspace tool with action "info" to verify the server is connected to Notion.
```

Expected: workspace name, ID, and bot user information.
