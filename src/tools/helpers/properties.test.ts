import { describe, it, expect } from 'vitest'
import { convertToNotionProperties } from './properties.js'
import { text } from './richtext.js'

describe('convertToNotionProperties', () => {
  it('test_convertToNotionProperties_string_auto_title', () => {
    const input = {
      Name: 'My Page',
      Title: 'Another Title',
      title: 'lowercase title'
    }

    const expected = {
      Name: { title: [text('My Page')] },
      Title: { title: [text('Another Title')] },
      title: { title: [text('lowercase title')] }
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_string_schema_types', () => {
    const input = {
      myTitle: 'A Title',
      description: 'Some text',
      dueDate: '2023-01-01',
      website: 'https://example.com',
      contact: 'test@example.com',
      phone: '123-456-7890'
    }

    const schema = {
      myTitle: 'title',
      description: 'rich_text',
      dueDate: 'date',
      website: 'url',
      contact: 'email',
      phone: 'phone_number'
    }

    const expected = {
      myTitle: { title: [text('A Title')] },
      description: { rich_text: [text('Some text')] },
      dueDate: { date: { start: '2023-01-01' } },
      website: { url: 'https://example.com' },
      contact: { email: 'test@example.com' },
      phone: { phone_number: '123-456-7890' }
    }

    expect(convertToNotionProperties(input, schema)).toEqual(expected)
  })

  it('test_convertToNotionProperties_string_default_select', () => {
    const input = {
      status: 'Done',
      priority: 'High'
    }

    const expected = {
      status: { select: { name: 'Done' } },
      priority: { select: { name: 'High' } }
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_number', () => {
    const input = {
      count: 42,
      price: 99.99
    }

    const expected = {
      count: { number: 42 },
      price: { number: 99.99 }
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_boolean', () => {
    const input = {
      isActive: true,
      isDeleted: false
    }

    const expected = {
      isActive: { checkbox: true },
      isDeleted: { checkbox: false }
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_array_multi_select', () => {
    const input = {
      tags: ['tag1', 'tag2'],
      categories: ['work']
    }

    const expected = {
      tags: { multi_select: [{ name: 'tag1' }, { name: 'tag2' }] },
      categories: { multi_select: [{ name: 'work' }] }
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_array_mixed_pass_through', () => {
    const input = {
      mixed: [1, 2, 3], // Should pass through as is, code checks only typeof value[0] === 'string'
      objects: [{ id: 1 }]
    }

    // According to code:
    // if (value.length > 0 && typeof value[0] === 'string') -> multi_select
    // else -> value

    const expected = {
      mixed: [1, 2, 3],
      objects: [{ id: 1 }]
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_object_pass_through', () => {
    const input = {
      customDate: { date: { start: '2023-01-01', end: '2023-01-02' } },
      relation: { relation: [{ id: 'page-id' }] }
    }

    const expected = {
      customDate: { date: { start: '2023-01-01', end: '2023-01-02' } },
      relation: { relation: [{ id: 'page-id' }] }
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_null_undefined', () => {
    const input = {
      empty: null,
      missing: undefined
    }

    const expected = {
      empty: null,
      missing: undefined
    }

    expect(convertToNotionProperties(input)).toEqual(expected)
  })

  it('test_convertToNotionProperties_empty_input', () => {
    const input = {}
    const expected = {}
    expect(convertToNotionProperties(input)).toEqual(expected)
  })
})
