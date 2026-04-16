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
  for (let i = 0, len = keys.length; i < len; i++) {
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
        const vLen = value.length
        const multiSelect = new Array(vLen)
        for (let j = 0; j < vLen; j++) {
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
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i]
    const p = pageProperties[key] as any

    if (p.type === 'title' && p.title) {
      let str = ''
      const t = p.title
      for (let j = 0, tLen = t.length; j < tLen; j++) {
        const pt = t[j].plain_text
        if (pt) str += pt
      }
      properties[key] = str
    } else if (p.type === 'rich_text' && p.rich_text) {
      let str = ''
      const rtArr = p.rich_text
      for (let j = 0, rtLen = rtArr.length; j < rtLen; j++) {
        const pt = rtArr[j].plain_text
        if (pt) str += pt
      }
      properties[key] = str
    } else if (p.type === 'select' && p.select) {
      properties[key] = p.select.name
    } else if (p.type === 'multi_select' && p.multi_select) {
      const ms = p.multi_select
      const msLen = ms.length
      const arr = new Array(msLen)
      for (let j = 0; j < msLen; j++) arr[j] = ms[j].name
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
      const rel = p.relation
      const relLen = rel.length
      const arr = new Array(relLen)
      for (let j = 0; j < relLen; j++) arr[j] = rel[j].id
      properties[key] = arr
    } else if (p.type === 'rollup' && p.rollup) {
      properties[key] = p.rollup
    } else if (p.type === 'people' && p.people) {
      const ppl = p.people
      const pplLen = ppl.length
      const arr = new Array(pplLen)
      for (let j = 0; j < pplLen; j++) {
        const person = ppl[j]
        arr[j] = person.name || person.id
      }
      properties[key] = arr
    } else if (p.type === 'files' && p.files) {
      const f = p.files
      const fLen = f.length
      const arr = new Array(fLen)
      for (let j = 0; j < fLen; j++) {
        const fileObj = f[j]
        arr[j] = fileObj.file?.url || fileObj.external?.url || fileObj.name
      }
      properties[key] = arr
    } else if (p.type === 'formula' && p.formula) {
      properties[key] = p.formula.type ? (p.formula[p.formula.type] ?? null) : null
    } else if (p.type === 'created_time') {
      properties[key] = p.created_time
    } else if (p.type === 'last_edited_time') {
      properties[key] = p.last_edited_time
    } else if (p.type === 'created_by' && p.created_by) {
      const cb = p.created_by
      properties[key] = cb.name || cb.id
    } else if (p.type === 'last_edited_by' && p.last_edited_by) {
      const leb = p.last_edited_by
      properties[key] = leb.name || leb.id
    } else if (p.type === 'status' && p.status) {
      properties[key] = p.status.name
    } else if (p.type === 'unique_id' && p.unique_id) {
      const uid = p.unique_id
      properties[key] = uid.prefix ? `${uid.prefix}-${uid.number}` : uid.number
    }
  }
  return properties
}
