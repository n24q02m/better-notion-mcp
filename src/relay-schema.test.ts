import { describe, expect, it } from 'vitest'
import { RELAY_SCHEMA } from './relay-schema.js'

describe('RELAY_SCHEMA', () => {
  it('has the correct server and displayName', () => {
    expect(RELAY_SCHEMA.server).toBe('better-notion-mcp')
    expect(RELAY_SCHEMA.displayName).toBe('Notion MCP')
  })

  it('contains the correct configuration for NOTION_TOKEN', () => {
    expect(RELAY_SCHEMA.fields).toHaveLength(1)
    const field = RELAY_SCHEMA.fields![0]
    expect(field.key).toBe('NOTION_TOKEN')
    expect(field.label).toBe('Integration Token')
    expect(field.type).toBe('password')
    expect(field.placeholder).toBe('ntn_...')
    expect(field.required).toBe(true)
    expect(field.helpUrl).toBe('https://www.notion.so/my-integrations')
    expect(field.helpText).toBe('Create an integration and copy the Internal Integration Secret')
  })
})
