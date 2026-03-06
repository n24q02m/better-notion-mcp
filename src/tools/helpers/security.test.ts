import { describe, expect, it } from 'vitest'
import { isSafeUrl } from './security'

describe('Security: URL Validation', () => {
  describe('isSafeUrl', () => {
    it('should allow valid http and https URLs', () => {
      expect(isSafeUrl('https://example.com')).toBe(true)
      expect(isSafeUrl('http://example.com')).toBe(true)
    })

    it('should allow valid mailto and tel URLs', () => {
      expect(isSafeUrl('mailto:user@example.com')).toBe(true)
      expect(isSafeUrl('tel:+1234567890')).toBe(true)
    })

    it('should reject javascript:, data:, and vbscript: URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
    })

    it('should reject URLs with control characters and whitespace obfuscation', () => {
      expect(isSafeUrl(' javascript:alert(1)')).toBe(false)
      expect(isSafeUrl('java\nscript:alert(1)')).toBe(false)
      expect(isSafeUrl('java\r\nscript:alert(1)')).toBe(false)
      expect(isSafeUrl('\x00javascript:alert(1)')).toBe(false)
      expect(isSafeUrl('java\x00script:alert(1)')).toBe(false)
      expect(isSafeUrl(' javascript : alert(1) ')).toBe(false)
    })

    it('should reject URLs with HTML entity obfuscation', () => {
      expect(isSafeUrl('javascript&colon;alert(1)')).toBe(false)
      expect(isSafeUrl('data&colon;text/html,<script>alert(1)</script>')).toBe(false)
      expect(isSafeUrl('vbscript&colon;msgbox(1)')).toBe(false)
      expect(isSafeUrl('javascript&#58;alert(1)')).toBe(false)
      expect(isSafeUrl('javascript&#0000058alert(1)')).toBe(false)
    })
  })
})
