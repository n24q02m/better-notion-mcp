import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databases } from './databases'

const mockNotion = {
  databases: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn()
  },
  pages: {
    create: vi.fn(),
    update: vi.fn()
  },
  dataSources: {
    retrieve: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
    listTemplates: vi.fn()
  },
  request: vi.fn()
}

const notion = mockNotion as any

function makeDbRetrieveResponse(overrides: Record<string, any> = {}) {
  return {
    id: 'db-1',
    title: [{ plain_text: 'Test DB' }],
    description: [{ plain_text: 'A test database' }],
    url: 'https://notion.so/db-1',
    is_inline: false,
    created_time: '2025-01-01T00:00:00.000Z',
    last_edited_time: '2025-01-02T00:00:00.000Z',
    data_sources: [{ id: 'ds-1', name: 'Source 1' }],
    ...overrides
  }
}

function makeDataSourceResponse(overrides: Record<string, any> = {}) {
  return {
    id: 'ds-1',
    title: [{ plain_text: 'Source 1' }],
    properties: {
      Name: { type: 'title', id: 'prop-1' },
      Status: {
        type: 'select',
        id: 'prop-2',
        select: { options: [{ name: 'Active' }, { name: 'Done' }] }
      }
    },
    ...overrides
  }
}

describe('databases', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('create', () => {
    it('should create a database with initial_data_source', async () => {
      mockNotion.databases.create.mockResolvedValueOnce({
        id: 'db-new',
        url: 'https://notion.so/db-new',
        data_sources: [{ id: 'ds-new' }]
      })

      const result = await databases(notion, {
        action: 'create',
        parent_id: 'page-1',
        title: 'My DB',
        properties: { Name: { title: {} } }
      })

      expect(result).toEqual({
        action: 'create',
        database_id: 'db-new',
        data_source_id: 'ds-new',
        url: 'https://notion.so/db-new',
        created: true
      })

      expect(mockNotion.databases.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { type: 'page_id', page_id: 'page-1' },
          initial_data_source: { properties: { Name: { title: {} } } }
        })
      )
    })

    it('should include description and is_inline when provided', async () => {
      mockNotion.databases.create.mockResolvedValueOnce({
        id: 'db-2',
        url: 'https://notion.so/db-2',
        data_sources: [{ id: 'ds-2' }]
      })

      await databases(notion, {
        action: 'create',
        parent_id: 'page-1',
        title: 'Inline DB',
        description: 'Some description',
        is_inline: true,
        properties: { Name: { title: {} } }
      })

      const call = mockNotion.databases.create.mock.calls[0][0]
      expect(call.description).toBeDefined()
      expect(call.description[0].text.content).toBe('Some description')
      expect(call.is_inline).toBe(true)
    })

    it('should throw when required params are missing', async () => {
      await expect(databases(notion, { action: 'create', parent_id: 'page-1', title: 'No Props' })).rejects.toThrow(
        'parent_id, title, and properties required'
      )

      await expect(databases(notion, { action: 'create' })).rejects.toThrow('parent_id, title, and properties required')
    })
  })

  describe('get', () => {
    it('should return schema with data source info', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.retrieve.mockResolvedValueOnce(makeDataSourceResponse())

      const result = await databases(notion, { action: 'get', database_id: 'db-1' })

      expect(result).toEqual({
        action: 'get',
        database_id: 'db-1',
        title: 'Test DB',
        description: 'A test database',
        url: 'https://notion.so/db-1',
        is_inline: false,
        created_time: '2025-01-01T00:00:00.000Z',
        last_edited_time: '2025-01-02T00:00:00.000Z',
        data_source: { id: 'ds-1', name: 'Source 1' },
        schema: {
          Name: { type: 'title', id: 'prop-1' },
          Status: { type: 'select', id: 'prop-2', options: ['Active', 'Done'] }
        }
      })
    })

    it('should format multi_select options and formula expressions', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.retrieve.mockResolvedValueOnce(
        makeDataSourceResponse({
          properties: {
            Tags: {
              type: 'multi_select',
              id: 'prop-3',
              multi_select: { options: [{ name: 'A' }, { name: 'B' }] }
            },
            Total: {
              type: 'formula',
              id: 'prop-4',
              formula: { expression: 'prop("Price") * prop("Qty")' }
            }
          }
        })
      )

      const result = await databases(notion, { action: 'get', database_id: 'db-1' })

      expect(result.schema.Tags.options).toEqual(['A', 'B'])
      expect(result.schema.Total.expression).toBe('prop("Price") * prop("Qty")')
    })

    it('should handle empty data_sources array', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse({ data_sources: [] }))

      const result = await databases(notion, { action: 'get', database_id: 'db-1' })

      expect(result.data_source).toBeNull()
      expect(result.schema).toEqual({})
      expect(mockNotion.dataSources.retrieve).not.toHaveBeenCalled()
    })

    it('should throw when database_id is missing', async () => {
      await expect(databases(notion, { action: 'get' })).rejects.toThrow('database_id required')
    })
  })

  describe('query', () => {
    it('should query via data source and format results', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.query.mockResolvedValueOnce({
        results: [
          {
            id: 'page-1',
            url: 'https://notion.so/page-1',
            properties: {
              Name: { type: 'title', title: [{ plain_text: 'Item 1' }] },
              Status: { type: 'select', select: { name: 'Active' } }
            }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await databases(notion, { action: 'query', database_id: 'db-1' })

      expect(result.action).toBe('query')
      expect(result.database_id).toBe('db-1')
      expect(result.data_source_id).toBe('ds-1')
      expect(result.total).toBe(1)
      expect(result.results[0]).toEqual({
        page_id: 'page-1',
        url: 'https://notion.so/page-1',
        Name: 'Item 1',
        Status: 'Active'
      })
    })

    it('should pass filters and sorts to query', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.query.mockResolvedValueOnce({
        results: [],
        next_cursor: null,
        has_more: false
      })

      const filter = { property: 'Status', select: { equals: 'Active' } }
      const sorts = [{ property: 'Name', direction: 'ascending' }]

      await databases(notion, {
        action: 'query',
        database_id: 'db-1',
        filters: filter,
        sorts
      })

      expect(mockNotion.dataSources.query).toHaveBeenCalledWith(
        expect.objectContaining({
          data_source_id: 'ds-1',
          filter,
          sorts,
          page_size: 100
        })
      )
    })

    it('should build OR filter for smart search on text properties', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.retrieve.mockResolvedValueOnce(
        makeDataSourceResponse({
          properties: {
            Name: { type: 'title', id: 'prop-1' },
            Notes: { type: 'rich_text', id: 'prop-5' },
            Count: { type: 'number', id: 'prop-6' }
          }
        })
      )
      mockNotion.dataSources.query.mockResolvedValueOnce({
        results: [],
        next_cursor: null,
        has_more: false
      })

      await databases(notion, {
        action: 'query',
        database_id: 'db-1',
        search: 'hello'
      })

      expect(mockNotion.dataSources.query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            or: [
              { property: 'Name', rich_text: { contains: 'hello' } },
              { property: 'Notes', rich_text: { contains: 'hello' } }
            ]
          }
        })
      )
    })

    it('should limit results when limit is specified', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.query.mockResolvedValueOnce({
        results: [
          { id: 'p1', url: 'u1', properties: {} },
          { id: 'p2', url: 'u2', properties: {} },
          { id: 'p3', url: 'u3', properties: {} }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await databases(notion, {
        action: 'query',
        database_id: 'db-1',
        limit: 2
      })

      expect(result.total).toBe(2)
      expect(result.results).toHaveLength(2)
    })

    it('should format various property types in results', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.query.mockResolvedValueOnce({
        results: [
          {
            id: 'page-2',
            url: 'https://notion.so/page-2',
            properties: {
              Name: { type: 'title', title: [{ plain_text: 'Test' }] },
              Desc: { type: 'rich_text', rich_text: [{ plain_text: 'A desc' }] },
              Tags: { type: 'multi_select', multi_select: [{ name: 'X' }, { name: 'Y' }] },
              Count: { type: 'number', number: 42 },
              Done: { type: 'checkbox', checkbox: true },
              Link: { type: 'url', url: 'https://example.com' },
              Email: { type: 'email', email: 'a@b.com' },
              Phone: { type: 'phone_number', phone_number: '123' },
              Due: { type: 'date', date: { start: '2025-01-01', end: '2025-01-31' } }
            }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await databases(notion, { action: 'query', database_id: 'db-1' })
      const page = result.results[0]

      expect(page.Name).toBe('Test')
      expect(page.Desc).toBe('A desc')
      expect(page.Tags).toEqual(['X', 'Y'])
      expect(page.Count).toBe(42)
      expect(page.Done).toBe(true)
      expect(page.Link).toBe('https://example.com')
      expect(page.Email).toBe('a@b.com')
      expect(page.Phone).toBe('123')
      expect(page.Due).toBe('2025-01-01 to 2025-01-31')
    })

    it('should throw when no data sources exist', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse({ data_sources: [] }))

      await expect(databases(notion, { action: 'query', database_id: 'db-1' })).rejects.toThrow('No data sources found')
    })

    it('should throw when database_id is missing', async () => {
      await expect(databases(notion, { action: 'query' })).rejects.toThrow('database_id required')
    })
  })

  describe('create_page', () => {
    beforeEach(() => {
      mockNotion.databases.retrieve.mockResolvedValue(makeDbRetrieveResponse())
      mockNotion.dataSources.retrieve.mockResolvedValue(makeDataSourceResponse())
    })

    it('should create a page with page_properties', async () => {
      mockNotion.pages.create.mockResolvedValueOnce({
        id: 'new-page-1',
        url: 'https://notion.so/new-page-1'
      })

      const result = await databases(notion, {
        action: 'create_page',
        database_id: 'db-1',
        page_properties: { Name: 'New Item', Status: 'Active' }
      })

      expect(result.action).toBe('create_page')
      expect(result.database_id).toBe('db-1')
      expect(result.data_source_id).toBe('ds-1')
      expect(result.processed).toBe(1)
      expect(result.results[0]).toEqual({
        page_id: 'new-page-1',
        url: 'https://notion.so/new-page-1',
        created: true
      })

      expect(mockNotion.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { type: 'data_source_id', data_source_id: 'ds-1' }
        })
      )
    })

    it('should create multiple pages with pages array', async () => {
      mockNotion.pages.create
        .mockResolvedValueOnce({ id: 'p-1', url: 'https://notion.so/p-1' })
        .mockResolvedValueOnce({ id: 'p-2', url: 'https://notion.so/p-2' })

      const result = await databases(notion, {
        action: 'create_page',
        database_id: 'db-1',
        pages: [{ properties: { Name: 'Item 1' } }, { properties: { Name: 'Item 2' } }]
      })

      expect(result.processed).toBe(2)
      expect(result.results).toHaveLength(2)
      expect(mockNotion.pages.create).toHaveBeenCalledTimes(2)
    })

    it('should throw when database_id is missing', async () => {
      await expect(databases(notion, { action: 'create_page', page_properties: { Name: 'X' } })).rejects.toThrow(
        'database_id required'
      )
    })

    it('should throw when neither pages nor page_properties provided', async () => {
      await expect(databases(notion, { action: 'create_page', database_id: 'db-1' })).rejects.toThrow(
        'pages or page_properties required'
      )
    })
  })

  describe('update_page', () => {
    it('should update a single page with page_id and page_properties', async () => {
      mockNotion.pages.update.mockResolvedValueOnce({ id: 'page-1' })

      const result = await databases(notion, {
        action: 'update_page',
        page_id: 'page-1',
        page_properties: { Status: 'Done' }
      })

      expect(result.action).toBe('update_page')
      expect(result.processed).toBe(1)
      expect(result.results[0]).toEqual({ page_id: 'page-1', updated: true })
      expect(mockNotion.pages.update).toHaveBeenCalledWith(expect.objectContaining({ page_id: 'page-1' }))
    })

    it('should update multiple pages with pages array', async () => {
      mockNotion.pages.update.mockResolvedValueOnce({ id: 'page-1' }).mockResolvedValueOnce({ id: 'page-2' })

      const result = await databases(notion, {
        action: 'update_page',
        pages: [
          { page_id: 'page-1', properties: { Status: 'Done' } },
          { page_id: 'page-2', properties: { Status: 'Active' } }
        ]
      })

      expect(result.processed).toBe(2)
      expect(result.results).toEqual([
        { page_id: 'page-1', updated: true },
        { page_id: 'page-2', updated: true }
      ])
    })

    it('should throw when neither pages nor page_id+page_properties provided', async () => {
      await expect(databases(notion, { action: 'update_page' })).rejects.toThrow(
        'pages or page_id+page_properties required'
      )
    })
  })

  describe('delete_page', () => {
    it('should delete pages by page_ids', async () => {
      mockNotion.pages.update.mockResolvedValueOnce({}).mockResolvedValueOnce({})

      const result = await databases(notion, {
        action: 'delete_page',
        page_ids: ['page-1', 'page-2']
      })

      expect(result.action).toBe('delete_page')
      expect(result.processed).toBe(2)
      expect(result.results).toEqual([
        { page_id: 'page-1', deleted: true },
        { page_id: 'page-2', deleted: true }
      ])

      for (const call of mockNotion.pages.update.mock.calls) {
        expect(call[0].archived).toBe(true)
      }
    })

    it('should delete a single page by page_id', async () => {
      mockNotion.pages.update.mockResolvedValueOnce({})

      const result = await databases(notion, {
        action: 'delete_page',
        page_id: 'page-solo'
      })

      expect(result.processed).toBe(1)
      expect(result.results[0]).toEqual({ page_id: 'page-solo', deleted: true })
      expect(mockNotion.pages.update).toHaveBeenCalledWith({
        page_id: 'page-solo',
        archived: true
      })
    })

    it('should throw when no page ids provided', async () => {
      await expect(databases(notion, { action: 'delete_page' })).rejects.toThrow('page_id or page_ids required')
    })
  })

  describe('create_data_source', () => {
    it('should create a data source with required params', async () => {
      mockNotion.dataSources.create.mockResolvedValueOnce({ id: 'ds-new' })

      const result = await databases(notion, {
        action: 'create_data_source',
        database_id: 'db-1',
        title: 'New Source',
        properties: { Name: { title: {} } }
      })

      expect(result).toEqual({
        action: 'create_data_source',
        data_source_id: 'ds-new',
        database_id: 'db-1',
        created: true
      })

      expect(mockNotion.dataSources.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { type: 'database_id', database_id: 'db-1' },
          properties: { Name: { title: {} } }
        })
      )
    })

    it('should include description when provided', async () => {
      mockNotion.dataSources.create.mockResolvedValueOnce({ id: 'ds-2' })

      await databases(notion, {
        action: 'create_data_source',
        database_id: 'db-1',
        title: 'With Desc',
        description: 'My description',
        properties: { Name: { title: {} } }
      })

      const call = mockNotion.dataSources.create.mock.calls[0][0]
      expect(call.description).toBeDefined()
      expect(call.description[0].text.content).toBe('My description')
    })

    it('should throw when required params are missing', async () => {
      await expect(databases(notion, { action: 'create_data_source', database_id: 'db-1' })).rejects.toThrow(
        'database_id, title, and properties required'
      )

      await expect(databases(notion, { action: 'create_data_source', title: 'X', properties: {} })).rejects.toThrow(
        'database_id, title, and properties required'
      )
    })
  })

  describe('update_data_source', () => {
    it('should update data source title', async () => {
      mockNotion.dataSources.update.mockResolvedValueOnce({})

      const result = await databases(notion, {
        action: 'update_data_source',
        data_source_id: 'ds-1',
        title: 'Renamed'
      })

      expect(result).toEqual({
        action: 'update_data_source',
        data_source_id: 'ds-1',
        updated: true
      })

      const call = mockNotion.dataSources.update.mock.calls[0][0]
      expect(call.data_source_id).toBe('ds-1')
      expect(call.title[0].text.content).toBe('Renamed')
    })

    it('should update description and properties together', async () => {
      mockNotion.dataSources.update.mockResolvedValueOnce({})

      await databases(notion, {
        action: 'update_data_source',
        data_source_id: 'ds-1',
        description: 'Updated desc',
        properties: { Priority: { select: {} } }
      })

      const call = mockNotion.dataSources.update.mock.calls[0][0]
      expect(call.description[0].text.content).toBe('Updated desc')
      expect(call.properties).toEqual({ Priority: { select: {} } })
    })

    it('should throw when data_source_id is missing', async () => {
      await expect(databases(notion, { action: 'update_data_source', title: 'X' })).rejects.toThrow(
        'data_source_id required'
      )
    })

    it('should throw when no updates are provided', async () => {
      await expect(databases(notion, { action: 'update_data_source', data_source_id: 'ds-1' })).rejects.toThrow(
        'No updates provided'
      )
    })
  })

  describe('update_database', () => {
    it('should update database title', async () => {
      mockNotion.databases.update.mockResolvedValueOnce({})

      const result = await databases(notion, {
        action: 'update_database',
        database_id: 'db-1',
        title: 'New Title'
      })

      expect(result).toEqual({
        action: 'update_database',
        database_id: 'db-1',
        updated: true
      })

      const call = mockNotion.databases.update.mock.calls[0][0]
      expect(call.database_id).toBe('db-1')
      expect(call.title[0].text.content).toBe('New Title')
    })

    it('should update icon and cover', async () => {
      mockNotion.databases.update.mockResolvedValueOnce({})

      await databases(notion, {
        action: 'update_database',
        database_id: 'db-1',
        icon: '📋',
        cover: 'https://example.com/cover.jpg'
      })

      const call = mockNotion.databases.update.mock.calls[0][0]
      expect(call.icon).toEqual({ type: 'emoji', emoji: '📋' })
      expect(call.cover).toEqual({
        type: 'external',
        external: { url: 'https://example.com/cover.jpg' }
      })
    })

    it('should update parent_id, description, and is_inline', async () => {
      mockNotion.databases.update.mockResolvedValueOnce({})

      await databases(notion, {
        action: 'update_database',
        database_id: 'db-1',
        parent_id: 'new-parent',
        description: 'Updated',
        is_inline: true
      })

      const call = mockNotion.databases.update.mock.calls[0][0]
      expect(call.parent).toEqual({ type: 'page_id', page_id: 'new-parent' })
      expect(call.description[0].text.content).toBe('Updated')
      expect(call.is_inline).toBe(true)
    })

    it('should throw when database_id is missing', async () => {
      await expect(databases(notion, { action: 'update_database', title: 'X' })).rejects.toThrow('database_id required')
    })

    it('should throw when no updates are provided', async () => {
      await expect(databases(notion, { action: 'update_database', database_id: 'db-1' })).rejects.toThrow(
        'No updates provided'
      )
    })
  })

  describe('list_templates', () => {
    it('should list templates from first data source', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.listTemplates.mockResolvedValueOnce({
        templates: [
          {
            id: 'tmpl-1',
            properties: {
              Name: { title: [{ plain_text: 'Template A' }] }
            }
          },
          {
            id: 'tmpl-2',
            properties: {
              title: { title: [{ plain_text: 'Template B' }] }
            }
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await databases(notion, {
        action: 'list_templates',
        database_id: 'db-1'
      })

      expect(result.action).toBe('list_templates')
      expect(result.database_id).toBe('db-1')
      expect(result.data_source_id).toBe('ds-1')
      expect(result.total).toBe(2)
      expect(result.templates[0].template_id).toBe('tmpl-1')
      expect(result.templates[0].title).toBe('Template A')
    })

    it('should use specific data_source_id when provided', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse())
      mockNotion.dataSources.listTemplates.mockResolvedValueOnce({
        templates: [],
        next_cursor: null,
        has_more: false
      })

      const result = await databases(notion, {
        action: 'list_templates',
        database_id: 'db-1',
        data_source_id: 'ds-custom'
      })

      expect(result.data_source_id).toBe('ds-custom')
      expect(mockNotion.dataSources.listTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ data_source_id: 'ds-custom' })
      )
    })

    it('should throw when no data sources exist', async () => {
      mockNotion.databases.retrieve.mockResolvedValueOnce(makeDbRetrieveResponse({ data_sources: [] }))

      await expect(databases(notion, { action: 'list_templates', database_id: 'db-1' })).rejects.toThrow(
        'No data sources found'
      )
    })

    it('should throw when database_id is missing', async () => {
      await expect(databases(notion, { action: 'list_templates' })).rejects.toThrow('database_id required')
    })
  })

  describe('unknown action', () => {
    it('should throw on unknown action', async () => {
      await expect(databases(notion, { action: 'invalid' as any })).rejects.toThrow('Unknown action: invalid')
    })
  })
})
