/**
 * Receipt Required guard for irreversible Notion actions.
 *
 * Demands a verifiable EMILIA authorization receipt before an irreversible
 * operation runs. This is NOT auth ("who are you") and NOT permissions ("are
 * you allowed here"). It is portable accountability evidence the operator keeps
 * for their own liability -- necessary, not sufficient. It sits alongside the
 * Notion token/scopes on the destructive path; it does not replace them.
 *
 * Verification is offline Ed25519 over canonical JSON (zero network).
 */

import {
  RECEIPT_REQUIRED_STATUS,
  receiptChallenge,
  verifyEmiliaReceipt
} from '@emilia-protocol/require-receipt'
import type { ChallengeOptions, VerifyResult } from '@emilia-protocol/require-receipt'

// Reject receipts older than this when verifying (seconds).
const MAX_AGE_SEC = 900

// One-time consumption: receipt_ids consumed by this process cannot be replayed.
// In-memory and per-process; back it with shared storage if you run multiple
// instances.
const consumedReceiptIds = new Set<string>()

export type GuardResult =
  | { ok: true; receiptId: string }
  | { ok: false; challenge: Record<string, unknown> }

/**
 * Demand a verifiable EMILIA authorization receipt before an irreversible action.
 *
 * Returns the receipt id to record on success, or a machine-readable Receipt
 * Required challenge (HTTP 428 shape) the agent can act on -- the MCP tool-result
 * equivalent of answering 428.
 */
export function guardReceipt(action: string, receipt: unknown): GuardResult {
  const challengeOpts: ChallengeOptions = {
    status: RECEIPT_REQUIRED_STATUS,
    maxAgeSec: MAX_AGE_SEC
  }

  if (!receipt) {
    return {
      ok: false,
      challenge: receiptChallenge(action, 'No EMILIA receipt presented.', challengeOpts)
    }
  }

  // NOTE: allowInlineKey accepts the receipt's own key (proves integrity, not
  // trust). In production, pin trustedKeys to the issuers you trust and drop
  // allowInlineKey.
  const verified: VerifyResult = verifyEmiliaReceipt(receipt, {
    allowInlineKey: true,
    action,
    maxAgeSec: MAX_AGE_SEC
  })

  if (!verified.ok || !verified.receipt_id) {
    return {
      ok: false,
      challenge: {
        ...receiptChallenge(action, `Receipt rejected: ${verified.reason}.`, challengeOpts),
        rejected: verified
      }
    }
  }

  if (consumedReceiptIds.has(verified.receipt_id)) {
    return {
      ok: false,
      challenge: {
        ...receiptChallenge(action, 'Receipt already consumed (replay refused).', challengeOpts),
        rejected: { ok: false, reason: 'receipt_replayed' }
      }
    }
  }

  consumedReceiptIds.add(verified.receipt_id)
  return { ok: true, receiptId: verified.receipt_id }
}
