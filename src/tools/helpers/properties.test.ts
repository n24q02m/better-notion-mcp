import { describe, expect, it } from 'vitest'
import { convertToNotionProperties } from './properties.js'
import * as RichText from './richtext.js'

describe('convertToNotionProperties', () => {
  it('converts title property correctly (auto-detect)', () => {
    const input = { Name: 'My Page' }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Name: {
        title: [RichText.text('My Page')]
      }
    })
  })

  it('converts title property correctly (schema)', () => {
    const input = { 'Custom Title': 'My Custom Page' }
    const schema = { 'Custom Title': 'title' }
    const result = convertToNotionProperties(input, schema)
    expect(result).toEqual({
      'Custom Title': {
        title: [RichText.text('My Custom Page')]
      }
    })
  })

  it('converts rich_text property correctly (schema)', () => {
    const input = { Description: 'A description' }
    const schema = { Description: 'rich_text' }
    const result = convertToNotionProperties(input, schema)
    expect(result).toEqual({
      Description: {
        rich_text: [RichText.text('A description')]
      }
    })
  })

  it('converts date property correctly (schema)', () => {
    const input = { 'Due Date': '2023-10-27' }
    const schema = { 'Due Date': 'date' }
    const result = convertToNotionProperties(input, schema)
    expect(result).toEqual({
      'Due Date': {
        date: { start: '2023-10-27' }
      }
    })
  })

  it('converts url property correctly (schema)', () => {
    const input = { Website: 'https://example.com' }
    const schema = { Website: 'url' }
    const result = convertToNotionProperties(input, schema)
    expect(result).toEqual({
      Website: {
        url: 'https://example.com'
      }
    })
  })

  it('converts email property correctly (schema)', () => {
    const input = { Contact: 'test@example.com' }
    const schema = { Contact: 'email' }
    const result = convertToNotionProperties(input, schema)
    expect(result).toEqual({
      Contact: {
        email: 'test@example.com'
      }
    })
  })

  it('converts phone_number property correctly (schema)', () => {
    const input = { Phone: '123-456-7890' }
    const schema = { Phone: 'phone_number' }
    const result = convertToNotionProperties(input, schema)
    expect(result).toEqual({
      Phone: {
        phone_number: '123-456-7890'
      }
    })
  })

  it('defaults to select for unknown string properties', () => {
    const input = { Status: 'In Progress' }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Status: {
        select: { name: 'In Progress' }
      }
    })
  })

  it('converts number property correctly', () => {
    const input = { Count: 42 }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Count: {
        number: 42
      }
    })
  })

  it('converts boolean property correctly', () => {
    const input = { Active: true }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Active: {
        checkbox: true
      }
    })
  })

  it('converts string array to multi_select', () => {
    const input = { Tags: ['tag1', 'tag2'] }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Tags: {
        multi_select: [{ name: 'tag1' }, { name: 'tag2' }]
      }
    })
  })

  it('passes through non-string arrays', () => {
    const input = { Data: [1, 2, 3] }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Data: [1, 2, 3]
    })
  })

  it('passes through empty arrays', () => {
    const input = { Data: [] }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Data: []
    })
  })

  it('passes through object properties', () => {
    const input = {
      Metadata: {
        date: { start: '2023-01-01', end: '2023-01-02' }
      }
    }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Metadata: {
        date: { start: '2023-01-01', end: '2023-01-02' }
      }
    })
  })

  it('handles null and undefined values', () => {
    const input = {
      Nullable: null,
      Undef: undefined
    }
    const result = convertToNotionProperties(input)
    expect(result).toEqual({
      Nullable: null,
      Undef: undefined
    })
  })

  it('handles empty input object', () => {
    const input = {}
    const result = convertToNotionProperties(input)
    expect(result).toEqual({})
  })
})
