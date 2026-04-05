import { describe, expect, it } from 'vitest'
import { RELAY_SCHEMA } from './relay-schema.js'

describe('RELAY_SCHEMA', () => {
  it('should have the correct server and displayName', () => {
    expect(RELAY_SCHEMA.server).toBe('better-notion-mcp')
    expect(RELAY_SCHEMA.displayName).toBe('Notion MCP')
  })

  it('should contain the correct configuration for NOTION_TOKEN', () => {
    expect(RELAY_SCHEMA.fields).toBeDefined()
    expect(RELAY_SCHEMA.fields).toHaveLength(1)

    const field = RELAY_SCHEMA.fields![0]
    expect(field).toMatchObject({
      key: 'NOTION_TOKEN',
      label: 'Integration Token',
      type: 'password',
      placeholder: 'ntn_...',
      helpUrl: 'https://www.notion.so/my-integrations',
      helpText: 'Create an integration and copy the Internal Integration Secret',
      required: true
    })
  })
})
