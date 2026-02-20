import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileUploads } from './file-uploads'

const mockNotion = {
  fileUploads: {
    create: vi.fn(),
    send: vi.fn(),
    complete: vi.fn(),
    retrieve: vi.fn(),
    list: vi.fn()
  }
}

describe('fileUploads', () => {
  beforeEach(() => {
    mockNotion.fileUploads.create.mockReset()
    mockNotion.fileUploads.send.mockReset()
    mockNotion.fileUploads.complete.mockReset()
    mockNotion.fileUploads.retrieve.mockReset()
    mockNotion.fileUploads.list.mockReset()
  })

  describe('create', () => {
    it('should create a file upload session', async () => {
      mockNotion.fileUploads.create.mockResolvedValue({
        id: 'upload-123',
        status: 'pending',
        filename: 'test.png',
        content_type: 'image/png',
        upload_url: 'https://upload.example.com/123'
      })

      const result = await fileUploads(mockNotion as any, {
        action: 'create',
        filename: 'test.png',
        content_type: 'image/png'
      })

      expect(result).toEqual({
        action: 'create',
        file_upload_id: 'upload-123',
        status: 'pending',
        filename: 'test.png',
        content_type: 'image/png',
        upload_url: 'https://upload.example.com/123',
        created: true
      })
      expect(mockNotion.fileUploads.create).toHaveBeenCalledWith({
        filename: 'test.png',
        content_type: 'image/png'
      })
    })

    it('should create with multi_part mode', async () => {
      mockNotion.fileUploads.create.mockResolvedValue({
        id: 'upload-456',
        status: 'pending',
        filename: 'large-file.zip',
        content_type: 'application/zip',
        upload_url: 'https://upload.example.com/456'
      })

      const result = await fileUploads(mockNotion as any, {
        action: 'create',
        filename: 'large-file.zip',
        content_type: 'application/zip',
        mode: 'multi_part',
        number_of_parts: 3
      })

      expect(result.file_upload_id).toBe('upload-456')
      expect(result.created).toBe(true)
      expect(mockNotion.fileUploads.create).toHaveBeenCalledWith({
        filename: 'large-file.zip',
        content_type: 'application/zip',
        mode: 'multi_part',
        number_of_parts: 3
      })
    })

    it('should throw without filename', async () => {
      await expect(fileUploads(mockNotion as any, { action: 'create', content_type: 'image/png' })).rejects.toThrow(
        'filename is required'
      )
    })

    it('should throw without content_type', async () => {
      await expect(fileUploads(mockNotion as any, { action: 'create', filename: 'test.png' })).rejects.toThrow(
        'content_type is required'
      )
    })
  })

  describe('send', () => {
    it('should send file content', async () => {
      const base64Content = Buffer.from('hello world').toString('base64')
      mockNotion.fileUploads.send.mockResolvedValue({ status: 'uploaded' })

      const result = await fileUploads(mockNotion as any, {
        action: 'send',
        file_upload_id: 'upload-123',
        file_content: base64Content
      })

      expect(result).toEqual({
        action: 'send',
        file_upload_id: 'upload-123',
        part_number: undefined,
        status: 'uploaded'
      })
      const callArgs = mockNotion.fileUploads.send.mock.calls[0][0]
      expect(callArgs.file_upload_id).toBe('upload-123')
      expect(callArgs.file).toEqual({
        data: expect.any(Blob),
        filename: 'file'
      })
    })

    it('should send with part_number', async () => {
      const base64Content = Buffer.from('part data').toString('base64')
      mockNotion.fileUploads.send.mockResolvedValue({ status: 'uploaded' })

      const result = await fileUploads(mockNotion as any, {
        action: 'send',
        file_upload_id: 'upload-123',
        file_content: base64Content,
        part_number: 2
      })

      expect(result.part_number).toBe(2)
      const callArgs = mockNotion.fileUploads.send.mock.calls[0][0]
      expect(callArgs.file_upload_id).toBe('upload-123')
      expect(callArgs.file).toEqual({
        data: expect.any(Blob),
        filename: 'file'
      })
      expect(callArgs.part_number).toBe('2')
    })

    it('should throw without file_upload_id', async () => {
      await expect(fileUploads(mockNotion as any, { action: 'send', file_content: 'abc' })).rejects.toThrow(
        'file_upload_id is required'
      )
    })

    it('should throw without file_content', async () => {
      await expect(fileUploads(mockNotion as any, { action: 'send', file_upload_id: 'upload-123' })).rejects.toThrow(
        'file_content is required'
      )
    })
  })

  describe('complete', () => {
    it('should complete a file upload', async () => {
      mockNotion.fileUploads.complete.mockResolvedValue({ status: 'uploaded' })

      const result = await fileUploads(mockNotion as any, {
        action: 'complete',
        file_upload_id: 'upload-123'
      })

      expect(result).toEqual({
        action: 'complete',
        file_upload_id: 'upload-123',
        status: 'uploaded',
        completed: true
      })
      expect(mockNotion.fileUploads.complete).toHaveBeenCalledWith({
        file_upload_id: 'upload-123'
      })
    })

    it('should throw without file_upload_id', async () => {
      await expect(fileUploads(mockNotion as any, { action: 'complete' })).rejects.toThrow('file_upload_id is required')
    })
  })

  describe('retrieve', () => {
    it('should retrieve file upload details', async () => {
      mockNotion.fileUploads.retrieve.mockResolvedValue({
        id: 'upload-123',
        status: 'uploaded',
        filename: 'test.png',
        content_type: 'image/png',
        created_time: '2025-01-01T00:00:00.000Z'
      })

      const result = await fileUploads(mockNotion as any, {
        action: 'retrieve',
        file_upload_id: 'upload-123'
      })

      expect(result).toEqual({
        action: 'retrieve',
        file_upload_id: 'upload-123',
        status: 'uploaded',
        filename: 'test.png',
        content_type: 'image/png',
        created_time: '2025-01-01T00:00:00.000Z'
      })
      expect(mockNotion.fileUploads.retrieve).toHaveBeenCalledWith({
        file_upload_id: 'upload-123'
      })
    })

    it('should throw without file_upload_id', async () => {
      await expect(fileUploads(mockNotion as any, { action: 'retrieve' })).rejects.toThrow('file_upload_id is required')
    })
  })

  describe('list', () => {
    it('should list all file uploads', async () => {
      mockNotion.fileUploads.list.mockResolvedValue({
        results: [
          { id: 'f1', filename: 'a.png', content_type: 'image/png', status: 'uploaded', created_time: '2025-01-01' },
          {
            id: 'f2',
            filename: 'b.pdf',
            content_type: 'application/pdf',
            status: 'pending',
            created_time: '2025-01-02'
          }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await fileUploads(mockNotion as any, { action: 'list' })

      expect(result.action).toBe('list')
      expect(result.total).toBe(2)
      expect(result.file_uploads).toEqual([
        {
          file_upload_id: 'f1',
          filename: 'a.png',
          content_type: 'image/png',
          status: 'uploaded',
          created_time: '2025-01-01'
        },
        {
          file_upload_id: 'f2',
          filename: 'b.pdf',
          content_type: 'application/pdf',
          status: 'pending',
          created_time: '2025-01-02'
        }
      ])
      expect(mockNotion.fileUploads.list).toHaveBeenCalledWith({
        start_cursor: undefined,
        page_size: 100
      })
    })

    it('should respect limit', async () => {
      mockNotion.fileUploads.list.mockResolvedValue({
        results: [
          { id: 'f1', filename: 'a.png', content_type: 'image/png', status: 'uploaded', created_time: '2025-01-01' },
          {
            id: 'f2',
            filename: 'b.pdf',
            content_type: 'application/pdf',
            status: 'pending',
            created_time: '2025-01-02'
          },
          { id: 'f3', filename: 'c.jpg', content_type: 'image/jpeg', status: 'uploaded', created_time: '2025-01-03' }
        ],
        next_cursor: null,
        has_more: false
      })

      const result = await fileUploads(mockNotion as any, { action: 'list', limit: 2 })

      expect(result.total).toBe(2)
      expect(result.file_uploads).toHaveLength(2)
      expect(result.file_uploads[0].file_upload_id).toBe('f1')
      expect(result.file_uploads[1].file_upload_id).toBe('f2')
    })
  })

  it('should throw on unknown action', async () => {
    await expect(fileUploads(mockNotion as any, { action: 'invalid' as any })).rejects.toThrow(
      'Unknown action: invalid'
    )
  })
})
