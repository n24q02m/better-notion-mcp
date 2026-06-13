/**
 * Property Helpers
 * Convert between human-friendly and Notion API formats
 */

import * as RichText from './richtext.js'

/** Extract a 32-char hex page ID from a Notion URL, or return the input as-is if it's already a raw ID */
function extractPageId(value: any): string {
  if (typeof value !== 'string') return String(value)
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
 * Internal formatters for Notion property types.
 * Optimized for performance and readability.
 */
const PROPERTY_FORMATTERS: Record<string, (p: any) => any> = {
  title: (p) => {
    if (!p.title) return undefined
    let str = ''
    const title = p.title
    for (let j = 0; j < title.length; j++) str += title[j].plain_text || ''
    return str
  },
  rich_text: (p) => {
    if (!p.rich_text) return undefined
    let str = ''
    const richText = p.rich_text
    for (let j = 0; j < richText.length; j++) str += richText[j].plain_text || ''
    return str
  },
  select: (p) => (p.select ? p.select.name : undefined),
  multi_select: (p) => {
    if (!p.multi_select) return undefined
    const ms = p.multi_select
    const arr = new Array(ms.length)
    for (let j = 0; j < ms.length; j++) arr[j] = ms[j].name
    return arr
  },
  number: (p) => p.number,
  checkbox: (p) => p.checkbox,
  url: (p) => p.url,
  email: (p) => p.email,
  phone_number: (p) => p.phone_number,
  date: (p) => {
    if (!p.date) return undefined
    const d = p.date
    return d.start + (d.end ? ` to ${d.end}` : '')
  },
  relation: (p) => {
    if (!p.relation) return undefined
    const rel = p.relation
    const arr = new Array(rel.length)
    for (let j = 0; j < rel.length; j++) arr[j] = rel[j].id
    return arr
  },
  rollup: (p) => p.rollup || undefined,
  people: (p) => {
    if (!p.people) return undefined
    const ppl = p.people
    const arr = new Array(ppl.length)
    for (let j = 0; j < ppl.length; j++) arr[j] = ppl[j].name || ppl[j].id
    return arr
  },
  files: (p) => {
    if (!p.files) return undefined
    const files = p.files
    const arr = new Array(files.length)
    for (let j = 0; j < files.length; j++) {
      const f = files[j]
      arr[j] = f.file?.url || f.external?.url || f.name
    }
    return arr
  },
  formula: (p) => {
    if (!p.formula) return undefined
    const f = p.formula
    return f.type ? (f[f.type] ?? null) : null
  },
  created_time: (p) => p.created_time,
  last_edited_time: (p) => p.last_edited_time,
  created_by: (p) => (p.created_by ? p.created_by.name || p.created_by.id : undefined),
  last_edited_by: (p) => (p.last_edited_by ? p.last_edited_by.name || p.last_edited_by.id : undefined),
  status: (p) => (p.status ? p.status.name : undefined),
  unique_id: (p) => {
    if (!p.unique_id) return undefined
    const u = p.unique_id
    return u.prefix ? `${u.prefix}-${u.number}` : u.number
  }
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
    const type = p.type as string | undefined
    if (!type) continue

    const formatter = PROPERTY_FORMATTERS[type]
    if (formatter) {
      const val = formatter(p)
      if (val !== undefined) {
        properties[key] = val
      }
    }
  }
  return properties
}
