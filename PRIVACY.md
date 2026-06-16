# Privacy Policy — Better Notion MCP

**Last updated:** 2026-06-16

## Data Collection

Better Notion MCP acts as a proxy between MCP clients (Claude, Cursor, etc.) and the Notion API. It does **not** collect, store, or transmit any user data beyond what is necessary for the current request.

## OAuth Mode (Remote Server)

When using the remote server at `notion.n24q02m.com`:

- **Authentication**: Uses Notion OAuth 2.0.
- **Token storage**: Your Notion access token is encrypted (AES-GCM) and stored in Cloudflare KV, scoped to your authenticated session (keyed by your OAuth identity) so that no other user can read it and so you do not have to re-authorize after a server restart. It is used only to call the Notion API on your behalf and is never logged.
- **No content database**: Beyond the encrypted access token above, no Notion page content or session history is persisted between requests.
- **Logging**: Only anonymous request metadata (timestamps, status codes) is logged for operational monitoring. No Notion content is logged.

## Stdio Mode (Local)

When running locally via npm or Docker:

- All data stays on your machine.
- Your `NOTION_TOKEN` is read from environment variables and never transmitted anywhere except the Notion API.

## Third-Party Services

- **Notion API** (`api.notion.com`): Your data is subject to [Notion's Privacy Policy](https://www.notion.so/Privacy-Policy-3468d120cf614d4c9014c09f6aab3571).
- **Cloudflare**: The remote server runs on Cloudflare (Workers + Containers + KV), which also provides DNS proxy and DDoS protection. See [Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/).

## Contact

For privacy questions: n24q02m@gmail.com
