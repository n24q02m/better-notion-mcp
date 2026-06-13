/**
 * Resource Registry and Handlers
 * Manages documentation resources and help files
 */

import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { NotionMCPError } from './helpers/errors.js'

// Get docs directory path - works for both bundled CLI and unbundled code
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// For bundled CLI: __dirname = /bin/, docs at /build/src/docs/
// For unbundled: __dirname = /build/src/tools/, docs at /build/src/docs/
const DOCS_DIR = __dirname.endsWith('bin')
  ? join(__dirname, '..', 'build', 'src', 'docs')
  : join(__dirname, '..', 'docs')

/**
 * Documentation resources for full tool details
 */
const RESOURCES = [
  { uri: 'notion://docs/pages', name: 'Pages Tool Docs', file: 'pages.md' },
  { uri: 'notion://docs/databases', name: 'Databases Tool Docs', file: 'databases.md' },
  { uri: 'notion://docs/blocks', name: 'Blocks Tool Docs', file: 'blocks.md' },
  { uri: 'notion://docs/users', name: 'Users Tool Docs', file: 'users.md' },
  { uri: 'notion://docs/workspace', name: 'Workspace Tool Docs', file: 'workspace.md' },
  { uri: 'notion://docs/comments', name: 'Comments Tool Docs', file: 'comments.md' },
  { uri: 'notion://docs/content_convert', name: 'Content Convert Tool Docs', file: 'content_convert.md' },
  { uri: 'notion://docs/file_uploads', name: 'File Uploads Tool Docs', file: 'file_uploads.md' }
]

/**
 * Register resource-related request handlers
 */
export function registerResourceHandlers(server: Server) {
  // Resources handlers for full documentation
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      mimeType: 'text/markdown'
    }))
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    const resource = RESOURCES.find((r) => r.uri === uri)

    if (!resource) {
      throw new NotionMCPError(
        `Resource not found: ${uri}`,
        'RESOURCE_NOT_FOUND',
        `Available: ${RESOURCES.map((r) => r.uri).join(', ')}`
      )
    }

    try {
      const content = await readFile(join(DOCS_DIR, basename(resource.file)), 'utf-8')
      return {
        contents: [{ uri, mimeType: 'text/markdown', text: content }]
      }
    } catch {
      throw new NotionMCPError(`Documentation not found for: ${resource.name}`, 'DOC_NOT_FOUND', 'Check resource URI')
    }
  })
}

/**
 * Retrieve documentation for a specific tool
 * Used by the help tool
 */
export async function getToolDocumentation(toolName: string): Promise<string> {
  // Security: Use basename() to ensure we only look for files directly inside DOCS_DIR,
  // preventing path traversal even if the allowlist validation is bypassed or modified.
  const docFile = `${basename(toolName)}.md`
  const fullPath = join(DOCS_DIR, docFile)

  if (!fullPath.startsWith(DOCS_DIR)) {
    throw new NotionMCPError('Path traversal attempt detected', 'SECURITY_ERROR', 'Invalid tool_name')
  }

  try {
    return await readFile(fullPath, 'utf-8')
  } catch {
    throw new NotionMCPError(`Documentation not found for: ${toolName}`, 'DOC_NOT_FOUND', 'Check tool_name')
  }
}
