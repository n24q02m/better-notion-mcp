export interface DatabasesInput {
  action:
    | 'create'
    | 'get'
    | 'query'
    | 'create_page'
    | 'update_page'
    | 'delete_page'
    | 'create_data_source'
    | 'update_data_source'
    | 'update_database'
    | 'list_templates'

  // Common params
  database_id?: string
  data_source_id?: string

  // Create database params
  parent_id?: string
  title?: string
  description?: string
  properties?: Record<string, any>
  is_inline?: boolean
  icon?: string
  cover?: string

  // Query params
  filters?: any
  sorts?: any[]
  limit?: number
  search?: string

  // Page operations params (create/update/delete database items)
  page_id?: string
  page_ids?: string[]
  page_properties?: Record<string, any>

  // Bulk operations
  pages?: Array<{
    page_id?: string
    properties: Record<string, any>
  }>
}

export interface CreateDatabaseResponse {
  action: 'create'
  database_id: string
  data_source_id?: string
  url: string
  created: boolean
}

export interface GetDatabaseResponse {
  action: 'get'
  database_id: string
  title: string
  description: string
  url: string
  is_inline: boolean
  created_time: string
  last_edited_time: string
  data_source: {
    id: string
    name: string
  } | null
  schema: Record<string, any>
}

export interface QueryDatabaseResponse {
  action: 'query'
  database_id: string
  data_source_id: string
  total: number
  results: Record<string, any>[]
}

export interface CreateDatabasePageResponse {
  action: 'create_page'
  database_id: string
  data_source_id: string
  processed: number
  results: {
    page_id: string
    url: string
    created: boolean
  }[]
}

export interface UpdateDatabasePageResponse {
  action: 'update_page'
  processed: number
  results: {
    page_id: string
    updated: boolean
  }[]
}

export interface DeleteDatabasePageResponse {
  action: 'delete_page'
  processed: number
  results: {
    page_id: string
    deleted: boolean
  }[]
}

export interface CreateDataSourceResponse {
  action: 'create_data_source'
  data_source_id: string
  database_id: string
  created: boolean
}

export interface UpdateDataSourceResponse {
  action: 'update_data_source'
  data_source_id: string
  updated: boolean
}

export interface UpdateDatabaseResponse {
  action: 'update_database'
  database_id: string
  updated: boolean
}

export interface ListDataSourceTemplatesResponse {
  action: 'list_templates'
  database_id: string
  data_source_id: string
  total: number
  templates: {
    template_id: string
    title: string
    properties: any
  }[]
}

export type DatabasesResponse =
  | CreateDatabaseResponse
  | GetDatabaseResponse
  | QueryDatabaseResponse
  | CreateDatabasePageResponse
  | UpdateDatabasePageResponse
  | DeleteDatabasePageResponse
  | CreateDataSourceResponse
  | UpdateDataSourceResponse
  | UpdateDatabaseResponse
  | ListDataSourceTemplatesResponse
