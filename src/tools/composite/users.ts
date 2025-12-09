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
}

/**
 * Unified users tool
 * Maps to: GET /v1/users and GET /v1/users/{id} and GET /v1/users/me
 */
export async function users(notion: Client, input: UsersInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'list': {
        const usersList = await autoPaginate((cursor) =>
          notion.users.list({
            start_cursor: cursor,
            page_size: 100
          })
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
      }

      case 'get': {
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

      case 'me': {
        const botUser = await notion.users.retrieve({ user_id: 'me' })

        return {
          action: 'me',
          id: (botUser as any).id,
          type: (botUser as any).type,
          name: (botUser as any).name || 'Bot',
          bot: (botUser as any).bot
        }
      }

      case 'from_workspace': {
        // Alternative method: Search pages and extract user info from metadata
        // This bypasses the permission issue with direct users.list() call
        const searchResults: any = await notion.search({
          filter: { property: 'object', value: 'page' },
          page_size: 100
        })

        const usersMap = new Map<string, any>()

        for (const page of searchResults.results) {
          // Extract users from created_by and last_edited_by
          if (page.created_by) {
            usersMap.set(page.created_by.id, {
              id: page.created_by.id,
              type: page.created_by.object,
              source: 'page_metadata'
            })
          }
          if (page.last_edited_by) {
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

      default:
        throw new NotionMCPError(
          `Unknown action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: list, get, me, from_workspace'
        )
    }
  })()
}
