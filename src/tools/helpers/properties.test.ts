import { describe, expect, it } from 'vitest'
import { extractProperties } from './properties.js'

describe('extractProperties', () => {
  it('should extract title property', () => {
    const input = {
      Name: {
        type: 'title',
        title: [
          { type: 'text', plain_text: 'Hello' },
          { type: 'text', plain_text: ' World' }
        ]
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Name: 'Hello World' })
  })

  it('should extract rich_text property', () => {
    const input = {
      Description: {
        type: 'rich_text',
        rich_text: [{ type: 'text', plain_text: 'A description' }]
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Description: 'A description' })
  })

  it('should extract select property', () => {
    const input = {
      Status: {
        type: 'select',
        select: { name: 'In Progress' }
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Status: 'In Progress' })
  })

  it('should extract multi_select property', () => {
    const input = {
      Tags: {
        type: 'multi_select',
        multi_select: [{ name: 'Tag1' }, { name: 'Tag2' }]
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Tags: ['Tag1', 'Tag2'] })
  })

  it('should extract number property', () => {
    const input = {
      Count: {
        type: 'number',
        number: 42
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Count: 42 })
  })

  it('should extract checkbox property', () => {
    const input = {
      Done: {
        type: 'checkbox',
        checkbox: true
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Done: true })
  })

  it('should extract url property', () => {
    const input = {
      Link: {
        type: 'url',
        url: 'https://example.com'
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Link: 'https://example.com' })
  })

  it('should extract email property', () => {
    const input = {
      Email: {
        type: 'email',
        email: 'test@example.com'
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Email: 'test@example.com' })
  })

  it('should extract phone_number property', () => {
    const input = {
      Phone: {
        type: 'phone_number',
        phone_number: '123-456-7890'
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Phone: '123-456-7890' })
  })

  it('should extract date property with start only', () => {
    const input = {
      Date: {
        type: 'date',
        date: { start: '2023-01-01' }
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Date: '2023-01-01' })
  })

  it('should extract date property with start and end', () => {
    const input = {
      DateRange: {
        type: 'date',
        date: { start: '2023-01-01', end: '2023-01-05' }
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ DateRange: '2023-01-01 to 2023-01-05' })
  })

  it('should fallback to direct property access for unsupported types', () => {
    const input = {
      Unknown: {
        type: 'custom_type',
        custom_type: 'custom_value'
      }
    }
    const result = extractProperties(input)
    expect(result).toEqual({ Unknown: 'custom_value' })
  })

  it('should handle mixed property types', () => {
    const input = {
      Name: { type: 'title', title: [{ plain_text: 'Test Page' }] },
      Status: { type: 'select', select: { name: 'Done' } },
      Count: { type: 'number', number: 10 }
    }
    const result = extractProperties(input)
    expect(result).toEqual({
      Name: 'Test Page',
      Status: 'Done',
      Count: 10
    })
  })
})
