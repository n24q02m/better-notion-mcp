## $(date +%Y-%m-%d) - Precompute array derivations to avoid O(N) penalties
**Learning:** In hot paths (like incoming MCP requests in `registry.ts`), repeatedly mapping over static arrays (`RESOURCES`, `TOOLS`) to generate response objects or lookup arrays causes unnecessary O(N) CPU allocations and GC overhead.
**Action:** Always precompute derivations of static lists at the module level (e.g., using `new Map()` for O(1) lookups or caching `.map()` outputs) rather than computing them on-the-fly per request.

## 2026-06-29 - Fixed startHttp readiness test and mocked KvNotionTokenStore
**Learning:** Tests can sometimes expect log messages that were removed or never implemented in the production code, leading to false positives or negatives. Mocking all related dependencies (like both types of token stores) ensures that the test environment correctly reflects the code's branching logic.
**Action:** Always verify that test expectations (like log messages) align with the current implementation, and ensure all subclasses or alternative implementations of a dependency are mocked when testing a factory function like `selectTokenStore`.
