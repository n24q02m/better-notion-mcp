import { describe, expect, it } from 'vitest'
import { parseRichText } from './markdown'

describe('parseRichText', () => {
  it('should parse a normal link', () => {
    const result = parseRichText('[Google](https://google.com)')
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'Google', link: { url: 'https://google.com' } },
        annotations: expect.objectContaining({ bold: false })
      }
    ])
  })

  it('should parse a link embedded in text', () => {
    const result = parseRichText('Check [Google](https://google.com) now')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(expect.objectContaining({ text: { content: 'Check ', link: null } }))
    expect(result[1]).toEqual(
      expect.objectContaining({ text: { content: 'Google', link: { url: 'https://google.com' } } })
    )
    expect(result[2]).toEqual(expect.objectContaining({ text: { content: ' now', link: null } }))
  })

  it('should handle invalid link syntax (missing paren)', () => {
    const result = parseRichText('[Google]')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe('[Google]')
    expect(result[0].text.link).toBeNull()
  })

  it('should handle invalid link syntax (space between)', () => {
    const result = parseRichText('[Google] (https://google.com)')
    expect(result[0].text.content).toBe('[Google] (https://google.com)')
    expect(result[0].text.link).toBeNull()
  })

  it('should parse multiple links', () => {
    const result = parseRichText('[A](u1) and [B](u2)')
    expect(result).toHaveLength(3)
    expect(result[0].text.link?.url).toBe('u1')
    expect(result[2].text.link?.url).toBe('u2')
  })

  it('should handle nested brackets correctly (inner is text)', () => {
    // Current behavior: parses from first [, finds first ], checks for (.
    // [ a [ b ](url) -> matches ] at 8. ( at 9. Link text: " a [ b ".
    const result = parseRichText('[ a [ b ](url)')
    expect(result).toHaveLength(1)
    expect(result[0].text.content).toBe(' a [ b ')
    expect(result[0].text.link?.url).toBe('url')
  })

  it('should handle ReDoS attempt efficiently', () => {
    const n = 50000
    const maliciousInput = '['.repeat(n) + ']'
    const start = process.hrtime()
    parseRichText(maliciousInput)
    const end = process.hrtime(start)
    const timeInMs = end[0] * 1000 + end[1] / 1e6
    // Should be very fast (< 100ms usually, definitely < 1000ms)
    expect(timeInMs).toBeLessThan(1000)
  })
})
