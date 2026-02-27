/**
 * Property Helpers
 * Convert between human-friendly and Notion API formats
 */

import * as RichText from './richtext.js'

/**
 * Convert simple property values to Notion API format
 * Handles auto-detection of property types and conversion
 */
export function convertToNotionProperties(
  properties: Record<string, any>,
  schema?: Record<string, string>
): Record<string, any> {
  const converted: Record<string, any> = {}

  for (const [key, value] of Object.entries(properties)) {
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
      // Could be multi_select, relation, people, files
      if (value.length > 0 && typeof value[0] === 'string') {
        // Assume multi_select
        converted[key] = {
          multi_select: value.map((v) => ({ name: v }))
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
 * Extract plain values from Notion property objects
 * Converts complex Notion API property objects into simple key-value pairs
 */
export function extractPageProperties(properties: Record<string, any>): Record<string, any> {
  const extracted: Record<string, any> = {}

  for (const [key, prop] of Object.entries(properties)) {
    const p = prop as any
    if (p.type === 'title' && p.title) {
      extracted[key] = p.title.map((t: any) => t.plain_text).join('')
    } else if (p.type === 'rich_text' && p.rich_text) {
      extracted[key] = p.rich_text.map((t: any) => t.plain_text).join('')
    } else if (p.type === 'select' && p.select) {
      extracted[key] = p.select.name
    } else if (p.type === 'multi_select' && p.multi_select) {
      extracted[key] = p.multi_select.map((s: any) => s.name)
    } else if (p.type === 'number') {
      extracted[key] = p.number
    } else if (p.type === 'checkbox') {
      extracted[key] = p.checkbox
    } else if (p.type === 'url') {
      extracted[key] = p.url
    } else if (p.type === 'email') {
      extracted[key] = p.email
    } else if (p.type === 'phone_number') {
      extracted[key] = p.phone_number
    } else if (p.type === 'date' && p.date) {
      extracted[key] = p.date.start + (p.date.end ? ` to ${p.date.end}` : '')
    } else if (p.type === 'relation' && p.relation) {
      extracted[key] = p.relation.map((r: any) => r.id)
    } else if (p.type === 'rollup' && p.rollup) {
      extracted[key] = p.rollup
    } else if (p.type === 'people' && p.people) {
      extracted[key] = p.people.map((person: any) => person.name || person.id)
    } else if (p.type === 'files' && p.files) {
      extracted[key] = p.files.map((f: any) => f.file?.url || f.external?.url || f.name)
    } else if (p.type === 'formula' && p.formula) {
      const formula = p.formula
      extracted[key] = formula[formula.type]
    } else if (p.type === 'created_time') {
      extracted[key] = p.created_time
    } else if (p.type === 'last_edited_time') {
      extracted[key] = p.last_edited_time
    } else if (p.type === 'created_by' && p.created_by) {
      extracted[key] = p.created_by.name || p.created_by.id
    } else if (p.type === 'last_edited_by' && p.last_edited_by) {
      extracted[key] = p.last_edited_by.name || p.last_edited_by.id
    } else if (p.type === 'status' && p.status) {
      extracted[key] = p.status.name
    } else if (p.type === 'unique_id' && p.unique_id) {
      extracted[key] = p.unique_id.prefix ? `${p.unique_id.prefix}-${p.unique_id.number}` : p.unique_id.number
    }
  }

  return extracted
}
