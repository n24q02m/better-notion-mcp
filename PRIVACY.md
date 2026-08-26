# Privacy Policy — Better Notion MCP

**Last updated:** 2026-08-24

## Data Collection

Better Notion MCP acts as a proxy between MCP clients (Claude, Cursor, etc.) and the Notion API. It does **not** collect, store, or transmit any user data beyond what is necessary for the current request.

## HTTP Mode (Self-Hosted)

The project does not operate a public hosted Notion MCP service. If you run HTTP mode on infrastructure you control:

- **Authentication**: Uses the Notion OAuth 2.0 credentials you configure.
- **Token storage**: Access-token storage and retention are controlled by your deployment configuration.
- **No content database by default**: The server does not require a Notion content database.
- **Logging**: Logging and monitoring are controlled by the operator of the self-hosted deployment.

## Stdio Mode (Local)

When running locally via npm or Docker:

- All data stays on your machine.
- Your `NOTION_TOKEN` is read from environment variables and never transmitted anywhere except the Notion API.

## Third-Party Services

- **Notion API** (`api.notion.com`): Your data is subject to [Notion's Privacy Policy](https://www.notion.so/Privacy-Policy-3468d120cf614d4c9014c09f6aab3571).
- **Self-hosting provider**: If you deploy HTTP mode, data processing by your chosen infrastructure provider is governed by that provider's terms and your configuration.

## Contact

For privacy questions: n24q02m@gmail.com
