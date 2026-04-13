/**
 * Config schema for relay + local OAuth credential form.
 *
 * Defines a single field: NOTION_TOKEN (integration token).
 * Consumed by:
 *  - `@n24q02m/mcp-core` runLocalServer -- renders the credential form at /authorize
 *  - The hosted relay page (stdio mode) -- renders the same form remotely
 */

import type { RelayConfigSchema } from '@n24q02m/mcp-core/schema'

export const RELAY_SCHEMA: RelayConfigSchema = {
  server: 'better-notion-mcp',
  displayName: 'Notion MCP',
  fields: [
    {
      key: 'NOTION_TOKEN',
      label: 'Integration Token',
      type: 'password',
      placeholder: 'ntn_...',
      helpUrl: 'https://www.notion.so/my-integrations',
      helpText: 'Create an integration and copy the Internal Integration Secret',
      required: true,
      validation: '^(secret_|ntn_).+'
    }
  ]
}
