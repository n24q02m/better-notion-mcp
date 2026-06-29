## $(date +%Y-%m-%d) - Precompute array derivations to avoid O(N) penalties
**Learning:** In hot paths (like incoming MCP requests in `registry.ts`), repeatedly mapping over static arrays (`RESOURCES`, `TOOLS`) to generate response objects or lookup arrays causes unnecessary O(N) CPU allocations and GC overhead.
**Action:** Always precompute derivations of static lists at the module level (e.g., using `new Map()` for O(1) lookups or caching `.map()` outputs) rather than computing them on-the-fly per request.
## 2026-06-29 - Using Array.includes inside string search loops
**Learning:** Checking for character existence using `includes` or `trim` inside a loop that already checks for startsWith/endsWith can be redundant and inefficient due to multiple string scans or allocations.
**Action:** Remove redundant string scans and use `trimStart()` instead of `trim()` when only the leading characters matter, and cache array/object lookups in variables within tight loops.
