## 2024-06-29 - Precompute array derivations to avoid O(N) penalties
**Learning:** In hot paths (like incoming MCP requests in `registry.ts`), repeatedly mapping over static arrays (`RESOURCES`, `TOOLS`) to generate response objects or lookup arrays causes unnecessary O(N) CPU allocations and GC overhead.
**Action:** Always precompute derivations of static lists at the module level (e.g., using `new Map()` for O(1) lookups or caching `.map()` outputs) rather than computing them on-the-fly per request.

## 2024-06-29 - Cache Regex in Hot Paths
**Learning:** Instantiating new regex literals within functions on hot paths (e.g., `isValidBase64` processing file buffers) incurs a compilation penalty and GC overhead. Caching the regex object at the module level and using `.test()` proved significantly faster (~2.6ms vs 72ms per 10k iterations on large payloads).
**Action:** Always declare static regexes at the module level rather than redefining them inside utility functions, especially for high-frequency operations.

## 2026-06-30 - Precompute Inline Regex to avoid Regex Compilation Penalties
**Learning:** In hot paths, like string matching using `.match()` in `src/tools/helpers/errors.ts`, `src/tools/helpers/markdown.ts`, and `src/tools/helpers/properties.ts`, re-compiling inline regexes can cause CPU allocations and garbage collection overheads.
**Action:** Always precompute these regex as module-level constants (e.g. `SAFE_STRING_REGEX`) rather than recreating them during runtime to improve speed and performance.

## 2024-07-03 - Array Spread Operator (Spread Syntax) Performance Penalty on V8
**Learning:** Using the spread operator (`...arr`) to push elements into an array (`allResults.push(...results)`) can cause 'Maximum call stack size exceeded' errors when the spread array is very large. In V8 (used by Node and Bun), it also incurs a performance penalty due to intermediate array allocation overhead compared to a manual `for` loop.
**Action:** For performance-critical code or when dealing with potentially large arrays (like paginated API results), use a manual `for` loop to push elements individually instead of using the spread operator.

## 2024-07-04 - Multiline String Prefixing Performance
**Learning:** In V8/Bun environments, applying multiline prefix strings (e.g., indenting markdown blocks with spaces or `> `) is significantly faster using string concatenation and `.replaceAll('\n', '\nprefix')` rather than global regex replacement with a start-of-line anchor (`.replace(/^/gm, 'prefix')`). The regex engine overhead is higher than the optimized string replacement path for this specific use case.
**Action:** When prepending text to all lines of a multiline string, prefer `prefix + str.replaceAll('\n', '\n' + prefix)` over `str.replace(/^/gm, prefix)` for better performance in hot paths.
