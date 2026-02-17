/**
 * Error Handling Utilities
 * AI-friendly error messages and suggestions
 */

export class NotionMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
    public details?: any
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
 * Sanitize error object to remove sensitive information
 */
function sanitizeErrorDetails(error: any): any {
  if (!error || typeof error !== 'object') return error

  // whitelist safe properties
  const safe: any = {
    message: error.message,
    name: error.name,
    code: error.code
  }

  // Add status if available (common in HTTP errors)
  if (error.status) safe.status = error.status
  if (error.response?.status) safe.status = error.response.status

  return safe
}

/**
 * Enhance Notion API error with helpful context
 */
export function enhanceError(error: any): NotionMCPError {
  // Notion API error
  if (error.code) {
    return handleNotionError(error)
  }

  // Network error
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
    return new NotionMCPError(
      'Cannot connect to Notion API',
      'NETWORK_ERROR',
      'Check your internet connection and try again'
    )
  }

  // Generic error
  return new NotionMCPError(
    error.message || 'Unknown error occurred',
    'UNKNOWN_ERROR',
    'Please check your request and try again',
    sanitizeErrorDetails(error)
  )
}

/**
 * Handle specific Notion API errors
 */
function handleNotionError(error: any): NotionMCPError {
  const code = error.code
  const message = error.message || 'Unknown Notion API error'

  // Log error code and message only to avoid leaking sensitive data
  console.error(
    'Notion API Error:',
    JSON.stringify(
      {
        code,
        message,
        status: error.status
      },
      null,
      2
    )
  )

  switch (code) {
    case 'unauthorized':
      return new NotionMCPError(
        'Invalid or missing Notion API token',
        'UNAUTHORIZED',
        'Set NOTION_TOKEN environment variable with a valid integration token from https://www.notion.so/my-integrations'
      )

    case 'restricted_resource':
      return new NotionMCPError(
        'Integration does not have access to this resource',
        'RESTRICTED_RESOURCE',
        'Share the page/database with your integration in Notion settings'
      )

    case 'object_not_found':
      return new NotionMCPError(
        'Page or database not found',
        'NOT_FOUND',
        'Check that the ID is correct and the resource exists'
      )

    case 'validation_error':
      return new NotionMCPError(
        error.body?.message || 'Invalid request parameters',
        'VALIDATION_ERROR',
        'Check the API documentation for valid parameter formats',
        error.body
      )

    case 'rate_limited':
      return new NotionMCPError(
        'Too many requests to Notion API',
        'RATE_LIMITED',
        'Wait a few seconds and try again. Consider batching operations.'
      )

    case 'conflict_error':
      return new NotionMCPError(
        'Conflict with existing data',
        'CONFLICT',
        'The resource may have been modified. Refresh and try again.'
      )

    case 'service_unavailable':
      return new NotionMCPError(
        'Notion API is temporarily unavailable',
        'SERVICE_UNAVAILABLE',
        'Wait a moment and try again. Check https://status.notion.so for updates.'
      )

    default:
      return new NotionMCPError(message, code.toUpperCase(), 'Check the Notion API documentation for this error code')
  }
}

/**
 * Create AI-readable error message
 */
export function aiReadableMessage(error: NotionMCPError): string {
  let message = `Error: ${error.message}`

  if (error.suggestion) {
    message += `\n\nSuggestion: ${error.suggestion}`
  }

  if (error.details) {
    message += `\n\nDetails: ${JSON.stringify(error.details, null, 2)}`
  }

  return message
}

/**
 * Suggest fixes based on error
 */
export function suggestFixes(error: NotionMCPError): string[] {
  const suggestions: string[] = []

  switch (error.code) {
    case 'UNAUTHORIZED':
      suggestions.push('Check that NOTION_TOKEN is set in your environment')
      suggestions.push('Verify token at https://www.notion.so/my-integrations')
      suggestions.push('Create a new integration token if needed')
      break

    case 'RESTRICTED_RESOURCE':
      suggestions.push('Open the page/database in Notion')
      suggestions.push('Click "..." menu → Add connections → Select your integration')
      suggestions.push('Grant access to parent pages if needed')
      break

    case 'NOT_FOUND':
      suggestions.push('Verify the page/database ID is correct')
      suggestions.push('Check that the resource was not deleted')
      suggestions.push('Ensure you have access permissions')
      break

    case 'VALIDATION_ERROR':
      suggestions.push('Check parameter types and formats')
      suggestions.push('Review required vs optional parameters')
      suggestions.push('Verify property names match database schema')
      break

    case 'RATE_LIMITED':
      suggestions.push('Reduce request frequency')
      suggestions.push('Implement exponential backoff retry logic')
      suggestions.push('Batch multiple operations together')
      break

    default:
      suggestions.push('Check Notion API status at https://status.notion.so')
      suggestions.push('Review request parameters')
      suggestions.push('Try again in a few moments')
  }

  return suggestions
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
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

  let lastError: any
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Don't retry on certain errors
      if (error.code === 'UNAUTHORIZED' || error.code === 'NOT_FOUND') {
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
