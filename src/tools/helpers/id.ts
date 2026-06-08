/**
 * ID Utilities
 * Centralized ID normalization, validation, and format detection
 */

/** UUID regex — accepts both hyphenated and compact formats */
const UUID_REGEX = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/**
 * Normalize a Notion ID by removing hyphens
 * Ensures consistent comparison regardless of input format
 */
export function normalizeId(id: string): string {
  // BOLT OPTIMIZATION: Early return to avoid regex overhead on already clean IDs
  if (id.indexOf('-') === -1) return id
  return id.replace(/-/g, '')
}

/**
 * Validate whether a string looks like a Notion UUID
 * Accepts: "a3802967-3621-4b04-b6af-bfef1b7687b3" or "a380296736214b04b6afbfef1b7687b3"
 */
export function isValidNotionId(id: string): boolean {
  return UUID_REGEX.test(id)
}

/**
 * Format a compact UUID into hyphenated form (8-4-4-4-12)
 * Returns original string if not a valid 32-char hex
 */
export function formatId(id: string): string {
  const clean = normalizeId(id)
  if (clean.length !== 32 || !/^[0-9a-f]+$/i.test(clean)) return id
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`
}

/**
 * Maximum length for base64 string to prevent OOM during validation (32MB).
 * This is 3x the max file upload size (10MB) to allow for base64 overhead
 * and concurrent request headroom.
 */
const MAX_BASE64_LENGTH = 32 * 1024 * 1024

/**
 * Check if a string is valid base64 encoding.
 * Used to validate file_content before Buffer.from.
 *
 * Implements multi-stage strict validation for both correctness and safety:
 * 1. Cheap early returns for type, length, and MAX_BASE64_LENGTH (OOM guard).
 * 2. Regex check for character set and padding structure.
 * 3. Buffer roundtrip to ensure canonicality (rejects bits in padding).
 */
export function isValidBase64(str: string): boolean {
  if (typeof str !== 'string' || str.length === 0 || str.length % 4 !== 0 || str.length > MAX_BASE64_LENGTH) {
    return false
  }

  // Basic regex check for character set and padding structure
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
    return false
  }

  // Strict check: Buffer roundtrip to ensure canonicality.
  // The str.length check above ensures this won't cause OOM.
  try {
    const buffer = Buffer.from(str, 'base64')
    return buffer.toString('base64') === str
  } catch {
    return false
  }
}
