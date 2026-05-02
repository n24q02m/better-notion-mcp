# Better Notion MCP -- Manual Setup Guide

> **2026-05-02 Update (v<auto>+)**: Plugin install (Method 1) now uses pure stdio mode with `NOTION_TOKEN` env var.
> The previous "Zero-Config Relay" auto-spawn pattern has been removed.
> If you relied on the relay form to enter your token, please:
> 1. Set `NOTION_TOKEN` directly in plugin config (Method 1), OR
> 2. Switch to HTTP mode (Method 4 hosted / Method 5 self-host) for browser-based OAuth.

## Prerequisites

- **Node.js** >= 24.14.1
- A **Notion account** with access to create integrations

## Method 1: Claude Code Plugin (Recommended)

Plugin marketplace install runs the server in **pure stdio mode** with `NOTION_TOKEN` env var. No daemon-bridge, no auto-spawn, no relay form.

1. Create a Notion integration token:
   - Go to https://www.notion.so/my-integrations
   - Click "New integration", name it (e.g. "Better Notion MCP"), select your workspace
   - Copy the "Internal Integration Secret" (starts with `ntn_`)
   - **Share pages with the integration**: open a Notion page > "..." > Connections > select your integration. Repeat for each page or database you want accessible.
2. Open Claude Code in your terminal
3. Install the plugin:
   ```bash
   /plugin marketplace add n24q02m/claude-plugins
   /plugin install better-notion-mcp@n24q02m-plugins
   ```
4. Set `NOTION_TOKEN` in the plugin config when prompted (or in your Claude Code settings).

## Method 2: npx (Local Stdio with Token)

### Create a Notion Integration Token

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it (e.g., "Better Notion MCP") and select your workspace
4. Copy the "Internal Integration Secret" (starts with `ntn_`)
5. **Share pages with the integration**: Open a Notion page, click "..." > Connections > select your integration. Repeat for each page or database you want accessible.

### Configure the MCP Client

1. Add to your MCP client configuration file:

   **Claude Code** -- `.claude/settings.json` or `~/.claude/settings.json`:
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

   **Codex CLI** -- `~/.codex/config.toml`:
   ```toml
   [mcp_servers.better-notion-mcp]
   command = "npx"
   args = ["-y", "@n24q02m/better-notion-mcp"]

   [mcp_servers.better-notion-mcp.env]
   NOTION_TOKEN = "ntn_..."
   ```

   **OpenCode** -- `opencode.json`:
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

2. Replace `ntn_...` with your actual integration token.
3. Restart your MCP client.

Other package runners (`bun x`, `pnpm dlx`, `yarn dlx`) also work in place of `npx -y`.

## Method 3: Docker (Local Stdio)

1. Pull the image:
   ```bash
   docker pull n24q02m/better-notion-mcp:latest
   ```

2. Add to your MCP client config:
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

3. Set `NOTION_TOKEN` in your shell profile:
   ```bash
   export NOTION_TOKEN="ntn_..."
   ```

## Why upgrade to HTTP mode?

Stdio is the default and works fine for single-user local setups. You may want to switch to HTTP mode (Method 4 hosted, Method 5 self-host) when you need any of the following:

- **claude.ai web compatibility** -- claude.ai (the web UI) supports HTTP MCP servers but cannot spawn local stdio processes.
- **One server shared across N Claude Code sessions** -- a single HTTP instance serves multiple terminals/IDEs without re-spawning per session.
- **OAuth flow delegated to `api.notion.com`** -- no manual token paste; users grant access through Notion's standard authorization page.
- **Multi-device credential sync** -- sign in once on your laptop, the same OAuth grant works from your desktop / tablet without copying tokens.
- **Multi-user team sharing** -- a self-hosted server can serve multiple Notion accounts, each with isolated per-user tokens (per-JWT-sub).
- **Always-on persistent process for webhooks/agents** -- HTTP servers stay alive between sessions, enabling background work, scheduled agents, or webhook listeners.

## Method 4: HTTP Remote (Hosted)

Connect via URL with OAuth 2.1 authentication. Your MCP client handles the OAuth flow automatically.

1. Add to your MCP client configuration file:

   **Claude Code** -- `.claude/settings.json` or `~/.claude/settings.json`:
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

   **Codex CLI** -- `~/.codex/config.toml`:
   ```toml
   [mcp_servers.better-notion-mcp]
   type = "http"
   url = "https://better-notion-mcp.n24q02m.com/mcp"
   ```

   **OpenCode** -- `opencode.json`:
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

2. On first use, a browser window opens for Notion authorization. Grant access to the pages and databases you want the agent to work with.

## Method 5: Self-Hosting HTTP Mode

Host your own multi-user OAuth server. Always-OAuth, single multi-user mode (per-JWT-sub token isolation). Requires you to register your own Notion public integration -- the previous n24q02m-hosted SaaS instance is no longer offered as a self-host shortcut.

### Prerequisites

1. Create a **Public Integration** at https://www.notion.so/my-integrations (you, the operator, must own this OAuth app -- one per self-host deployment).
2. Set the redirect URI to `https://your-domain.com/callback`
3. Note the `client_id` and `client_secret`

### Required Env

| Variable | Description |
|:---------|:------------|
| `TRANSPORT_MODE=http` | Selects HTTP transport. |
| `PUBLIC_URL` | Public URL of your server (e.g. `https://your-domain.com`). Used for OAuth redirects. |
| `DCR_SERVER_SECRET` | HMAC secret for stateless Dynamic Client Registration. Generate via `openssl rand -hex 32`. |
| `NOTION_OAUTH_CLIENT_ID` | Your Notion Public Integration client ID. |
| `NOTION_OAUTH_CLIENT_SECRET` | Your Notion Public Integration client secret. |

### Run the Server

```bash
docker run -p 8080:8080 \
  -e TRANSPORT_MODE=http \
  -e PUBLIC_URL=https://your-domain.com \
  -e NOTION_OAUTH_CLIENT_ID=your-client-id \
  -e NOTION_OAUTH_CLIENT_SECRET=your-client-secret \
  -e DCR_SERVER_SECRET=$(openssl rand -hex 32) \
  n24q02m/better-notion-mcp:latest
```

Point clients to your server:
```json
{
  "mcpServers": {
    "better-notion-mcp": {
      "type": "http",
      "url": "https://your-domain.com/mcp"
    }
  }
}
```

## Method 6: Build from Source

1. Clone and build:
   ```bash
   git clone https://github.com/n24q02m/better-notion-mcp.git
   cd better-notion-mcp
   bun install
   bun run build
   ```

2. Run the dev server:
   ```bash
   NOTION_TOKEN="ntn_..." bun run dev
   ```

3. For HTTP mode:
   ```bash
   TRANSPORT_MODE=http PUBLIC_URL=http://localhost:8080 \
   NOTION_OAUTH_CLIENT_ID=... NOTION_OAUTH_CLIENT_SECRET=... \
   DCR_SERVER_SECRET=... bun run dev:http
   ```

## Credential Setup

### Integration Token (Stdio Mode)

1. Go to https://www.notion.so/my-integrations
2. Create a new integration for your workspace
3. Copy the "Internal Integration Secret" (`ntn_...`)
4. Share each page/database with the integration via the Connections menu

### OAuth (HTTP Mode)

No manual token setup. Users authorize via Notion's OAuth flow in the browser.

## Environment Variable Reference

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `NOTION_TOKEN` | Yes (stdio) | -- | Notion internal integration token (`ntn_...`). |
| `TRANSPORT_MODE` | No | `stdio` | Set to `http` to enable HTTP transport (multi-user OAuth). |
| `PUBLIC_URL` | Yes (http) | -- | Server's public URL for OAuth redirects. |
| `NOTION_OAUTH_CLIENT_ID` | Yes (http) | -- | Notion Public Integration client ID. |
| `NOTION_OAUTH_CLIENT_SECRET` | Yes (http) | -- | Notion Public Integration client secret. |
| `DCR_SERVER_SECRET` | Yes (http) | -- | HMAC secret for stateless Dynamic Client Registration. |
| `PORT` | No | `8080` | Server port. |

## Troubleshooting

### "Could not find integration" or 401 Unauthorized

- Verify your `NOTION_TOKEN` starts with `ntn_` and is a valid Internal Integration Secret.
- Ensure the integration has not been deleted or revoked at https://www.notion.so/my-integrations.

### Tool returns empty results

- The integration can only access pages explicitly shared with it. Click "..." on a Notion page > Connections > add your integration.
- Child pages inherit the parent's connections, but databases must be shared individually.

### OAuth flow fails (HTTP mode)

- Verify `PUBLIC_URL` matches the redirect URI configured in your Notion Public Integration.
- Ensure `NOTION_OAUTH_CLIENT_ID` and `NOTION_OAUTH_CLIENT_SECRET` are correct.
- Check that the redirect URI is `https://your-domain.com/callback`.

### npx: old version or "command not found"

- Verify Node.js >= 24.14.1: `node --version`.
- Clear the npx cache or use `@latest` tag: `npx -y @n24q02m/better-notion-mcp@latest`.

### comments.list returns 404

- This is a known Notion API issue with OAuth tokens on API version `2025-09-03`. Use stdio mode with an integration token for full comment support.
