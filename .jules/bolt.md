## 2025-02-23 - Optimize string matching in markdown table parsing
**Learning:** In V8/Bun environments, repeatedly calling `includes()` inside a loop over text lines (e.g., in a markdown parser) creates unnecessary O(n) overhead when a subsequent `startsWith()` already provides the same guarantee of character presence in O(1). Additionally, chaining `.trim()` allocates a new string without trailing whitespace, which is useless for a `startsWith()` check—using `.trimStart()` avoids this overhead while correctly stripping leading whitespace.
**Action:** When performing `startsWith` checks on strings that may have leading whitespace, use `trimStart().startsWith()` rather than `trim().startsWith()`. Remove redundant `includes` checks that are logically subsumed by the `startsWith` requirement.
## Rejected
## 2026-07-21 - Optimize markdown table parsing
**Learning:** Performance optimizations must include measured numbers or identify a specific hot path to be accepted. Theoretical micro-optimizations (like `.trimStart()` vs `.trim()`) without metrics will be rejected as churn.
**Action:** Do not propose micro-optimizations without clear, measured performance metrics.

## 2026-07-21 - Do not write bot narration into source code
**Learning:** Bot attribution markers (e.g., `// ⚡ Bolt: ...`) must not be written into shipped source code comments.
**Action:** Never include bot narration or attribution in source code comments.

## 2026-07-21 - Append-only memory ledger
**Learning:** The `.jules/bolt.md` ledger is append-only memory. Deleting prior entries causes past mistakes/rejected proposals to recur.
**Action:** Ensure changes to `.jules/bolt.md` are strictly appended; never delete or overwrite existing content.
