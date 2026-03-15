# Privacy Policy — Better Notion MCP

**Last updated:** 2026-03-08

## Data Collection

Better Notion MCP acts as a proxy between MCP clients (Claude, Cursor, etc.) and the Notion API. It does **not** collect, store, or transmit any user data beyond what is necessary for the current request.

## OAuth Mode (Remote Server)

When using the remote server at `better-notion-mcp.n24q02m.com`:

- **Authentication**: Uses Notion OAuth 2.0. Your Notion access token is used only for the duration of each request and is never stored on disk.
- **No database**: The server is stateless. No user data, tokens, or session information is persisted between requests.
- **Logging**: Only anonymous request metadata (timestamps, status codes) is logged for operational monitoring. No Notion content is logged.

## Stdio Mode (Local)

When running locally via npm or Docker:

- All data stays on your machine.
- Your `NOTION_TOKEN` is read from environment variables and never transmitted anywhere except the Notion API.

## Third-Party Services

- **Notion API** (`api.notion.com`): Your data is subject to [Notion's Privacy Policy](https://www.notion.so/Privacy-Policy-3468d120cf614d4c9014c09f6aab3571).
- **Google Cloud Run**: The remote server runs on Google Cloud. See [Google Cloud Privacy](https://cloud.google.com/terms/cloud-privacy-notice).
- **Cloudflare**: DNS proxy for DDoS protection. See [Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/).

## Contact

For privacy questions: n24q02m@gmail.com
