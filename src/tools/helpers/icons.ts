/**
 * Icon Helpers
 * Format icon values for the Notion API
 */

const NOTION_ICON_COLORS = new Set([
  'pink',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'brown',
  'gray',
  'lightgray'
])

/** Check if a string is a Notion built-in icon shorthand (e.g. "helm:blue") */
function isNotionIconShorthand(value: string): boolean {
  if (value.startsWith('http://') || value.startsWith('https://')) return false
  const colonIdx = value.lastIndexOf(':')
  if (colonIdx < 1) return false
  const color = value.slice(colonIdx + 1)
  return NOTION_ICON_COLORS.has(color)
}

/**
 * Format an icon value for the Notion API.
 * Accepts:
 * - Emoji: "🚀" -> { type: "emoji", emoji: "🚀" }
 * - External URL: "https://..." -> { type: "external", external: { url } }
 * - Notion built-in shorthand: "document:gray" -> { type: "external", external: { url: "https://www.notion.so/icons/document_gray.svg" } }
 */
export function formatIcon(value: string): { type: string; [key: string]: any } {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return { type: 'external', external: { url: value } }
  }
  if (isNotionIconShorthand(value)) {
    const colonIdx = value.lastIndexOf(':')
    const name = value.slice(0, colonIdx)
    const color = value.slice(colonIdx + 1)
    return { type: 'external', external: { url: `https://www.notion.so/icons/${name}_${color}.svg` } }
  }
  return { type: 'emoji', emoji: value }
}
