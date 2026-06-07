/**
 * ID Utilities
 * Centralized ID normalization, validation, and format detection
 */

/** UUID regex — strictly validates hyphenated (8-4-4-4-12) or compact (32 hex) formats */
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
  if (!UUID_REGEX.test(id)) return false

  // If it has hyphens, ensure they are in the correct 8-4-4-4-12 positions
  if (id.includes('-')) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  }

  // No hyphens, UUID_REGEX already checked it's exactly 32 hex chars
  return true
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

/** Maximum Base64 string length (64MB) to prevent OOM during validation */
const MAX_BASE64_LENGTH = 64 * 1024 * 1024

/**
 * Check if a string is valid base64 encoding
 * Used to validate file_content before Buffer.from
 * Implements strict validation by checking character set, length, and canonicality
 */
export function isValidBase64(str: string): boolean {
  if (typeof str !== 'string' || str.length === 0 || str.length % 4 !== 0) {
    return false
  }

  if (str.length > MAX_BASE64_LENGTH) {
    return false
  }

  // Basic regex check for character set and padding structure
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
    return false
  }

  // Strict check: Buffer roundtrip to ensure canonicality
  try {
    const buffer = Buffer.from(str, 'base64')
    return buffer.toString('base64') === str
  } catch {
    return false
  }
}
