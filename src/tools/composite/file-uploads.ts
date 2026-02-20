/**
 * File Uploads Composite Tool
 * Upload, manage, and retrieve files in Notion
 * Maps to: POST/GET /v1/file_uploads endpoints (API 2025-09-03)
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { autoPaginate } from '../helpers/pagination.js'

export interface FileUploadsInput {
  action: 'create' | 'send' | 'complete' | 'retrieve' | 'list'

  // Common params
  file_upload_id?: string

  // Create params
  filename?: string
  content_type?: string
  mode?: 'single' | 'multi_part'
  number_of_parts?: number

  // Send params
  part_number?: number
  file_content?: string // Base64 encoded content for send action

  // List params
  limit?: number
}

/**
 * Unified file uploads tool - handles all file upload operations
 * Maps to: /v1/file_uploads endpoints
 */
export async function fileUploads(notion: Client, input: FileUploadsInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'create':
        return await createFileUpload(notion, input)

      case 'send':
        return await sendFileUpload(notion, input)

      case 'complete':
        return await completeFileUpload(notion, input)

      case 'retrieve':
        return await retrieveFileUpload(notion, input)

      case 'list':
        return await listFileUploads(notion, input)

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: create, send, complete, retrieve, list'
        )
    }
  })()
}

/**
 * Create a file upload session
 * Maps to: POST /v1/file_uploads
 */
async function createFileUpload(notion: Client, input: FileUploadsInput): Promise<any> {
  if (!input.filename) {
    throw new NotionMCPError('filename is required for create action', 'VALIDATION_ERROR', 'Provide filename')
  }

  if (!input.content_type) {
    throw new NotionMCPError(
      'content_type is required for create action',
      'VALIDATION_ERROR',
      'Provide content_type (e.g., "image/png", "application/pdf")'
    )
  }

  const params: any = {
    filename: input.filename,
    content_type: input.content_type
  }

  if (input.mode === 'multi_part' && input.number_of_parts) {
    params.mode = 'multi_part'
    params.number_of_parts = input.number_of_parts
  }

  const response: any = await (notion as any).fileUploads.create(params)

  return {
    action: 'create',
    file_upload_id: response.id,
    status: response.status,
    filename: response.filename,
    content_type: response.content_type,
    upload_url: response.upload_url,
    created: true
  }
}

/**
 * Send file data to an upload session
 * Maps to: POST /v1/file_uploads/{id}/send
 */
async function sendFileUpload(notion: Client, input: FileUploadsInput): Promise<any> {
  if (!input.file_upload_id) {
    throw new NotionMCPError(
      'file_upload_id is required for send action',
      'VALIDATION_ERROR',
      'Provide file_upload_id from create step'
    )
  }

  if (!input.file_content) {
    throw new NotionMCPError(
      'file_content is required for send action',
      'VALIDATION_ERROR',
      'Provide base64-encoded file content'
    )
  }

  const fileBuffer = Buffer.from(input.file_content, 'base64')
  const blob = new Blob([fileBuffer], {
    type: input.content_type || 'application/octet-stream'
  })

  const params: any = {
    file_upload_id: input.file_upload_id,
    file: { data: blob, filename: input.filename || 'file' }
  }

  if (input.part_number !== undefined) {
    params.part_number = String(input.part_number)
  }

  const response: any = await (notion as any).fileUploads.send(params)

  return {
    action: 'send',
    file_upload_id: input.file_upload_id,
    part_number: input.part_number,
    status: response.status || 'sent'
  }
}

/**
 * Complete a file upload session
 * Maps to: POST /v1/file_uploads/{id}/complete
 */
async function completeFileUpload(notion: Client, input: FileUploadsInput): Promise<any> {
  if (!input.file_upload_id) {
    throw new NotionMCPError(
      'file_upload_id is required for complete action',
      'VALIDATION_ERROR',
      'Provide file_upload_id'
    )
  }

  const response: any = await (notion as any).fileUploads.complete({
    file_upload_id: input.file_upload_id
  })

  return {
    action: 'complete',
    file_upload_id: input.file_upload_id,
    status: response.status || 'uploaded',
    completed: true
  }
}

/**
 * Retrieve file upload details
 * Maps to: GET /v1/file_uploads/{id}
 */
async function retrieveFileUpload(notion: Client, input: FileUploadsInput): Promise<any> {
  if (!input.file_upload_id) {
    throw new NotionMCPError(
      'file_upload_id is required for retrieve action',
      'VALIDATION_ERROR',
      'Provide file_upload_id'
    )
  }

  const response: any = await (notion as any).fileUploads.retrieve({
    file_upload_id: input.file_upload_id
  })

  return {
    action: 'retrieve',
    file_upload_id: response.id,
    status: response.status,
    filename: response.filename,
    content_type: response.content_type,
    created_time: response.created_time
  }
}

/**
 * List all file uploads
 * Maps to: GET /v1/file_uploads
 */
async function listFileUploads(notion: Client, input: FileUploadsInput): Promise<any> {
  const allResults = await autoPaginate(async (cursor) => {
    const response: any = await (notion as any).fileUploads.list({
      start_cursor: cursor,
      page_size: 100
    })
    return {
      results: response.results,
      next_cursor: response.next_cursor,
      has_more: response.has_more
    }
  })

  const results = input.limit ? allResults.slice(0, input.limit) : allResults

  return {
    action: 'list',
    total: results.length,
    file_uploads: results.map((f: any) => ({
      file_upload_id: f.id,
      filename: f.filename,
      content_type: f.content_type,
      status: f.status,
      created_time: f.created_time
    }))
  }
}
