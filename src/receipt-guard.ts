/**
 * Receipt Required guard for irreversible Notion actions.
 *
 * Demands a verifiable EMILIA authorization receipt before an irreversible
 * operation runs. This is NOT auth ("who are you") and NOT permissions ("are
 * you allowed here"). It is portable accountability evidence the operator keeps
 * for their own liability -- necessary, not sufficient. It sits alongside the
 * Notion token/scopes on the destructive path; it does not replace them.
 *
 * The hardening (per-target binding, offline Ed25519 verification, replay
 * refusal, consume-after-success, sanitized { reason } rejections) lives in the
 * canonical makeReceiptGate from @emilia-protocol/require-receipt; this module
 * is a thin wrapper that builds the block-delete gate and exposes its `run`
 * orchestration (verify+reserve -> act -> commit on success / release on failure).
 */

import { makeReceiptGate } from '@emilia-protocol/require-receipt'
import type { ReceiptGate, RunResult } from '@emilia-protocol/require-receipt'

// Reject receipts older than this when verifying (seconds).
const MAX_AGE_SEC = 900

// Optional production hardening: comma-separated base64url SPKI-DER issuer keys.
// When set, only receipts signed by these keys are accepted and the receipt's
// own inline key is no longer trusted. When unset, fall back to the documented
// demo behavior (allowInlineKey: true) that accepts the receipt's inline key
// (proves integrity, NOT trust).
const trustedKeys = (process.env.EMILIA_TRUSTED_KEYS ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k.length > 0)

// One gate for the irreversible block-delete path. `action` is a function so the
// receipt is bound to THIS exact block: a receipt minted for another block id is
// refused. The consumed-receipt store is in-memory and per-process; back the gate
// with a shared store if you run multiple instances.
const useTrustedKeys = trustedKeys.length > 0
const blockDeleteGate: ReceiptGate = makeReceiptGate({
  action: (blockId: string) => `notion.block.delete:${blockId}`,
  trustedKeys: useTrustedKeys ? trustedKeys : undefined,
  allowInlineKey: !useTrustedKeys,
  maxAgeSec: MAX_AGE_SEC
})

/**
 * Verify + reserve a receipt for deleting THIS block, run the irreversible
 * `fn`, then consume the receipt only AFTER it succeeds (gate.run releases the
 * reservation if `fn` throws, so a transient Notion failure does not burn a
 * valid approval). On success returns `{ ok: true, receiptId, ... }`; on a
 * missing/invalid/replayed/cross-target receipt returns `{ ok: false, status,
 * body }` where `body` is a sanitized Receipt Required challenge (HTTP 428
 * shape, `{ rejected: { reason } }`). `fn` failures propagate by throwing.
 */
export function runBlockDeleteGuarded(
  blockId: string,
  receipt: unknown,
  fn: () => Promise<void>
): Promise<RunResult> {
  return blockDeleteGate.run(receipt, { target: blockId }, fn)
}
