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

import { RECEIPT_REQUIRED_STATUS, receiptChallenge, verifyEmiliaReceipt } from '@emilia-protocol/require-receipt'
import type { ChallengeOptions, VerifyResult } from '@emilia-protocol/require-receipt'

// Reject receipts older than this when verifying (seconds).
const MAX_AGE_SEC = 900

// One-time consumption: receipt_ids consumed by this process cannot be replayed.
// In-memory and per-process; back it with shared storage if you run multiple
// instances.
const consumedReceiptIds = new Set<string>()

// Optional production hardening: comma-separated base64url SPKI-DER issuer keys.
// When set, only receipts signed by these keys are accepted and the receipt's
// own inline key is no longer trusted. When unset, fall back to the documented
// demo behavior (allowInlineKey: true) that accepts the receipt's inline key
// (proves integrity, NOT trust).
const trustedKeys = (process.env.EMILIA_TRUSTED_KEYS ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k.length > 0)

export type GuardResult = { ok: true; receiptId: string } | { ok: false; challenge: Record<string, unknown> }

/**
 * Verify (but do NOT consume) a receipt for an irreversible action.
 *
 * Checks signature, freshness, action-binding, and that the receipt id has not
 * already been consumed by this process. Returns the verified receipt id on
 * success, or a machine-readable Receipt Required challenge (HTTP 428 shape) the
 * agent can act on -- the MCP tool-result equivalent of answering 428.
 *
 * Replay protection is enforced here (not-already-consumed check); the caller
 * must call {@link commitReceipt} ONLY after the irreversible action succeeds,
 * so a transient failure does not burn a valid approval.
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

  // Pin trustedKeys when EMILIA_TRUSTED_KEYS is set; otherwise accept the
  // receipt's own inline key (demo fallback -- proves integrity, not trust).
  const useTrustedKeys = trustedKeys.length > 0
  const verified: VerifyResult = verifyEmiliaReceipt(receipt, {
    trustedKeys: useTrustedKeys ? trustedKeys : undefined,
    allowInlineKey: !useTrustedKeys,
    action,
    maxAgeSec: MAX_AGE_SEC
  })

  if (!verified.ok || !verified.receipt_id) {
    return {
      ok: false,
      challenge: {
        ...receiptChallenge(action, `Receipt rejected: ${verified.reason}.`, challengeOpts),
        rejected: { reason: verified.reason }
      }
    }
  }

  if (consumedReceiptIds.has(verified.receipt_id)) {
    return {
      ok: false,
      challenge: {
        ...receiptChallenge(action, 'Receipt already consumed (replay refused).', challengeOpts),
        rejected: { reason: 'receipt_replayed' }
      }
    }
  }

  return { ok: true, receiptId: verified.receipt_id }
}

/**
 * Record a verified receipt id as consumed, AFTER the irreversible action has
 * succeeded. Marks the receipt single-use so it cannot be replayed. Call this
 * only on success -- on failure, skip it so the approval can be retried.
 */
export function commitReceipt(receiptId: string): void {
  consumedReceiptIds.add(receiptId)
}
