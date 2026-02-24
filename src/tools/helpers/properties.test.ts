import { describe, expect, it } from 'vitest'
import { convertToNotionProperties, extractPageProperties } from './properties'

const richText = (content: string) => ({
  type: 'text',
  text: { content, link: null },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: 'default'
  }
})

describe('convertToNotionProperties', () => {
  it('returns empty object for empty properties', () => {
    expect(convertToNotionProperties({})).toEqual({})
  })

  describe('null and undefined values', () => {
    it('passes null through as-is', () => {
      const result = convertToNotionProperties({ field: null })
      expect(result).toEqual({ field: null })
    })

    it('passes undefined through as-is', () => {
      const result = convertToNotionProperties({ field: undefined })
      expect(result).toEqual({ field: undefined })
    })
  })

  describe('string values with schema', () => {
    it('converts title schema type', () => {
      const result = convertToNotionProperties({ Name: 'Hello' }, { Name: 'title' })
      expect(result).toEqual({
        Name: { title: [richText('Hello')] }
      })
    })

    it('converts rich_text schema type', () => {
      const result = convertToNotionProperties({ Description: 'Some text' }, { Description: 'rich_text' })
      expect(result).toEqual({
        Description: { rich_text: [richText('Some text')] }
      })
    })

    it('converts date schema type', () => {
      const result = convertToNotionProperties({ Due: '2025-01-15' }, { Due: 'date' })
      expect(result).toEqual({
        Due: { date: { start: '2025-01-15' } }
      })
    })

    it('converts url schema type', () => {
      const result = convertToNotionProperties({ Website: 'https://example.com' }, { Website: 'url' })
      expect(result).toEqual({
        Website: { url: 'https://example.com' }
      })
    })

    it('converts email schema type', () => {
      const result = convertToNotionProperties({ Email: 'test@example.com' }, { Email: 'email' })
      expect(result).toEqual({
        Email: { email: 'test@example.com' }
      })
    })

    it('converts phone_number schema type', () => {
      const result = convertToNotionProperties({ Phone: '+1234567890' }, { Phone: 'phone_number' })
      expect(result).toEqual({
        Phone: { phone_number: '+1234567890' }
      })
    })
  })

  describe('string values without schema (auto-detect)', () => {
    it('detects "Name" key as title', () => {
      const result = convertToNotionProperties({ Name: 'My Page' })
      expect(result).toEqual({
        Name: { title: [richText('My Page')] }
      })
    })

    it('detects "Title" key as title', () => {
      const result = convertToNotionProperties({ Title: 'My Page' })
      expect(result).toEqual({
        Title: { title: [richText('My Page')] }
      })
    })

    it('detects lowercase "title" key as title', () => {
      const result = convertToNotionProperties({ title: 'My Page' })
      expect(result).toEqual({
        title: { title: [richText('My Page')] }
      })
    })

    it('falls back to select for other string keys', () => {
      const result = convertToNotionProperties({ Status: 'Active' })
      expect(result).toEqual({
        Status: { select: { name: 'Active' } }
      })
    })
  })

  describe('number values', () => {
    it('converts number to Notion number format', () => {
      const result = convertToNotionProperties({ Price: 42 })
      expect(result).toEqual({
        Price: { number: 42 }
      })
    })

    it('converts zero', () => {
      const result = convertToNotionProperties({ Count: 0 })
      expect(result).toEqual({
        Count: { number: 0 }
      })
    })

    it('converts negative numbers', () => {
      const result = convertToNotionProperties({ Balance: -100.5 })
      expect(result).toEqual({
        Balance: { number: -100.5 }
      })
    })
  })

  describe('boolean values', () => {
    it('converts true to checkbox', () => {
      const result = convertToNotionProperties({ Done: true })
      expect(result).toEqual({
        Done: { checkbox: true }
      })
    })

    it('converts false to checkbox', () => {
      const result = convertToNotionProperties({ Done: false })
      expect(result).toEqual({
        Done: { checkbox: false }
      })
    })
  })

  describe('array values', () => {
    it('converts array of strings to multi_select', () => {
      const result = convertToNotionProperties({ Tags: ['frontend', 'react', 'typescript'] })
      expect(result).toEqual({
        Tags: {
          multi_select: [{ name: 'frontend' }, { name: 'react' }, { name: 'typescript' }]
        }
      })
    })

    it('passes array of objects through as-is', () => {
      const relations = [{ id: 'abc-123' }, { id: 'def-456' }]
      const result = convertToNotionProperties({ Related: relations })
      expect(result).toEqual({
        Related: relations
      })
    })

    it('passes empty array through as-is', () => {
      const result = convertToNotionProperties({ Items: [] })
      expect(result).toEqual({
        Items: []
      })
    })
  })

  describe('object values', () => {
    it('passes objects through as-is (already in Notion format)', () => {
      const notionDate = { date: { start: '2025-01-01', end: '2025-01-31' } }
      const result = convertToNotionProperties({ Period: notionDate })
      expect(result).toEqual({
        Period: notionDate
      })
    })

    it('passes complex nested objects through as-is', () => {
      const formula = { formula: { expression: 'prop("Price") * 1.1' } }
      const result = convertToNotionProperties({ Total: formula })
      expect(result).toEqual({
        Total: formula
      })
    })
  })

  describe('mixed properties with schema', () => {
    it('converts multiple property types in a single call', () => {
      const properties = {
        Name: 'Project Alpha',
        Description: 'A cool project',
        Priority: 'High',
        Score: 95,
        Active: true,
        Tags: ['urgent', 'review'],
        Due: '2025-06-01',
        Metadata: { custom: true },
        Notes: null
      }
      const schema: Record<string, string> = {
        Name: 'title',
        Description: 'rich_text',
        Due: 'date'
      }

      const result = convertToNotionProperties(properties, schema)

      expect(result).toEqual({
        Name: { title: [richText('Project Alpha')] },
        Description: { rich_text: [richText('A cool project')] },
        Priority: { select: { name: 'High' } },
        Score: { number: 95 },
        Active: { checkbox: true },
        Tags: { multi_select: [{ name: 'urgent' }, { name: 'review' }] },
        Due: { date: { start: '2025-06-01' } },
        Metadata: { custom: true },
        Notes: null
      })
    })
  })
})

describe('extractPageProperties', () => {
  it('returns empty object for empty properties', () => {
    expect(extractPageProperties({})).toEqual({})
  })

  it('extracts title', () => {
    const props = {
      Name: { type: 'title', title: [{ plain_text: 'Hello' }, { plain_text: ' World' }] }
    }
    expect(extractPageProperties(props)).toEqual({ Name: 'Hello World' })
  })

  it('extracts rich_text', () => {
    const props = {
      Desc: { type: 'rich_text', rich_text: [{ plain_text: 'A ' }, { plain_text: 'description' }] }
    }
    expect(extractPageProperties(props)).toEqual({ Desc: 'A description' })
  })

  it('extracts select', () => {
    const props = {
      Status: { type: 'select', select: { name: 'Done' } }
    }
    expect(extractPageProperties(props)).toEqual({ Status: 'Done' })
  })

  it('extracts multi_select', () => {
    const props = {
      Tags: { type: 'multi_select', multi_select: [{ name: 'A' }, { name: 'B' }] }
    }
    expect(extractPageProperties(props)).toEqual({ Tags: ['A', 'B'] })
  })

  it('extracts number', () => {
    const props = { Count: { type: 'number', number: 42 } }
    expect(extractPageProperties(props)).toEqual({ Count: 42 })
  })

  it('extracts checkbox', () => {
    const props = { Active: { type: 'checkbox', checkbox: true } }
    expect(extractPageProperties(props)).toEqual({ Active: true })
  })

  it('extracts url', () => {
    const props = { Link: { type: 'url', url: 'https://example.com' } }
    expect(extractPageProperties(props)).toEqual({ Link: 'https://example.com' })
  })

  it('extracts email', () => {
    const props = { Mail: { type: 'email', email: 'test@example.com' } }
    expect(extractPageProperties(props)).toEqual({ Mail: 'test@example.com' })
  })

  it('extracts phone_number', () => {
    const props = { Phone: { type: 'phone_number', phone_number: '+123' } }
    expect(extractPageProperties(props)).toEqual({ Phone: '+123' })
  })

  it('extracts date with start only', () => {
    const props = { Due: { type: 'date', date: { start: '2025-01-01', end: null } } }
    expect(extractPageProperties(props)).toEqual({ Due: '2025-01-01' })
  })

  it('extracts date with start and end', () => {
    const props = { Range: { type: 'date', date: { start: '2025-01-01', end: '2025-01-05' } } }
    expect(extractPageProperties(props)).toEqual({ Range: '2025-01-01 to 2025-01-05' })
  })

  it('extracts relation', () => {
    const props = { Rel: { type: 'relation', relation: [{ id: 'r1' }, { id: 'r2' }] } }
    expect(extractPageProperties(props)).toEqual({ Rel: ['r1', 'r2'] })
  })

  it('extracts rollup', () => {
    const props = { Roll: { type: 'rollup', rollup: { type: 'number', number: 10 } } }
    expect(extractPageProperties(props)).toEqual({ Roll: { type: 'number', number: 10 } })
  })

  it('extracts people', () => {
    const props = {
      Team: { type: 'people', people: [{ name: 'Alice', id: 'u1' }, { id: 'u2' }] }
    }
    expect(extractPageProperties(props)).toEqual({ Team: ['Alice', 'u2'] })
  })

  it('extracts files', () => {
    const props = {
      Docs: {
        type: 'files',
        files: [
          { name: 'A.txt', file: { url: 'https://a.com' } },
          { name: 'B.txt', external: { url: 'https://b.com' } },
          { name: 'C.txt' }
        ]
      }
    }
    expect(extractPageProperties(props)).toEqual({ Docs: ['https://a.com', 'https://b.com', 'C.txt'] })
  })

  it('extracts formula', () => {
    const props = { Calc: { type: 'formula', formula: { type: 'number', number: 123 } } }
    expect(extractPageProperties(props)).toEqual({ Calc: 123 })
  })

  it('extracts created_time', () => {
    const props = { Created: { type: 'created_time', created_time: '2025-01-01T00:00:00Z' } }
    expect(extractPageProperties(props)).toEqual({ Created: '2025-01-01T00:00:00Z' })
  })

  it('extracts last_edited_time', () => {
    const props = { Edited: { type: 'last_edited_time', last_edited_time: '2025-01-02T00:00:00Z' } }
    expect(extractPageProperties(props)).toEqual({ Edited: '2025-01-02T00:00:00Z' })
  })

  it('extracts created_by', () => {
    const props = { Author: { type: 'created_by', created_by: { name: 'Bob', id: 'u3' } } }
    expect(extractPageProperties(props)).toEqual({ Author: 'Bob' })
  })

  it('extracts last_edited_by', () => {
    const props = { Editor: { type: 'last_edited_by', last_edited_by: { id: 'u4' } } }
    expect(extractPageProperties(props)).toEqual({ Editor: 'u4' })
  })

  it('extracts status', () => {
    const props = { State: { type: 'status', status: { name: 'In Progress' } } }
    expect(extractPageProperties(props)).toEqual({ State: 'In Progress' })
  })

  it('extracts unique_id with prefix', () => {
    const props = { ID: { type: 'unique_id', unique_id: { prefix: 'TASK', number: 101 } } }
    expect(extractPageProperties(props)).toEqual({ ID: 'TASK-101' })
  })

  it('extracts unique_id without prefix', () => {
    const props = { ID: { type: 'unique_id', unique_id: { prefix: null, number: 102 } } }
    expect(extractPageProperties(props)).toEqual({ ID: 102 })
  })
})
