import { readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { NotionMCPError } from './helpers/errors.js'

// Get docs directory path - works for both bundled CLI and unbundled code
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// For bundled CLI: __dirname = /bin/, docs at /build/src/docs/
// For unbundled: __dirname = /build/src/tools/, docs at /build/src/docs/
export const DOCS_DIR = __dirname.endsWith('bin')
  ? join(__dirname, '..', 'build', 'src', 'docs')
  : join(__dirname, '..', 'docs')

/**
 * Documentation resources for full tool details
 */
export const RESOURCES = [
  { uri: 'notion://docs/pages', name: 'Pages Tool Docs', file: 'pages.md' },
  { uri: 'notion://docs/databases', name: 'Databases Tool Docs', file: 'databases.md' },
  { uri: 'notion://docs/blocks', name: 'Blocks Tool Docs', file: 'blocks.md' },
  { uri: 'notion://docs/users', name: 'Users Tool Docs', file: 'users.md' },
  { uri: 'notion://docs/workspace', name: 'Workspace Tool Docs', file: 'workspace.md' },
  { uri: 'notion://docs/comments', name: 'Comments Tool Docs', file: 'comments.md' },
  { uri: 'notion://docs/content_convert', name: 'Content Convert Tool Docs', file: 'content_convert.md' },
  { uri: 'notion://docs/file_uploads', name: 'File Uploads Tool Docs', file: 'file_uploads.md' }
]

// Pre-compute resources for ListResourcesRequestSchema
// BOLT OPTIMIZATION: Avoids O(N) allocation on every list resources request
export const PRECOMPUTED_RESOURCES = RESOURCES.map((r) => ({
  uri: r.uri,
  name: r.name,
  mimeType: 'text/markdown'
}))

// Pre-compute map for ReadResourceRequestSchema
// BOLT OPTIMIZATION: O(1) lookup instead of O(N) find
export const RESOURCE_MAP = new Map(RESOURCES.map((r) => [r.uri, r]))
export const AVAILABLE_RESOURCE_URIS = RESOURCES.map((r) => r.uri).join(', ')

/**
 * Register resource handlers with MCP server
 */
export function registerResourceHandlers(server: Server) {
  // Resources handlers for full documentation
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: PRECOMPUTED_RESOURCES
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params
    const resource = RESOURCE_MAP.get(uri)

    if (!resource) {
      throw new NotionMCPError(
        `Resource not found: ${uri}`,
        'RESOURCE_NOT_FOUND',
        `Available: ${AVAILABLE_RESOURCE_URIS}`
      )
    }

    const fullPath = join(DOCS_DIR, basename(resource.file))
    const rel = relative(DOCS_DIR, fullPath)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new NotionMCPError('Path traversal attempt detected', 'SECURITY_ERROR', 'Invalid resource URI')
    }

    try {
      const content = await readFile(fullPath, 'utf-8')
      return {
        contents: [{ uri, mimeType: 'text/markdown', text: content }]
      }
    } catch {
      throw new NotionMCPError(`Documentation not found for: ${resource.name}`, 'DOC_NOT_FOUND', 'Check resource URI')
    }
  })
}
