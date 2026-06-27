/**
 * Minimal local type declarations for `@emilia-protocol/require-receipt` (^0.3.0).
 *
 * The published package ships no `.d.ts`, so this module declares only the
 * surface the Receipt Required delete guard uses: the verify/challenge
 * functions, their option/result shapes, and the Receipt Required status
 * constant. Keep it in sync with the installed package version.
 *
 * See: https://www.emiliaprotocol.ai/agent-guard
 */

declare module '@emilia-protocol/require-receipt' {
  export const RECEIPT_REQUIRED_STATUS: number

  export interface VerifyOptions {
    /** base64url SPKI-DER public keys you trust as issuers */
    trustedKeys?: string[]
    /** also accept the receipt's own inline key (proves integrity, NOT trust) */
    allowInlineKey?: boolean
    /** require the receipt to be bound to this action_type */
    action?: string | null
    /** reject receipts older than this (seconds) */
    maxAgeSec?: number
    /** acceptable claim.outcome values */
    allowedOutcomes?: string[]
  }

  export interface VerifyResult {
    ok: boolean
    reason?: string
    outcome?: string
    subject?: string
    receipt_id?: string
    signer?: string
    detail?: string
  }

  export interface ChallengeOptions {
    status?: number
    statusCode?: number
    maxAgeSec?: number
    [key: string]: unknown
  }

  export function verifyEmiliaReceipt(doc: unknown, opts?: VerifyOptions): VerifyResult

  export function receiptChallenge(
    action: string | null,
    reason?: string,
    opts?: ChallengeOptions
  ): Record<string, unknown>
}
