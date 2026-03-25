/**
 * Config schema for relay page setup.
 *
 * Defines a single field: NOTION_TOKEN (integration token).
 * Used by the relay page to render the credential collection form.
 */

import type { RelayConfigSchema } from '@n24q02m/mcp-relay-core/schema'

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
      required: true
    }
  ]
}
