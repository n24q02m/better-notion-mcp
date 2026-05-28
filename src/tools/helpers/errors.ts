/**
 * Interface for error-like objects to replace 'any'
 */
interface ErrorLike {
  message?: string
  name?: string
  code?: string
  status?: number
  response?: {
    status?: number
    headers?: Record<string, string>
    [key: string]: unknown
  }
  request?: {
    headers?: Record<string, string>
    _headers?: Record<string, string>
    [key: string]: unknown
  }
  config?: {
    headers?: Record<string, string>
    [key: string]: unknown
  }
  body?: NotionErrorBody
  headers?: Record<string, string>
  _headers?: Record<string, string>
  [key: string]: unknown
}

/**
 * Interface for Notion-specific error bodies
 */
interface NotionErrorBody {
  message?: string
  object?: string
  code?: string
  status?: number
  request_id?: string
  path?: string
  [key: string]: unknown
}

/**
 * Custom error class for Notion MCP operations
 */
export class NotionMCPError extends Error {
  constructor(
    public message: string,
    public code: string,
    public suggestion?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'NotionMCPError'
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      details: this.details
    }
  }
}

/**
 * Sanitize validation error body to remove sensitive information
 */
function sanitizeValidationBody(body: unknown): Record<string, unknown> | unknown {
  if (!body || typeof body !== 'object') return body

  // whitelist safe properties from Notion API validation_error responses
  const safe: Record<string, unknown> = {}
  const safeFields = ['message', 'object', 'code', 'status', 'request_id', 'path']

  for (const field of safeFields) {
    if (body && typeof body === 'object' && field in body) {
      safe[field] = (body as Record<string, unknown>)[field]
    }
  }

  return safe
}

/**
 * Sanitize error object to remove sensitive information
 */
function sanitizeErrorDetails(error: unknown): Record<string, unknown> | unknown {
  if (!error || typeof error !== 'object') return error

  // whitelist safe properties
  const safe: Record<string, unknown> = {
    message: (error as ErrorLike).message,
    name: (error as ErrorLike).name,
    code: (error as ErrorLike).code
  }

  // Add status if available (common in HTTP errors)
  if ((error as ErrorLike).status) safe.status = (error as ErrorLike).status
  if ((error as ErrorLike).response?.status) safe.status = (error as ErrorLike).response?.status

  return safe
}

/**
 * Header names to redact whenever they appear inside an error/details object.
 * Compared case-insensitively against the actual property names so that
 * `Authorization`, `authorization`, `AUTHORIZATION`, `Proxy-Authorization`,
 * etc. are all stripped.
 */
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'cookie',
  'set-cookie'
])

/**
 * Remove sensitive headers from a headers-shaped object regardless of the
 * casing the upstream library happened to use. Notion's SDK normalises
 * `Authorization` but third-party axios/fetch wrappers may surface
 * `authorization`, `AUTHORIZATION`, or `X-API-Key`.
 */
function redactHeaderMap(headers: unknown): void {
  if (!headers || typeof headers !== 'object') return
  for (const key of Object.keys(headers as Record<string, unknown>)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      delete (headers as Record<string, unknown>)[key]
    }
  }
}

function stripSensitiveFields(obj: unknown, seen = new WeakSet()): void {
  if (!obj || typeof obj !== 'object') return
  if (seen.has(obj)) return
  seen.add(obj as object)

  delete (obj as Record<string, unknown>).sensitive_token
  delete (obj as Record<string, unknown>).internal_config
  delete (obj as Record<string, unknown>).user_email

  // Strip authorization-style headers from the common error-shape locations
  // (response interceptors copy them onto multiple parent objects).
  redactHeaderMap((obj as ErrorLike).headers)
  redactHeaderMap((obj as ErrorLike)._headers)
  if ((obj as ErrorLike).request) {
    redactHeaderMap((obj as ErrorLike).request?.headers)
    redactHeaderMap((obj as ErrorLike).request?._headers)
  }
  if ((obj as ErrorLike).config) {
    redactHeaderMap((obj as ErrorLike).config?.headers)
  }
  if ((obj as ErrorLike).response) {
    redactHeaderMap((obj as ErrorLike).response?.headers)
  }

  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (typeof (obj as Record<string, unknown>)[key] === 'object' && (obj as Record<string, unknown>)[key] !== null) {
      stripSensitiveFields((obj as Record<string, unknown>)[key], seen)
    }
  }
}

/**
 * Map network-related errors
 */
function mapNetworkError(error: unknown): NotionMCPError | null {
  if ((error as ErrorLike).message?.includes('ECONNREFUSED') || (error as ErrorLike).message?.includes('ENOTFOUND')) {
    return new NotionMCPError(
      'Cannot connect to Notion API',
      'NETWORK_ERROR',
      'Check your internet connection and try again'
    )
  }
  return null
}

/**
 * Handle validation_error separately as it has dynamic suggestions
 */
function mapValidationError(error: unknown): NotionMCPError | null {
  if ((error as ErrorLike).code !== 'validation_error') return null

  const bodyMessage: string = (error as ErrorLike).body?.message || ''
  let suggestion = 'Check the API documentation for valid parameter formats'

  // Detect common property format mistakes and provide specific guidance
  if (bodyMessage.includes('rich_text') || bodyMessage.includes('title')) {
    suggestion =
      'Property format error. For database page properties, use simple values: {"Name": "text", "Status": "value", "Tags": ["a","b"], "Count": 42, "Done": true, "Due": "2025-01-15"}. The server auto-converts to Notion format.'
  } else if (bodyMessage.includes('property')) {
    suggestion =
      'Property name or type mismatch. Use databases(action="get") to check the schema, then match property names exactly (case-sensitive).'
  }

  return new NotionMCPError(
    bodyMessage || 'Invalid request parameters',
    'VALIDATION_ERROR',
    suggestion,
    sanitizeValidationBody((error as ErrorLike).body)
  )
}

/**
 * Static mapping of Notion API error codes to MCP error details
 */
const NOTION_ERROR_MAP: Record<string, { message: string; code: string; suggestion: string }> = {
  unauthorized: {
    message: 'Invalid or missing Notion API token',
    code: 'UNAUTHORIZED',
    suggestion:
      'Set NOTION_TOKEN environment variable with a valid integration token from https://www.notion.so/my-integrations'
  },
  restricted_resource: {
    message: 'Integration does not have access to this resource',
    code: 'RESTRICTED_RESOURCE',
    suggestion:
      'Share the page/database with your integration in Notion settings. For users/list: try the from_workspace action instead (extracts users from accessible pages).'
  },
  object_not_found: {
    message: 'Page or database not found',
    code: 'NOT_FOUND',
    suggestion:
      'Check the ID is correct. For databases: use the database container ID (from URL), not the data_source ID (from search). If you got this ID from workspace search, try databases/get first to resolve the correct ID.'
  },
  rate_limited: {
    message: 'Too many requests to Notion API',
    code: 'RATE_LIMITED',
    suggestion: 'Wait a few seconds and try again. Consider batching operations.'
  },
  conflict_error: {
    message: 'Conflict with existing data',
    code: 'CONFLICT',
    suggestion: 'The resource may have been modified. Refresh and try again.'
  },
  service_unavailable: {
    message: 'Notion API is temporarily unavailable',
    code: 'SERVICE_UNAVAILABLE',
    suggestion: 'Wait a moment and try again. Check https://status.notion.so for updates.'
  }
}

/**
 * Map Notion API errors
 */
function mapNotionError(error: unknown): NotionMCPError | null {
  if (!(error as ErrorLike).code) return null

  const validationError = mapValidationError(error)
  if (validationError) return validationError

  const code = (error as ErrorLike).code as string
  const message = (error as ErrorLike).message || 'Unknown Notion API error'
  const mapping = NOTION_ERROR_MAP[code]

  if (mapping) {
    return new NotionMCPError(mapping.message, mapping.code, mapping.suggestion)
  }

  return new NotionMCPError(message, code.toUpperCase(), 'Check the Notion API documentation for this error code')
}

/**
 * Map all other errors
 */
function mapGenericError(error: unknown): NotionMCPError {
  return new NotionMCPError(
    (error as ErrorLike).message || 'Unknown error occurred',
    'UNKNOWN_ERROR',
    'Please check your request and try again',
    sanitizeErrorDetails(error)
  )
}

/**
 * Enhance Notion API error with helpful context
 */
export function enhanceError(error: unknown): NotionMCPError {
  // Already a NotionMCPError — pass through unchanged
  if (error instanceof NotionMCPError) return error

  // Explicitly strip sensitive fields recursively
  stripSensitiveFields(error)

  // Chain of responsibility: Notion -> Network -> Generic
  return mapNotionError(error) || mapNetworkError(error) || mapGenericError(error)
}

/**
 * Find the closest matching string from a list of valid options.
 * Uses Levenshtein-like similarity (simple character overlap).
 */
export function findClosestMatch(input: string, validOptions: string[]): string | null {
  if (!input || validOptions.length === 0) return null

  const lower = input.toLowerCase()
  let bestMatch: string | null = null
  let bestScore = 0

  // Pre-calculate input bigrams outside the loop to avoid redundant allocations
  // Bolt optimization: moved from inside the validOptions loop
  const inputBigrams = new Set<string>()
  for (let i = 0; i < lower.length - 1; i++) inputBigrams.add(lower.slice(i, i + 2))

  for (const option of validOptions) {
    const optionLower = option.toLowerCase()
    // Check prefix match first
    if (optionLower.startsWith(lower) || lower.startsWith(optionLower)) {
      return option
    }
    // Simple bigram similarity
    const optionBigrams = new Set<string>()
    for (let i = 0; i < optionLower.length - 1; i++) optionBigrams.add(optionLower.slice(i, i + 2))

    let overlap = 0
    for (const b of inputBigrams) {
      if (optionBigrams.has(b)) overlap++
    }
    const score = (2 * overlap) / (inputBigrams.size + optionBigrams.size)
    if (score > bestScore && score > 0.4) {
      bestScore = score
      bestMatch = option
    }
  }

  return bestMatch
}

/**
 * Create AI-readable error message
 */
export function aiReadableMessage(error: NotionMCPError): string {
  let message = `Error: ${error.message}`

  // Use explicit suggestion if present, otherwise fallback to suggestFixes()
  const suggestion = error.suggestion || suggestFixes(error).join('\n- ')
  if (suggestion) {
    message += `\n\nSuggestion: ${error.suggestion ? suggestion : `\n- ${suggestion}`}`
  }

  if (error.details) {
    message += `\n\nDetails: ${JSON.stringify(error.details, null, 2)}`
  }

  return message
}

/**
 * Suggest fixes based on error
 */
// ⚡ Bolt: Cache suggestion arrays to avoid O(n) switch statements and
// repeated array allocation/pushes on every error handled.
const _ERROR_SUGGESTIONS_MAP: Record<string, string[]> = {
  UNAUTHORIZED: [
    'Check that NOTION_TOKEN is set in your environment',
    'Verify token at https://www.notion.so/my-integrations',
    'Create a new integration token if needed'
  ],
  RESTRICTED_RESOURCE: [
    'Open the page/database in Notion',
    'Click "..." menu → Add connections → Select your integration',
    'Grant access to parent pages if needed'
  ],
  NOT_FOUND: [
    'Verify the page/database ID is correct',
    'Check that the resource was not deleted',
    'Ensure you have access permissions'
  ],
  VALIDATION_ERROR: [
    'Check parameter types and formats',
    'Review required vs optional parameters',
    'Verify property names match database schema'
  ],
  RATE_LIMITED: [
    'Reduce request frequency',
    'Implement exponential backoff retry logic',
    'Batch multiple operations together'
  ],
  COMMENTS_LIST_UNAVAILABLE: [
    'Use action="get" with a specific comment_id if known',
    'Use action="create" to add a new comment (this endpoint is unaffected)',
    'This is a known Notion API limitation with OAuth tokens as of 2025-09-03'
  ]
}

const _DEFAULT_SUGGESTIONS = [
  'Check Notion API status at https://status.notion.so',
  'Review request parameters',
  'Try again in a few moments'
]

/**
 * Suggest fixes based on error
 */
export function suggestFixes(error: NotionMCPError): string[] {
  return _ERROR_SUGGESTIONS_MAP[error.code] || _DEFAULT_SUGGESTIONS
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>
): (...args: Args) => Promise<Return> {
  return async (...args: Args): Promise<Return> => {
    try {
      return await fn(...args)
    } catch (error) {
      throw enhanceError(error)
    }
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffMultiplier?: number
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffMultiplier = 2 } = options

  let lastError: unknown
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error

      // Don't retry on certain errors
      if ((error as ErrorLike).code === 'UNAUTHORIZED' || (error as ErrorLike).code === 'NOT_FOUND') {
        throw enhanceError(error)
      }

      // Last attempt
      if (attempt === maxRetries) {
        break
      }

      // Wait with exponential backoff
      await new Promise((resolve) => globalThis.setTimeout(resolve, delay))
      delay = Math.min(delay * backoffMultiplier, maxDelay)
    }
  }

  throw enhanceError(lastError)
}
