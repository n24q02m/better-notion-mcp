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
  if (!body || typeof body !== 'object' || body === null) return body

  const b = body as Record<string, unknown>
  const safe: Record<string, unknown> = {}
  const safeFields = ['message', 'object', 'code', 'status', 'request_id', 'path']

  for (const field of safeFields) {
    if (field in b) {
      safe[field] = b[field]
    }
  }

  return safe
}

/**
 * Sanitize error object to remove sensitive information
 */
function sanitizeErrorDetails(error: unknown): Record<string, unknown> | unknown {
  if (!error || typeof error !== 'object' || error === null) return error

  const err = error as Record<string, unknown>
  const safe: Record<string, unknown> = {
    message: err.message,
    name: err.name,
    code: err.code
  }

  if (err.status) safe.status = err.status
  const response = err.response as Record<string, unknown> | undefined
  if (response?.status) safe.status = response.status

  return safe
}

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'cookie',
  'set-cookie'
])

/**
 * Remove sensitive headers from a headers-shaped object
 */
function redactHeaderMap(headers: unknown): void {
  if (!headers || typeof headers !== 'object' || headers === null) return
  const h = headers as Record<string, unknown>
  for (const key of Object.keys(h)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      delete h[key]
    }
  }
}

function stripSensitiveFields(obj: unknown, seen = new WeakSet()): void {
  if (!obj || typeof obj !== 'object' || obj === null) return
  if (seen.has(obj)) return

  const o = obj as Record<string, unknown>
  seen.add(o)

  delete o.sensitive_token
  delete o.internal_config
  delete o.user_email

  redactHeaderMap(o.headers)
  redactHeaderMap(o._headers)

  const request = o.request as Record<string, unknown> | undefined
  if (request) {
    redactHeaderMap(request.headers)
    redactHeaderMap(request._headers)
  }

  const config = o.config as Record<string, unknown> | undefined
  if (config) {
    redactHeaderMap(config.headers)
  }

  const response = o.response as Record<string, unknown> | undefined
  if (response) {
    redactHeaderMap(response.headers)
  }

  for (const key of Object.keys(o)) {
    const value = o[key]
    if (typeof value === 'object' && value !== null) {
      stripSensitiveFields(value, seen)
    }
  }
}

/**
 * Map network-related errors
 */
function mapNetworkError(error: unknown): NotionMCPError | null {
  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as Record<string, unknown>
    if (typeof err.message === 'string') {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
        return new NotionMCPError(
          'Cannot connect to Notion API',
          'NETWORK_ERROR',
          'Check your internet connection and try again'
        )
      }
    }
  }
  return null
}

/**
 * Handle validation_error separately as it has dynamic suggestions
 */
function mapValidationError(error: unknown): NotionMCPError | null {
  if (!error || typeof error !== 'object' || error === null) return null
  const err = error as Record<string, unknown>
  if (err.code !== 'validation_error') return null

  const body = err.body as Record<string, unknown> | undefined
  const bodyMessage = (body?.message as string) || ''
  let suggestion = 'Check the API documentation for valid parameter formats'

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
    sanitizeValidationBody(body)
  )
}

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
  if (!error || typeof error !== 'object' || error === null) return null
  const err = error as Record<string, unknown>
  if (typeof err.code !== 'string') return null

  const validationError = mapValidationError(error)
  if (validationError) return validationError

  const mapping = NOTION_ERROR_MAP[err.code]
  if (mapping) {
    return new NotionMCPError(mapping.message, mapping.code, mapping.suggestion)
  }

  return new NotionMCPError(
    (err.message as string) || 'Unknown Notion API error',
    err.code.toUpperCase(),
    'Check the Notion API documentation for this error code'
  )
}

/**
 * Map all other errors
 */
function mapGenericError(error: unknown): NotionMCPError {
  const err = (error || {}) as Record<string, unknown>
  return new NotionMCPError(
    (err.message as string) || 'Unknown error occurred',
    'UNKNOWN_ERROR',
    'Please check your request and try again',
    sanitizeErrorDetails(error)
  )
}

/**
 * Enhance Notion API error with helpful context
 */
export function enhanceError(error: unknown): NotionMCPError {
  if (error instanceof NotionMCPError) return error

  stripSensitiveFields(error)

  return mapNotionError(error) || mapNetworkError(error) || mapGenericError(error)
}

export function findClosestMatch(input: string, validOptions: string[]): string | null {
  if (!input || validOptions.length === 0) return null

  const lower = input.toLowerCase()
  let bestMatch: string | null = null
  let bestScore = 0

  const inputBigrams = new Set<string>()
  for (let i = 0; i < lower.length - 1; i++) inputBigrams.add(lower.slice(i, i + 2))

  for (const option of validOptions) {
    const optionLower = option.toLowerCase()
    if (optionLower.startsWith(lower) || lower.startsWith(optionLower)) {
      return option
    }
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

export function aiReadableMessage(error: NotionMCPError): string {
  let message = `Error: ${error.message}`

  const suggestion = error.suggestion || suggestFixes(error).join('\n- ')
  if (suggestion) {
    message += `\n\nSuggestion: ${error.suggestion ? suggestion : `\n- ${suggestion}`}`
  }

  if (error.details) {
    message += `\n\nDetails: ${JSON.stringify(error.details, null, 2)}`
  }

  return message
}

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

export function suggestFixes(error: NotionMCPError): string[] {
  return _ERROR_SUGGESTIONS_MAP[error.code] || _DEFAULT_SUGGESTIONS
}

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

      if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>
        if (err.code === 'UNAUTHORIZED' || err.code === 'NOT_FOUND') {
          throw enhanceError(error)
        }
      }

      if (attempt === maxRetries) {
        break
      }

      await new Promise((resolve) => globalThis.setTimeout(resolve, delay))
      delay = Math.min(delay * backoffMultiplier, maxDelay)
    }
  }

  throw enhanceError(lastError)
}
