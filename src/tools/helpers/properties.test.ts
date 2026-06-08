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
    const types = [
      ['title', 'Hello', { title: [richText('Hello')] }],
      ['rich_text', 'Some text', { rich_text: [richText('Some text')] }],
      ['date', '2025-01-15', { date: { start: '2025-01-15' } }],
      ['url', 'https://example.com', { url: 'https://example.com' }],
      ['email', 'test@example.com', { email: 'test@example.com' }],
      ['phone_number', '+1234567890', { phone_number: '+1234567890' }],
      ['status', 'Done', { status: { name: 'Done' } }]
    ]

    for (const [type, value, expected] of types) {
      it(`converts ${type} schema type`, () => {
        const result = convertToNotionProperties({ field: value }, { field: type as string })
        expect(result).toEqual({ field: expected })
      })
    }

    it('does not fall back to select when schema type is status', () => {
      const result = convertToNotionProperties({ State: 'In progress' }, { State: 'status' })
      expect(result).toEqual({ State: { status: { name: 'In progress' } } })
    })
  })

  describe('string values without schema (auto-detect)', () => {
    it('detects "Name" key as title', () => {
      expect(convertToNotionProperties({ Name: 'X' })).toEqual({ Name: { title: [richText('X')] } })
    })
    it('detects "Title" key as title', () => {
      expect(convertToNotionProperties({ Title: 'X' })).toEqual({ Title: { title: [richText('X')] } })
    })
    it('detects "title" key as title', () => {
      expect(convertToNotionProperties({ title: 'X' })).toEqual({ title: { title: [richText('X')] } })
    })
    it('detects "TITLE" key as title', () => {
      expect(convertToNotionProperties({ TITLE: 'X' })).toEqual({ TITLE: { title: [richText('X')] } })
    })
    it('falls back to select for other string keys', () => {
      expect(convertToNotionProperties({ Status: 'Active' })).toEqual({ Status: { select: { name: 'Active' } } })
    })
    it('falls back to select for unknown schema type', () => {
      expect(convertToNotionProperties({ F: 'V' }, { F: 'unknown' })).toEqual({ F: { select: { name: 'V' } } })
    })
  })

  describe('number and boolean values', () => {
    it('converts number', () => {
      expect(convertToNotionProperties({ n: 42 })).toEqual({ n: { number: 42 } })
      expect(convertToNotionProperties({ n: 0 })).toEqual({ n: { number: 0 } })
    })
    it('converts boolean', () => {
      expect(convertToNotionProperties({ b: true })).toEqual({ b: { checkbox: true } })
      expect(convertToNotionProperties({ b: false })).toEqual({ b: { checkbox: false } })
    })
  })

  describe('array values', () => {
    it('converts array of strings to multi_select', () => {
      expect(convertToNotionProperties({ t: ['a', 'b'] })).toEqual({
        t: { multi_select: [{ name: 'a' }, { name: 'b' }] }
      })
    })
    it('passes array of non-strings through as-is', () => {
      const arr = [1, 2]
      expect(convertToNotionProperties({ a: arr })).toEqual({ a: arr })
    })
    it('passes empty array through as-is', () => {
      expect(convertToNotionProperties({ a: [] })).toEqual({ a: [] })
    })
    it('converts array to relation if schema matches', () => {
      expect(convertToNotionProperties({ r: ['id1'] }, { r: 'relation' })).toEqual({
        r: { relation: [{ id: 'id1' }] }
      })
    })
  })

  describe('relation values (toRelation helper)', () => {
    it('handles single string', () => {
      expect(convertToNotionProperties({ r: 'abc123def456' }, { r: 'relation' })).toEqual({
        r: { relation: [{ id: 'abc123def456' }] }
      })
    })
    it('extracts ID from Notion URL', () => {
      const url = 'https://www.notion.so/Page-abc123def4567890abc123def4567890'
      expect(convertToNotionProperties({ r: url }, { r: 'relation' })).toEqual({
        r: { relation: [{ id: 'abc123def4567890abc123def4567890' }] }
      })
    })
    it('handles empty string', () => {
      expect(convertToNotionProperties({ r: '' }, { r: 'relation' })).toEqual({
        r: { relation: [] }
      })
    })
    it('handles JSON array string', () => {
      expect(convertToNotionProperties({ r: '["id1", "id2"]' }, { r: 'relation' })).toEqual({
        r: { relation: [{ id: 'id1' }, { id: 'id2' }] }
      })
    })
    it('handles malformed JSON starting with [', () => {
      expect(convertToNotionProperties({ r: '[invalid' }, { r: 'relation' })).toEqual({
        r: { relation: [{ id: '[invalid' }] }
      })
    })
    it('handles JSON array with non-strings', () => {
      expect(convertToNotionProperties({ r: '["id1", 2]' }, { r: 'relation' })).toEqual({
        r: { relation: [{ id: '["id1", 2]' }] }
      })
    })
    it('handles non-string non-array values', () => {
      const sym = Symbol('test')
      expect(convertToNotionProperties({ r: sym }, { r: 'relation' })).toEqual({ r: sym })
    })
  })

  it('passes through unsupported types as-is', () => {
    const bigIntValue = BigInt(123)
    expect(convertToNotionProperties({ b: bigIntValue })).toEqual({ b: bigIntValue })
  })

  it('handles objects as-is', () => {
    const obj = { custom: true }
    expect(convertToNotionProperties({ o: obj })).toEqual({ o: obj })
  })
})

describe('extractPageProperties', () => {
  it('extracts title and rich_text with multiple segments', () => {
    const props = {
      t: { type: 'title', title: [{ plain_text: 'Hello ' }, { plain_text: 'World' }] },
      rt: { type: 'rich_text', rich_text: [{ plain_text: 'Some ' }, { plain_text: 'text' }] }
    }
    expect(extractPageProperties(props)).toEqual({ t: 'Hello World', rt: 'Some text' })
  })

  it('handles title and rich_text segments with missing plain_text', () => {
    const props = {
      t: { type: 'title', title: [{ plain_text: 'Hello' }, {}] }
    }
    expect(extractPageProperties(props)).toEqual({ t: 'Hello' })
  })

  it('extracts simple types', () => {
    const props = {
      s: { type: 'select', select: { name: 'A' } },
      ms: { type: 'multi_select', multi_select: [{ name: 'A' }, { name: 'B' }] },
      n: { type: 'number', number: 42 },
      c: { type: 'checkbox', checkbox: true },
      u: { type: 'url', url: 'http://x.com' },
      e: { type: 'email', email: 'a@b.com' },
      p: { type: 'phone_number', phone_number: '123' },
      st: { type: 'status', status: { name: 'Done' } }
    }
    expect(extractPageProperties(props)).toEqual({
      s: 'A',
      ms: ['A', 'B'],
      n: 42,
      c: true,
      u: 'http://x.com',
      e: 'a@b.com',
      p: '123',
      st: 'Done'
    })
  })

  it('extracts complex types', () => {
    const props = {
      d: { type: 'date', date: { start: '2023-01-01', end: '2023-01-02' } },
      d2: { type: 'date', date: { start: '2023-01-01' } },
      r: { type: 'relation', relation: [{ id: 'id1' }, { id: 'id2' }] },
      ru: { type: 'rollup', rollup: { type: 'number', number: 10 } },
      ppl: { type: 'people', people: [{ name: 'Alice' }, { id: 'u1' }] },
      f: { type: 'files', files: [{ file: { url: 'i.png' } }, { external: { url: 'e.png' } }, { name: 'n.txt' }] },
      uid: { type: 'unique_id', unique_id: { prefix: 'T', number: 1 } },
      uid2: { type: 'unique_id', unique_id: { number: 2 } }
    }
    expect(extractPageProperties(props)).toEqual({
      d: '2023-01-01 to 2023-01-02',
      d2: '2023-01-01',
      r: ['id1', 'id2'],
      ru: { type: 'number', number: 10 },
      ppl: ['Alice', 'u1'],
      f: ['i.png', 'e.png', 'n.txt'],
      uid: 'T-1',
      uid2: 2
    })
  })

  it('extracts metadata times and people', () => {
    const props = {
      ct: { type: 'created_time', created_time: '2023-01-01' },
      et: { type: 'last_edited_time', last_edited_time: '2023-01-02' },
      cb: { type: 'created_by', created_by: { name: 'Alice', id: 'u1' } },
      eb: { type: 'last_edited_by', last_edited_by: { id: 'u2' } }
    }
    expect(extractPageProperties(props)).toEqual({
      ct: '2023-01-01',
      et: '2023-01-02',
      cb: 'Alice',
      eb: 'u2'
    })
  })

  it('extracts formula values including boolean and date', () => {
    expect(extractPageProperties({ f: { type: 'formula', formula: { type: 'string', string: 's' } } })).toEqual({ f: 's' })
    expect(extractPageProperties({ f: { type: 'formula', formula: { type: 'number', number: 1 } } })).toEqual({ f: 1 })
    expect(extractPageProperties({ f: { type: 'formula', formula: { type: 'boolean', boolean: true } } })).toEqual({ f: true })
    expect(extractPageProperties({ f: { type: 'formula', formula: { type: 'date', date: { start: '2023' } } } })).toEqual({ f: { start: '2023' } })
    expect(extractPageProperties({ f: { type: 'formula', formula: { type: 'unknown' } } })).toEqual({ f: null })
    expect(extractPageProperties({ f: { type: 'formula', formula: {} } })).toEqual({ f: null })
  })

  it('handles edge cases', () => {
    expect(extractPageProperties(null)).toEqual({})
    expect(extractPageProperties(undefined)).toEqual({})
    expect(extractPageProperties({})).toEqual({})
    expect(extractPageProperties({ bad: { type: 'title' } })).toEqual({})
    expect(extractPageProperties({ unknown: { type: 'magic' } })).toEqual({})
  })

  it('optimizes type reading', () => {
    let reads = 0
    const props = {
      p: new Proxy({ type: 'number', number: 1 }, {
        get(t, p) {
          if (p === 'type') reads++
          return (t as any)[p]
        }
      })
    }
    extractPageProperties(props)
    expect(reads).toBe(1)
  })
})
