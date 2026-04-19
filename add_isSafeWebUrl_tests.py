import sys

with open('src/tools/helpers/security.test.ts', 'r') as f:
    content = f.read()

# Update the import
content = content.replace("import { isSafeUrl, wrapToolResult } from './security'", "import { isSafeUrl, wrapToolResult, isSafeWebUrl } from './security'")

new_tests = """
  describe('isSafeWebUrl', () => {
    it('should allow valid http and https URLs', () => {
      expect(isSafeWebUrl('https://example.com')).toBe(true)
      expect(isSafeWebUrl('http://example.com')).toBe(true)
    })

    it('should reject non-http/https protocols', () => {
      expect(isSafeWebUrl('mailto:user@example.com')).toBe(false)
      expect(isSafeWebUrl('tel:+1234567890')).toBe(false)
      expect(isSafeWebUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeWebUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isSafeWebUrl('file:///etc/passwd')).toBe(false)
    })

    it('should reject URLs with control characters and whitespace', () => {
      expect(isSafeWebUrl(' https://example.com')).toBe(false)
      expect(isSafeWebUrl('https://example.com ')).toBe(false)
      expect(isSafeWebUrl('https://example.com\\n')).toBe(false)
      expect(isSafeWebUrl('https://example.com\\r')).toBe(false)
      expect(isSafeWebUrl('\\x00https://example.com')).toBe(false)
    })

    it('should reject URLs with leading hyphens', () => {
      expect(isSafeWebUrl('-https://example.com')).toBe(false)
      expect(isSafeWebUrl('--flag')).toBe(false)
    })

    it('should reject malformed URLs that fail parsing', () => {
      expect(isSafeWebUrl('/relative/path')).toBe(false)
      expect(isSafeWebUrl('just-a-string')).toBe(false)
      expect(isSafeWebUrl('http://[')).toBe(false)
    })
  })
"""

# Insert the new tests before the last describe block
parts = content.split("  describe('wrapToolResult', () => {")
content = parts[0] + new_tests + "\n  describe('wrapToolResult', () => {" + parts[1]

with open('src/tools/helpers/security.test.ts', 'w') as f:
    f.write(content)
