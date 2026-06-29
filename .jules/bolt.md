## $(date +%Y-%m-%d) - Precompute array derivations to avoid O(N) penalties
**Learning:** In hot paths (like incoming MCP requests in `registry.ts`), repeatedly mapping over static arrays (`RESOURCES`, `TOOLS`) to generate response objects or lookup arrays causes unnecessary O(N) CPU allocations and GC overhead.
**Action:** Always precompute derivations of static lists at the module level (e.g., using `new Map()` for O(1) lookups or caching `.map()` outputs) rather than computing them on-the-fly per request.

## 2026-06-29 - Prefer non-mutating object creation over 'delete' in loops
**Learning:** Using 'delete' in a loop to remove properties from an object can be inefficient because it modifies the object's shape (hidden class/structure) repeatedly, which can disable JIT optimizations in engines like V8.
**Action:** Use 'Object.fromEntries(Object.entries(obj).filter(...))' or similar patterns to create a new object with the desired properties in a single step, preserving performance and keeping code cleaner.
