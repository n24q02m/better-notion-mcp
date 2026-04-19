import sys

with open('src/tools/helpers/security.ts', 'r') as f:
    content = f.read()

new_func = """

/**
 * Strict validation for browser-destined URLs.
 * Allows only http: and https: protocols.
 * Rejects leading hyphens to prevent shell flag injection.
 * Rejects whitespace and control characters.
 */
export function isSafeWebUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Reject URLs containing whitespace or control characters
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Security sanitization
  if (/[\\s\\x00-\\x1F\\x7F]/.test(url)) {
    return false
  }

  // Reject leading hyphens which might be parsed as shell flags
  if (url.startsWith('-')) {
    return false
  }

  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
"""

content += new_func

with open('src/tools/helpers/security.ts', 'w') as f:
    f.write(content)
