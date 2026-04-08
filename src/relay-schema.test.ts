/**
 * Tests for the relay config schema.
 *
 * Verifies the structure and properties of the RELAY_SCHEMA object.
 */

import { describe, expect, it } from 'vitest'
import { RELAY_SCHEMA } from './relay-schema.js'

describe('RELAY_SCHEMA', () => {
  it('verifies the server and displayName properties', () => {
    expect(RELAY_SCHEMA.server).toBe('better-notion-mcp')
    expect(RELAY_SCHEMA.displayName).toBe('Notion MCP')
  })

  it('verifies the NOTION_TOKEN field configuration', () => {
    expect(RELAY_SCHEMA.fields).toBeDefined()
    expect(RELAY_SCHEMA.fields).toHaveLength(1)

    const field = RELAY_SCHEMA.fields![0]
    expect(field).toMatchObject({
      key: 'NOTION_TOKEN',
      label: 'Integration Token',
      type: 'password',
      placeholder: 'ntn_...',
      required: true,
      helpUrl: 'https://www.notion.so/my-integrations'
    })

    expect(field.helpText).toContain('Internal Integration Secret')
  })
})
