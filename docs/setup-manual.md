# Better Notion MCP -- Manual Setup Guide

## Prerequisites

- **Node.js** >= 24.14.1
- A **Notion account** with access to create integrations

## Method 1: Claude Code Plugin (Recommended)

1. Open Claude Code in your terminal
2. Run:
   ```bash
   /plugin marketplace add n24q02m/claude-plugins
   /plugin install better-notion-mcp@n24q02m-plugins
   ```
3. The plugin uses remote HTTP mode with OAuth. A browser window opens for Notion authorization on first use. No `NOTION_TOKEN` needed.

## Method 2: HTTP Remote (No Token Needed)

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

## Method 3: npx (Local Stdio with Token)

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

## Method 4: Docker

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

## Method 5: Self-Hosting HTTP Mode

Host your own multi-user OAuth server.

### Prerequisites

1. Create a **Public Integration** at https://www.notion.so/my-integrations
2. Set the redirect URI to `https://your-domain.com/callback`
3. Note the `client_id` and `client_secret`

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

### Zero-Config Relay

> **Recommended for new users.** The relay is the primary setup method -- no environment variables needed. Credentials are encrypted end-to-end and stored locally.


If `NOTION_TOKEN` is not set in stdio mode, the server opens a relay setup page:
1. A setup URL appears in the terminal
2. Open it in a browser
3. Enter your integration token
4. The token is encrypted and stored locally

## Environment Variable Reference

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `NOTION_TOKEN` | Yes (stdio) | -- | Notion internal integration token (`ntn_...`). |
| `TRANSPORT_MODE` | No | `stdio` | Set to `http` for remote OAuth mode. |
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

### "Relay setup page not opening"

- The relay page only appears when `NOTION_TOKEN` is not set in stdio mode.
- If running in Docker, ensure port mapping is correct.
- Try opening the URL manually from the terminal output.

### npx: old version or "command not found"

- Verify Node.js >= 24.14.1: `node --version`.
- Clear the npx cache or use `@latest` tag: `npx -y @n24q02m/better-notion-mcp@latest`.

### comments.list returns 404

- This is a known Notion API issue with OAuth tokens on API version `2025-09-03`. Use stdio mode with an integration token for full comment support.
