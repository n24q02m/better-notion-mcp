import { describe, expect, it, vi } from 'vitest'
import { fileUploads } from './file-uploads.js'

describe('fileUploads Security', () => {
  const mockNotion = {
    fileUploads: {
      send: vi.fn(),
      retrieve: vi.fn()
    }
  }

  it('should reject file content exceeding the size limit', async () => {
    // 10MB limit in bytes
    const limit = 10 * 1024 * 1024
    // Base64 length for 10MB + 1 byte
    // Length = ceil((bytes * 4) / 3)
    // We want to be safely above.
    // 10.1 MB
    const targetBytes = limit + 1024 * 100 // 10MB + 100KB
    const base64Length = Math.ceil((targetBytes * 4) / 3)

    // Create a valid base64 string of sufficient length
    // 'a' is a valid base64 char; pad to multiple of 4 for valid base64
    const paddedLength = Math.ceil(base64Length / 4) * 4
    const largeContent = 'a'.repeat(paddedLength)

    await expect(
      fileUploads(mockNotion as any, {
        action: 'send',
        file_upload_id: 'upload-123',
        file_content: largeContent,
        filename: 'large.txt',
        content_type: 'text/plain'
      })
    ).rejects.toThrow(/exceeds maximum size/)
  })
})
