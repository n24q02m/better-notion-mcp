import { describe, expect, it } from 'vitest'
import { convertToNotionProperties } from './properties.js'

describe('Properties Helper', () => {
  describe('convertToNotionProperties', () => {
    it('should convert title property', () => {
      const result = convertToNotionProperties({ Name: 'My Page' })
      expect(result.Name).toHaveProperty('title')
      expect(result.Name.title[0].text.content).toBe('My Page')
    })

    it('should convert select property by default for strings', () => {
      const result = convertToNotionProperties({ Status: 'Done' })
      expect(result.Status).toHaveProperty('select')
      expect(result.Status.select.name).toBe('Done')
    })

    it('should convert number property', () => {
      const result = convertToNotionProperties({ Count: 42 })
      expect(result.Count).toHaveProperty('number')
      expect(result.Count.number).toBe(42)
    })

    it('should convert boolean property', () => {
      const result = convertToNotionProperties({ Active: true })
      expect(result.Active).toHaveProperty('checkbox')
      expect(result.Active.checkbox).toBe(true)
    })

    it('should convert array to multi_select', () => {
      const result = convertToNotionProperties({ Tags: ['tag1', 'tag2'] })
      expect(result.Tags).toHaveProperty('multi_select')
      expect(result.Tags.multi_select).toHaveLength(2)
      expect(result.Tags.multi_select[0].name).toBe('tag1')
    })

    it('should preserve existing notion format', () => {
      const raw = {
        rich_text: [{ type: 'text', text: { content: 'Content' } }]
      }
      const result = convertToNotionProperties({ Description: raw })
      expect(result.Description).toBe(raw)
    })
  })
})
