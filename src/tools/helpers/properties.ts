/**
 * Property Helpers
 * Convert between human-friendly and Notion API formats
 */

import * as RichText from './richtext.js'

/** Extract a 32-char hex page ID from a Notion URL, or return the input as-is if it's already a raw ID */
function extractPageId(value: string): string {
  const match = value.match(/([a-f0-9]{32})/)
  if (match) return match[1]
  // Also accept hyphenated UUIDs as-is
  return value
}

/** Convert a single string or array value to Notion relation format */
function toRelation(value: any): { relation: { id: string }[] } {
  if (typeof value === 'string') {
    if (value === '') return { relation: [] }
    // Try parsing as JSON array (e.g. '["id1", "id2"]')
    if (value.startsWith('[')) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return { relation: parsed.map((v: string) => ({ id: extractPageId(v) })) }
        }
      } catch {
        // Not valid JSON, treat as single value
      }
    }
    return { relation: [{ id: extractPageId(value) }] }
  }
  if (Array.isArray(value)) {
    return { relation: value.map((v: string) => ({ id: extractPageId(v) })) }
  }
  return value
}

/**
 * Convert simple property values to Notion API format
 * Handles auto-detection of property types and conversion
 */
export function convertToNotionProperties(
  properties: Record<string, any>,
  schema?: Record<string, string>
): Record<string, any> {
  const converted: Record<string, any> = {}

  const keys = Object.keys(properties)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = properties[key]

    if (value === null || value === undefined) {
      converted[key] = value
      continue
    }

    // Auto-detect property type and convert
    if (typeof value === 'string') {
      // Use schema type if available
      const schemaType = schema?.[key]

      if (schemaType === 'title') {
        converted[key] = { title: [RichText.text(value)] }
      } else if (schemaType === 'rich_text') {
        converted[key] = { rich_text: [RichText.text(value)] }
      } else if (schemaType === 'date') {
        converted[key] = { date: { start: value } }
      } else if (schemaType === 'url') {
        converted[key] = { url: value }
      } else if (schemaType === 'email') {
        converted[key] = { email: value }
      } else if (schemaType === 'phone_number') {
        converted[key] = { phone_number: value }
      } else if (schemaType === 'relation') {
        converted[key] = toRelation(value)
      } else if (schemaType === 'status') {
        converted[key] = { status: { name: value } }
      } else if (key === 'Name' || key === 'Title' || key.toLowerCase() === 'title') {
        // Fallback: guess title from key name
        converted[key] = { title: [RichText.text(value)] }
      } else {
        // Fallback: default to select
        converted[key] = { select: { name: value } }
      }
    } else if (typeof value === 'number') {
      converted[key] = { number: value }
    } else if (typeof value === 'boolean') {
      converted[key] = { checkbox: value }
    } else if (Array.isArray(value)) {
      const schemaType = schema?.[key]
      if (schemaType === 'relation') {
        converted[key] = toRelation(value)
        continue
      }
      // Could be multi_select, relation, people, files
      // Only assume multi_select if all elements are strings
      if (value.length > 0 && value.every((v) => typeof v === 'string')) {
        const multiSelect = new Array(value.length)
        for (let j = 0; j < value.length; j++) {
          multiSelect[j] = { name: value[j] }
        }
        converted[key] = {
          multi_select: multiSelect
        }
      } else {
        converted[key] = value
      }
    } else if (typeof value === 'object') {
      // Already in Notion format or date/complex object
      converted[key] = value
    } else {
      converted[key] = value
    }
  }

  return converted
}

/**
 * Highly optimized extraction of properties from a Notion page response.
 * Uses direct string building and fixed-length arrays to avoid
 * creating thousands of intermediate arrays during large `.map()` chains.
 */
export function extractPageProperties(pageProperties: any): any {
  const properties: any = {}

  const keys = Object.keys(pageProperties)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const p = pageProperties[key] as any

    if (p.type === 'title' && p.title) {
      let str = ''
      for (let j = 0; j < p.title.length; j++) str += p.title[j].plain_text || ''
      properties[key] = str
    } else if (p.type === 'rich_text' && p.rich_text) {
      let str = ''
      for (let j = 0; j < p.rich_text.length; j++) str += p.rich_text[j].plain_text || ''
      properties[key] = str
    } else if (p.type === 'select' && p.select) {
      properties[key] = p.select.name
    } else if (p.type === 'multi_select' && p.multi_select) {
      const arr = new Array(p.multi_select.length)
      for (let j = 0; j < p.multi_select.length; j++) arr[j] = p.multi_select[j].name
      properties[key] = arr
    } else if (p.type === 'number') {
      properties[key] = p.number
    } else if (p.type === 'checkbox') {
      properties[key] = p.checkbox
    } else if (p.type === 'url') {
      properties[key] = p.url
    } else if (p.type === 'email') {
      properties[key] = p.email
    } else if (p.type === 'phone_number') {
      properties[key] = p.phone_number
    } else if (p.type === 'date' && p.date) {
      properties[key] = p.date.start + (p.date.end ? ` to ${p.date.end}` : '')
    } else if (p.type === 'relation' && p.relation) {
      const arr = new Array(p.relation.length)
      for (let j = 0; j < p.relation.length; j++) arr[j] = p.relation[j].id
      properties[key] = arr
    } else if (p.type === 'rollup' && p.rollup) {
      properties[key] = p.rollup
    } else if (p.type === 'people' && p.people) {
      const arr = new Array(p.people.length)
      for (let j = 0; j < p.people.length; j++) arr[j] = p.people[j].name || p.people[j].id
      properties[key] = arr
    } else if (p.type === 'files' && p.files) {
      const arr = new Array(p.files.length)
      for (let j = 0; j < p.files.length; j++)
        arr[j] = p.files[j].file?.url || p.files[j].external?.url || p.files[j].name
      properties[key] = arr
    } else if (p.type === 'formula' && p.formula) {
      properties[key] = p.formula.type ? (p.formula[p.formula.type] ?? null) : null
    } else if (p.type === 'created_time') {
      properties[key] = p.created_time
    } else if (p.type === 'last_edited_time') {
      properties[key] = p.last_edited_time
    } else if (p.type === 'created_by' && p.created_by) {
      properties[key] = p.created_by?.name || p.created_by?.id
    } else if (p.type === 'last_edited_by' && p.last_edited_by) {
      properties[key] = p.last_edited_by?.name || p.last_edited_by?.id
    } else if (p.type === 'status' && p.status) {
      properties[key] = p.status?.name
    } else if (p.type === 'unique_id' && p.unique_id) {
      properties[key] = p.unique_id.prefix ? `${p.unique_id.prefix}-${p.unique_id.number}` : p.unique_id.number
    }
  }
  return properties
}
