/**
 * Icon Helpers
 * Format icon values for the Notion API
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError } from './errors.js'
import { isSafeUrl } from './security.js'

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
 * - Notion built-in shorthand: "document:gray" -> { type: "icon", icon: { name: "document", color: "gray" } }
 * - File upload reference: "file_upload:<uuid>" -> { type: "file_upload", file_upload: { id: "<uuid>" } }
 * - Upload from path: "upload:/path/to/file" -> { type: "upload_pending", path: "/path/to/file" }
 */
export function formatIcon(value: string): { type: string; [key: string]: any } {
  if (!value) {
    throw new NotionMCPError(
      'Icon value cannot be empty. Provide an emoji, a valid URL, or a built-in shorthand (name:color).',
      'VALIDATION_ERROR',
      'Provide an emoji, an http/https URL, or a Notion icon shorthand like "document:gray"'
    )
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    if (!isSafeUrl(value)) {
      throw new NotionMCPError(
        `Unsafe icon URL: "${value}". Use http: or https: URLs only.`,
        'VALIDATION_ERROR',
        'Provide a valid http: or https: URL for the icon'
      )
    }
    return { type: 'external', external: { url: value } }
  }
  // file_upload:<uuid> reference
  if (value.startsWith('file_upload:')) {
    const id = value.slice('file_upload:'.length)
    if (!id || !UUID_RE.test(id)) {
      throw new NotionMCPError(
        `Invalid file_upload icon: "${value}". Provide a valid UUID after "file_upload:".`,
        'VALIDATION_ERROR',
        'Format: file_upload:<uuid> (e.g., file_upload:a1b2c3d4-e5f6-7890-abcd-ef1234567890)'
      )
    }
    return { type: 'file_upload', file_upload: { id } }
  }
  // upload:/path marker for deferred file upload
  if (value.startsWith('upload:')) {
    const path = value.slice('upload:'.length)
    if (!path?.startsWith('/')) {
      throw new NotionMCPError(
        `Invalid upload icon path: "${value}". Provide an absolute path after "upload:".`,
        'VALIDATION_ERROR',
        'Format: upload:/absolute/path/to/file.png'
      )
    }
    return { type: 'upload_pending', path }
  }
  if (isNotionIconShorthand(value)) {
    const colonIdx = value.lastIndexOf(':')
    const name = value.slice(0, colonIdx)
    const color = value.slice(colonIdx + 1)
    return { type: 'icon', icon: { name, color } }
  }
  // Reject dangerous URL schemes before falling through to emoji
  if (!isSafeUrl(value)) {
    throw new NotionMCPError(
      `Unsafe icon value: "${value}". Use an emoji, a valid URL, or a built-in shorthand (name:color).`,
      'VALIDATION_ERROR',
      'Provide an emoji, an http/https URL, or a Notion icon shorthand like "document:gray"'
    )
  }
  return { type: 'emoji', emoji: value }
}

/**
 * Resolve an icon object, handling upload_pending by reading the file and uploading via Notion API.
 * All other icon types are passed through unchanged.
 */
export async function resolveIcon(
  icon: { type: string; [key: string]: any },
  notion: Client
): Promise<{ type: string; [key: string]: any }> {
  if (icon.type !== 'upload_pending') return icon

  const fs = await import('node:fs/promises')
  const pathMod = await import('node:path')

  const filePath: string = icon.path
  const fileContent = await fs.readFile(filePath)
  const filename = pathMod.basename(filePath)
  const ext = pathMod.extname(filePath).toLowerCase()
  const contentType =
    ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.svg'
          ? 'image/svg+xml'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.webp'
              ? 'image/webp'
              : 'application/octet-stream'

  // Create upload session
  const createResult: any = await (notion as any).fileUploads.create({
    filename,
    content_type: contentType
  })

  // Send content
  const blob = new Blob([fileContent], { type: contentType })
  await (notion as any).fileUploads.send({
    file_upload_id: createResult.id,
    file: { data: blob, filename }
  })

  // Complete (only needed for multi-part uploads — single-part auto-completes after send)
  try {
    await (notion as any).fileUploads.complete({
      file_upload_id: createResult.id
    })
  } catch {
    // Ignore — single-part uploads are already in 'uploaded' status after send
  }

  return { type: 'file_upload', file_upload: { id: createResult.id } }
}
