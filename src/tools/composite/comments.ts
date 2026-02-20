/**
 * Comments Composite Tool
 * Manage page comments: list, get, create
 */

import type { Client } from '@notionhq/client'
import { NotionMCPError, withErrorHandling } from '../helpers/errors.js'
import { autoPaginate } from '../helpers/pagination.js'
import * as RichText from '../helpers/richtext.js'

export interface CommentsManageInput {
  page_id?: string
  comment_id?: string
  discussion_id?: string
  action: 'list' | 'get' | 'create'
  content?: string // For create action
}

/**
 * Manage comments (list, get, create)
 * Maps to: GET /v1/comments, GET /v1/comments/{id}, POST /v1/comments
 */
export async function commentsManage(notion: Client, input: CommentsManageInput): Promise<any> {
  return withErrorHandling(async () => {
    switch (input.action) {
      case 'list': {
        if (!input.page_id) {
          throw new NotionMCPError('page_id required for list action', 'VALIDATION_ERROR', 'Provide page_id')
        }

        const comments = await autoPaginate(async (cursor) => {
          return await (notion.comments as any).list({
            block_id: input.page_id,
            start_cursor: cursor
          })
        })

        return {
          page_id: input.page_id,
          total_comments: comments.length,
          comments: comments.map((comment: any) => ({
            id: comment.id,
            created_time: comment.created_time,
            created_by: comment.created_by,
            discussion_id: comment.discussion_id,
            text: RichText.extractPlainText(comment.rich_text),
            parent: comment.parent
          }))
        }
      }

      case 'get': {
        if (!input.comment_id) {
          throw new NotionMCPError('comment_id required for get action', 'VALIDATION_ERROR', 'Provide comment_id')
        }

        const comment: any = await (notion.comments as any).retrieve({
          comment_id: input.comment_id
        })

        return {
          action: 'get',
          comment_id: comment.id,
          created_time: comment.created_time,
          created_by: comment.created_by,
          discussion_id: comment.discussion_id,
          text: RichText.extractPlainText(comment.rich_text),
          rich_text: comment.rich_text,
          parent: comment.parent
        }
      }

      case 'create': {
        if (!input.content) {
          throw new NotionMCPError('content required for create action', 'VALIDATION_ERROR', 'Provide comment content')
        }

        // Either page_id or discussion_id must be provided
        if (!input.page_id && !input.discussion_id) {
          throw new NotionMCPError(
            'Either page_id or discussion_id is required for create action',
            'VALIDATION_ERROR',
            'Use page_id for new discussion, discussion_id for replies'
          )
        }

        const createParams: any = {
          rich_text: [RichText.text(input.content)]
        }

        // Add parent or discussion_id based on input
        if (input.discussion_id) {
          createParams.discussion_id = input.discussion_id
        } else {
          createParams.parent = {
            page_id: input.page_id
          }
        }

        const comment = await (notion.comments as any).create(createParams)

        return {
          action: 'create',
          comment_id: comment.id,
          discussion_id: comment.discussion_id,
          created: true
        }
      }

      default:
        throw new NotionMCPError(
          `Unsupported action: ${input.action}`,
          'VALIDATION_ERROR',
          'Supported actions: list, get, create'
        )
    }
  })()
}
