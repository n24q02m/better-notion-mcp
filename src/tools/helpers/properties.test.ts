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
  it('extracts all property types correctly', () => {
    const input = {
      Name: { type: 'title', title: [{ plain_text: 'Hello' }, { plain_text: ' World' }] },
      Description: { type: 'rich_text', rich_text: [{ plain_text: 'A ' }, { plain_text: 'description' }] },
      Category: { type: 'select', select: { name: 'Engineering' } },
      Tags: { type: 'multi_select', multi_select: [{ name: 'urgent' }, { name: 'bug' }] },
      Count: { type: 'number', number: 42 },
      Done: { type: 'checkbox', checkbox: true },
      Website: { type: 'url', url: 'https://example.com' },
      Email: { type: 'email', email: 'test@example.com' },
      Phone: { type: 'phone_number', phone_number: '+1234567890' },
      DueDate: { type: 'date', date: { start: '2024-01-15', end: '2024-01-20' } },
      DateOnly: { type: 'date', date: { start: '2024-06-01', end: null } },
      Related: { type: 'relation', relation: [{ id: 'rel-1' }, { id: 'rel-2' }] },
      Summary: { type: 'rollup', rollup: { type: 'number', number: 100 } },
      Assignees: { type: 'people', people: [{ name: 'Alice', id: 'u-1' }, { id: 'u-2' }] },
      Attachments: {
        type: 'files',
        files: [
          { name: 'doc.pdf', file: { url: 'https://s3.example.com/doc.pdf' } },
          { name: 'link.txt', external: { url: 'https://example.com/link.txt' } },
          { name: 'bare.txt' }
        ]
      },
      Computed: { type: 'formula', formula: { type: 'string', string: 'computed-value' } },
      Created: { type: 'created_time', created_time: '2024-01-01T00:00:00.000Z' },
      Edited: { type: 'last_edited_time', last_edited_time: '2024-01-02T00:00:00.000Z' },
      CreatedBy: { type: 'created_by', created_by: { name: 'Bob', id: 'u-3' } },
      EditedBy: { type: 'last_edited_by', last_edited_by: { id: 'u-4' } },
      Status: { type: 'status', status: { name: 'In Progress' } },
      TaskID: { type: 'unique_id', unique_id: { prefix: 'TASK', number: 42 } },
      PlainID: { type: 'unique_id', unique_id: { prefix: null, number: 7 } },
      // Unknown type
      Unknown: { type: 'something_else', something_else: 'value' }
    }

    const result = extractPageProperties(input)

    expect(result.Name).toBe('Hello World')
    expect(result.Description).toBe('A description')
    expect(result.Category).toBe('Engineering')
    expect(result.Tags).toEqual(['urgent', 'bug'])
    expect(result.Count).toBe(42)
    expect(result.Done).toBe(true)
    expect(result.Website).toBe('https://example.com')
    expect(result.Email).toBe('test@example.com')
    expect(result.Phone).toBe('+1234567890')
    expect(result.DueDate).toBe('2024-01-15 to 2024-01-20')
    expect(result.DateOnly).toBe('2024-06-01')
    expect(result.Related).toEqual(['rel-1', 'rel-2'])
    expect(result.Summary).toEqual({ type: 'number', number: 100 })
    expect(result.Assignees).toEqual(['Alice', 'u-2'])
    expect(result.Attachments).toEqual(['https://s3.example.com/doc.pdf', 'https://example.com/link.txt', 'bare.txt'])
    expect(result.Computed).toBe('computed-value')
    expect(result.Created).toBe('2024-01-01T00:00:00.000Z')
    expect(result.Edited).toBe('2024-01-02T00:00:00.000Z')
    expect(result.CreatedBy).toBe('Bob')
    expect(result.EditedBy).toBe('u-4')
    expect(result.Status).toBe('In Progress')
    expect(result.TaskID).toBe('TASK-42')
    expect(result.PlainID).toBe(7)
    expect(result.Unknown).toBeUndefined()
  })

  it('handles empty properties', () => {
    expect(extractPageProperties({})).toEqual({})
  })

  it('handles properties with missing optional fields', () => {
    const input = {
      EmptyRichText: { type: 'rich_text', rich_text: [] },
      EmptyRelation: { type: 'relation', relation: [] }
    }
    const result = extractPageProperties(input)
    expect(result.EmptyRichText).toBe('')
    expect(result.EmptyRelation).toEqual([])
  })
})
