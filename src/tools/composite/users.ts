/**
 * Users Mega Tool
 * All user operations in one unified interface
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { autoPaginate } from '../helpers/pagination.js'

export interface UsersInput {
  action: 'list' | 'get' | 'me' | 'from_workspace'
  user_id?: string
  limit?: number
}

export interface ListUsersResult {
  action: 'list'
  total: number
  users: any[]
}

export interface GetUserResult {
  action: 'get'
  id: string
  type: string
  name: string
  avatar_url: string | null
  email?: string
}

export interface GetMeResult {
  action: 'me'
  id: string
  type: string
  name: string
  bot: any
}

export interface FromWorkspaceResult {
  action: 'from_workspace'
  total: number
  users: any[]
  note: string
}

export type UsersResult = ListUsersResult | GetUserResult | GetMeResult | FromWorkspaceResult

/**
 * Unified users tool
 * Maps to: GET /v1/users and GET /v1/users/{id} and GET /v1/users/me
 */
export async function users(notion: Client, input: UsersInput): Promise<UsersResult> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'list':
        return await listUsers(notion, input)

      case 'get':
        return await getUser(notion, input)

      case 'me':
        return await getMe(notion)

      case 'from_workspace':
        return await getUsersFromWorkspace(notion, input)

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: list, get, me, from_workspace'
        )
    }
  })()
}

/**
 * List all users
 * Maps to: GET /v1/users
 */
async function listUsers(notion: Client, input: UsersInput): Promise<ListUsersResult> {
  try {
    const usersList = await autoPaginate(
      (cursor, pageSize) =>
        notion.users.list({
          start_cursor: cursor,
          page_size: pageSize
        }),
      { limit: input.limit }
    )

    return {
      action: 'list',
      total: usersList.length,
      users: usersList.map((user: any) => ({
        id: user.id,
        type: user.type,
        name: user.name || 'Unknown',
        avatar_url: user.avatar_url,
        email: user.type === 'person' ? user.person?.email : undefined
      }))
    }
  } catch (error: any) {
    // Auto-suggest from_workspace when permission denied
    if (error?.code === 'restricted_resource' || error?.code === 'RESTRICTED_RESOURCE') {
      throw new NotionMCPError(
        'Integration does not have permission to list users',
        'RESTRICTED_RESOURCE',
        'Use action "from_workspace" instead — it extracts users from accessible pages without requiring admin permissions.'
      )
    }
    throw error
  }
}

/**
 * Retrieve a single user
 * Maps to: GET /v1/users/{id}
 */
async function getUser(notion: Client, input: UsersInput): Promise<GetUserResult> {
  if (!input.user_id) {
    throw new NotionMCPError('user_id required for get action', 'VALIDATION_ERROR', 'Provide user_id')
  }

  const user = await notion.users.retrieve({ user_id: input.user_id })

  return {
    action: 'get',
    id: user.id,
    type: user.type,
    name: (user as any).name || 'Unknown',
    avatar_url: (user as any).avatar_url,
    email: user.type === 'person' ? (user as any).person?.email : undefined
  }
}

/**
 * Retrieve the bot user
 * Maps to: GET /v1/users/me
 */
async function getMe(notion: Client): Promise<GetMeResult> {
  const botUser = await notion.users.retrieve({ user_id: 'me' })

  return {
    action: 'me',
    id: (botUser as any).id,
    type: (botUser as any).type,
    name: (botUser as any).name || 'Bot',
    bot: (botUser as any).bot
  }
}

/**
 * Extract users from accessible pages
 */
async function getUsersFromWorkspace(notion: Client, input: UsersInput): Promise<FromWorkspaceResult> {
  // Alternative method: Search pages and extract user info from metadata
  // This bypasses the permission issue with direct users.list() call
  const searchResults: any = await autoPaginate(
    (cursor, pageSize) =>
      notion.search({
        filter: { property: 'object', value: 'page' },
        start_cursor: cursor,
        page_size: pageSize
      }),
    { limit: input.limit || 500 } // Default to 500 search results to scan
  )

  const usersMap = new Map<string, any>()

  for (let i = 0; i < searchResults.length; i++) {
    const page: any = searchResults[i]
    // Extract users from created_by and last_edited_by
    if (page.created_by?.id && !usersMap.has(page.created_by.id)) {
      usersMap.set(page.created_by.id, {
        id: page.created_by.id,
        type: page.created_by.object,
        source: 'page_metadata'
      })
    }
    if (page.last_edited_by?.id && !usersMap.has(page.last_edited_by.id)) {
      usersMap.set(page.last_edited_by.id, {
        id: page.last_edited_by.id,
        type: page.last_edited_by.object,
        source: 'page_metadata'
      })
    }
  }

  const users = Array.from(usersMap.values())

  return {
    action: 'from_workspace',
    total: users.length,
    users,
    note: 'Users extracted from accessible pages. Use "me" action for bot info, or share more pages for more users.'
  }
}
