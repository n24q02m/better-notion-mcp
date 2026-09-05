## YYYY-MM-DD - [Title]
**Vulnerability:** Overly broad path traversal block in `src/worker.ts` could block legitimate keys.
**Learning:** `key.includes('/..')` is overly broad and rejects valid keys starting with `..` (e.g., `better-notion/..test`). Using a combination of boundary checks (`includes('/../')`, `endsWith('/..')`, `=== '..'`) is necessary to safely reject traversal without false positives.
**Prevention:** Apply specific boundary checks instead of broad substrings when validating paths.
