import { describe, expect, it } from 'vitest'
import { formatCover, listCovers } from './covers'
import { NotionMCPError } from './errors'

describe('formatCover', () => {
  describe('URLs', () => {
    it('should pass through https URLs as external cover', () => {
      const result = formatCover('https://example.com/cover.jpg')
      expect(result).toEqual({ type: 'external', external: { url: 'https://example.com/cover.jpg' } })
    })

    it('should pass through http URLs as external cover', () => {
      const result = formatCover('http://example.com/cover.jpg')
      expect(result).toEqual({ type: 'external', external: { url: 'http://example.com/cover.jpg' } })
    })
  })

  describe('solid colors', () => {
    it('should resolve solid_red to Notion CDN URL', () => {
      const result = formatCover('solid_red')
      expect(result.type).toBe('external')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/solid_red.png')
    })

    it('should resolve solid_blue to Notion CDN URL', () => {
      const result = formatCover('solid_blue')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/solid_blue.png')
    })

    it('should resolve solid_yellow to Notion CDN URL', () => {
      const result = formatCover('solid_yellow')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/solid_yellow.png')
    })

    it('should resolve solid_beige to Notion CDN URL', () => {
      const result = formatCover('solid_beige')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/solid_beige.png')
    })
  })

  describe('gradients', () => {
    it('should resolve gradient_1 (png)', () => {
      const result = formatCover('gradient_1')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/gradients_1.png')
    })

    it('should resolve gradient_10 (jpg)', () => {
      const result = formatCover('gradient_10')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/gradients_10.jpg')
    })

    it('should resolve gradient_11 (jpg)', () => {
      const result = formatCover('gradient_11')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/gradients_11.jpg')
    })
  })

  describe('museum and NASA covers', () => {
    it('should resolve nasa_carina_nebula', () => {
      const result = formatCover('nasa_carina_nebula')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/nasa_carina_nebula.jpg')
    })

    it('should resolve met_paul_signac', () => {
      const result = formatCover('met_paul_signac')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/met_paul_signac.jpg')
    })

    it('should resolve rijksmuseum_rembrandt_1642', () => {
      const result = formatCover('rijksmuseum_rembrandt_1642')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/rijksmuseum_rembrandt_1642.jpg')
    })

    it('should resolve woodcuts_3', () => {
      const result = formatCover('woodcuts_3')
      expect(result.external.url).toBe('https://www.notion.so/images/page-cover/woodcuts_3.jpg')
    })
  })

  describe('error handling', () => {
    it('should throw for unknown shorthand', () => {
      expect(() => formatCover('nonexistent_cover')).toThrow('Unknown cover shorthand')
    })

    it('should include available covers in error message', () => {
      expect(() => formatCover('bogus')).toThrow('solid_red')
    })
  })

  describe('unsafe URL rejection', () => {
    it('rejects javascript: URLs', () => {
      expect(() => formatCover('javascript:alert(1)')).toThrow(NotionMCPError)
    })

    it('rejects data: URLs', () => {
      expect(() => formatCover('data:text/html,<script>alert(1)</script>')).toThrow(NotionMCPError)
    })

    it('rejects vbscript: URLs', () => {
      expect(() => formatCover('vbscript:msgbox(1)')).toThrow(NotionMCPError)
    })
  })
})

describe('listCovers', () => {
  it('should return covers grouped by category', () => {
    const groups = listCovers()
    expect(groups.solid_colors).toContain('solid_red')
    expect(groups.solid_colors).toContain('solid_blue')
    expect(groups.gradients).toContain('gradient_1')
    expect(groups.gradients).toContain('gradient_11')
    expect(groups.nasa).toContain('nasa_carina_nebula')
    expect(groups.met).toContain('met_paul_signac')
    expect(groups.rijksmuseum).toContain('rijksmuseum_rembrandt_1642')
    expect(groups.woodcuts).toContain('woodcuts_1')
  })

  it('should have 4 solid colors', () => {
    const groups = listCovers()
    expect(groups.solid_colors).toHaveLength(4)
  })

  it('should have 11 gradients', () => {
    const groups = listCovers()
    expect(groups.gradients).toHaveLength(11)
  })
})
