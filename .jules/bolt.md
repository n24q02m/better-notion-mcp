## 2024-06-29 - Precompute array derivations to avoid O(N) penalties
**Learning:** In hot paths (like incoming MCP requests in `registry.ts`), repeatedly mapping over static arrays (`RESOURCES`, `TOOLS`) to generate response objects or lookup arrays causes unnecessary O(N) CPU allocations and GC overhead.
**Action:** Always precompute derivations of static lists at the module level (e.g., using `new Map()` for O(1) lookups or caching `.map()` outputs) rather than computing them on-the-fly per request.

## 2024-06-29 - Cache Regex in Hot Paths
**Learning:** Instantiating new regex literals within functions on hot paths (e.g., `isValidBase64` processing file buffers) incurs a compilation penalty and GC overhead. Caching the regex object at the module level and using `.test()` proved significantly faster (~2.6ms vs 72ms per 10k iterations on large payloads).
**Action:** Always declare static regexes at the module level rather than redefining them inside utility functions, especially for high-frequency operations.
## 2026-06-30 - Precompute Inline Regex to avoid Regex Compilation Penalties
**Learning:** In hot paths, like string matching using `.match()` in `src/tools/helpers/errors.ts`, `src/tools/helpers/markdown.ts`, and `src/tools/helpers/properties.ts`, re-compiling inline regexes can cause CPU allocations and garbage collection overheads.
**Action:** Always precompute these regex as module-level constants (e.g. `SAFE_STRING_REGEX`) rather than recreating them during runtime to improve speed and performance.
