/**
 * Property Helpers
 * Convert between human-friendly and Notion API formats
 */

import * as RichText from './richtext.js'

const PAGE_ID_REGEX = /([a-f0-9]{32})/

/** Extract a 32-char hex page ID from a Notion URL, or return the input as-is if it's already a raw ID */
function extractPageId(value: any): string {
  if (typeof value !== 'string') return String(value)
  const match = value.match(PAGE_ID_REGEX)
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
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          return { relation: parsed.map((v: string) => ({ id: extractPageId(v) })) }
        }
      } catch {
        // Not valid JSON, treat as single value
      }
    }
    return { relation: [{ id: extractPageId(value) }] }
  }
  if (Array.isArray(value)) {
    return {
      relation: value.map((v: any) => (typeof v === 'object' && v !== null && 'id' in v ? v : { id: extractPageId(v) }))
    }
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
  if (!pageProperties) return {}
  const properties: any = {}

  const keys = Object.keys(pageProperties)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const p = pageProperties[key] as any
    // Cache p.type once per iteration -- avoids ~20 redundant property
    // lookups in the if/else-if chain on every Notion page row.
    const type = p.type as string | undefined

    switch (type) {
      case 'title': {
        if (p.title) {
          const title = p.title
          const len = title.length
          const arr = new Array(len)
          for (let j = 0; j < len; j++) arr[j] = title[j].plain_text || ''
          properties[key] = arr.join('')
        }
        break
      }
      case 'rich_text': {
        if (p.rich_text) {
          const richText = p.rich_text
          const len = richText.length
          const arr = new Array(len)
          for (let j = 0; j < len; j++) arr[j] = richText[j].plain_text || ''
          properties[key] = arr.join('')
        }
        break
      }
      case 'select': {
        if (p.select) properties[key] = p.select.name
        break
      }
      case 'multi_select': {
        if (p.multi_select) {
          const ms = p.multi_select
          const arr = new Array(ms.length)
          for (let j = 0; j < ms.length; j++) arr[j] = ms[j].name
          properties[key] = arr
        }
        break
      }
      case 'number': {
        properties[key] = p.number
        break
      }
      case 'checkbox': {
        properties[key] = p.checkbox
        break
      }
      case 'url': {
        properties[key] = p.url
        break
      }
      case 'email': {
        properties[key] = p.email
        break
      }
      case 'phone_number': {
        properties[key] = p.phone_number
        break
      }
      case 'date': {
        if (p.date) {
          const d = p.date
          properties[key] = d.start + (d.end ? ` to ${d.end}` : '')
        }
        break
      }
      case 'relation': {
        if (p.relation) {
          const rel = p.relation
          const arr = new Array(rel.length)
          for (let j = 0; j < rel.length; j++) arr[j] = rel[j].id
          properties[key] = arr
        }
        break
      }
      case 'rollup': {
        if (p.rollup) properties[key] = p.rollup
        break
      }
      case 'people': {
        if (p.people) {
          const ppl = p.people
          const arr = new Array(ppl.length)
          for (let j = 0; j < ppl.length; j++) arr[j] = ppl[j].name || ppl[j].id
          properties[key] = arr
        }
        break
      }
      case 'files': {
        if (p.files) {
          const files = p.files
          const arr = new Array(files.length)
          for (let j = 0; j < files.length; j++) {
            const f = files[j]
            arr[j] = f.file?.url || f.external?.url || f.name
          }
          properties[key] = arr
        }
        break
      }
      case 'formula': {
        if (p.formula) {
          const f = p.formula
          properties[key] = f.type ? (f[f.type] ?? null) : null
        }
        break
      }
      case 'created_time': {
        properties[key] = p.created_time
        break
      }
      case 'last_edited_time': {
        properties[key] = p.last_edited_time
        break
      }
      case 'created_by': {
        if (p.created_by) {
          properties[key] = p.created_by?.name || p.created_by?.id
        }
        break
      }
      case 'last_edited_by': {
        if (p.last_edited_by) {
          properties[key] = p.last_edited_by?.name || p.last_edited_by?.id
        }
        break
      }
      case 'status': {
        if (p.status) {
          properties[key] = p.status?.name
        }
        break
      }
      case 'unique_id': {
        if (p.unique_id) {
          const u = p.unique_id
          properties[key] = u.prefix ? `${u.prefix}-${u.number}` : u.number
        }
        break
      }
    }
  }
  return properties
}
