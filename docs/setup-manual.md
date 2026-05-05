# Better Notion MCP -- Manual Setup Guide

> **2026-05-02 Update (v<auto>+)**: Plugin install (Method 1) now uses pure stdio mode with `NOTION_TOKEN` env var.
> The previous "Zero-Config Relay" auto-spawn pattern has been removed.
> If you relied on the relay form to enter your token, please:
> 1. Set `NOTION_TOKEN` directly in plugin config (Method 1), OR
> 2. Switch to HTTP mode (Method 3 (Docker HTTP — Hosted or Self-host)) for browser-based OAuth.

## Method overview

This plugin supports 3 install methods. Pick the one that matches your use case:

| Priority | Method | Transport | Best for |
|---|---|---|---|
| **1. Default** | Plugin install (`uvx`/`npx`) | stdio | Quick local start, single workstation, no OAuth/HTTP needed. |
| **2. Fallback** | Docker stdio (`docker run -i --rm`) | stdio | Windows/macOS where native uvx/npx hits PATH or Python version issues. |
| **3. Recommended** | Docker HTTP (`docker run -p 8080:8080`) | HTTP | Multi-device, OAuth/relay-form auth, team self-host, claude.ai web compatibility. |

All MCP servers across this stack share this priority hierarchy. Note: 2 plugins (`better-godot-mcp` and `better-code-review-graph`) only support Method 1 (stdio) -- they need direct host access to project files / repo paths and don't ship Docker / HTTP variants.

> **⚠️ Mutually exclusive — pick ONE per plugin**: If you choose Method 2 (Docker stdio override) OR Method 3 (HTTP), do NOT also `/plugin install` this plugin via marketplace. Both load simultaneously and create duplicate entries in `/mcp` dialog (plugin's stdio + your override). Plugin matching is by **endpoint** (URL or command string) per CC docs, not by name — and `npx`/`uvx` ≠ `docker` ≠ HTTP URL, so all three are distinct endpoints. Trade-off: choosing Method 2 or Method 3 means you lose this plugin's skills/agents/hooks/commands. For full plugin features, use Method 1 (default plugin install) with `userConfig` credentials prompted at install time.

## Prerequisites

- **Node.js** >= 24.14.1
- A **Notion account** with access to create integrations

## Method 1: Claude Code Plugin (Recommended)

Plugin marketplace install runs the server in **pure stdio mode** with `NOTION_TOKEN` env var. No daemon-bridge, no auto-spawn, no relay form.

### Credential prompts at install

When you run `/plugin install`, Claude Code prompts you for the following credentials (declared in `userConfig` per CC docs). Sensitive values are stored in your system keychain and persist across `/plugin update`:

| Field | Required | Where to obtain |
|---|---|---|
| `NOTION_TOKEN` | Required | https://www.notion.so/my-integrations (starts with `ntn_`) |

### Steps

1. Create a Notion integration token:
   - Go to https://www.notion.so/my-integrations
   - Click "New integration", name it (e.g. "Better Notion MCP"), select your workspace
   - Copy the "Internal Integration Secret" (starts with `ntn_`)
   - **Share pages with the integration**: open a Notion page > "..." > Connections > select your integration. Repeat for each page or database you want accessible.
2. Open Claude Code in your terminal
3. Install the plugin (Claude Code prompts for `NOTION_TOKEN` -- paste the secret you copied above):
   ```bash
   /plugin marketplace add n24q02m/claude-plugins
   /plugin install better-notion-mcp@n24q02m-plugins
   ```
4. Restart Claude Code. The plugin auto-loads with your token injected via `${user_config.NOTION_TOKEN}`.

> **Note**: This installs the full plugin (skills + agents + hooks + commands + stdio MCP server). If you'd rather use Method 2 (Docker stdio) or Method 3 (HTTP) below, DO NOT `/plugin install` this plugin — pick Method 2 or Method 3 instead. All three methods are mutually exclusive (see Method overview).

## Method 2: Docker stdio (fallback)

> **⚠️ Before adding the Docker stdio override below, ensure this plugin is NOT installed via marketplace**: Run `/plugin uninstall better-notion-mcp@n24q02m-plugins` first if you previously ran `/plugin install`. Otherwise both entries (plugin's `npx`/`uvx` stdio + your `docker run` stdio) will load simultaneously since plugin matches by endpoint (command string), not by name.
>
> **Trade-off accepted**: Choosing this method means you lose this plugin's skills/agents/hooks/commands. Use Method 1 instead if you want full plugin features.

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

Stdio is the default and works fine for single-user local setups. You may want to switch to HTTP mode (Method 3 Docker HTTP (Hosted or Self-host)) when you need any of the following:

- **claude.ai web compatibility** -- claude.ai (the web UI) supports HTTP MCP servers but cannot spawn local stdio processes.
- **One server shared across N Claude Code sessions** -- a single HTTP instance serves multiple terminals/IDEs without re-spawning per session.
- **OAuth flow delegated to `api.notion.com`** -- no manual token paste; users grant access through Notion's standard authorization page.
- **Multi-device credential sync** -- sign in once on your laptop, the same OAuth grant works from your desktop / tablet without copying tokens.
- **Multi-user team sharing** -- a self-hosted server can serve multiple Notion accounts, each with isolated per-user tokens (per-JWT-sub).
- **Always-on persistent process for webhooks/agents** -- HTTP servers stay alive between sessions, enabling background work, scheduled agents, or webhook listeners.

## Method 3: Docker HTTP (recommended)

> **⚠️ Before adding the HTTP override below, ensure this plugin is NOT installed via marketplace**: Run `/plugin uninstall better-notion-mcp@n24q02m-plugins` first if you previously ran `/plugin install`. Otherwise both entries (plugin's stdio + your HTTP override) will load simultaneously since plugin matches by endpoint, not name.
>
> **Trade-off accepted**: Choosing this method means you lose this plugin's skills/agents/hooks/commands. For example, the `better-notion-mcp:organize-database` skill will no longer be available. Use Method 1 instead if you want full plugin features.

> **Switching transport vs. setting credentials**: The `userConfig` prompt only configures credentials for stdio mode (Method 1 / Option 1). To switch transport to HTTP, override `mcpServers` in your client settings per the snippets below -- this is a separate path from `userConfig` and is not driven by the install prompt.

### 3.1. Hosted (n24q02m.com)

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

### 3.2. Self-host with docker-compose

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

### Edge auth: relay password

Public HTTP deployments expose `<your-domain>/authorize` to URL discovery. To prevent random Internet users from accessing the relay form, mint a relay password:

```bash
openssl rand -hex 32
# Save in your skret / .env as:
MCP_RELAY_PASSWORD=<generated-32-byte-hex>
```

Share this password out-of-band (Signal/email/SMS) with anyone you invite to use your server. They will see a login form when first opening `/authorize`; once logged in, the cookie persists 24 hours.

**Single-user dev exception**: If `PUBLIC_URL=http://localhost:8080`, you can leave `MCP_RELAY_PASSWORD` empty to disable the gate. The server logs a warning if you skip the password with a non-localhost `PUBLIC_URL`.

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
