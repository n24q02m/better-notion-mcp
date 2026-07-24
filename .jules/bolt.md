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
## 2024-07-04 - Multiline String Prefixing Performance in V8/Bun
**Learning:** Using regex `.replace(/^/gm, 'prefix')` for multiline string operations (like indenting or adding blockquote markers in markdown rendering) incurs measurable overhead due to RegExp state machine execution. In V8/Bun, using template literals combined with native string search via `.replaceAll('\n', '\nprefix')` (e.g., \`prefix${str.replaceAll('\n', '\nprefix')}\`) is significantly faster.
**Action:** When applying static prefixes to every line of a string on a hot path, prefer string concatenation and `.replaceAll('\n', '\nprefix')` over global regex start-of-line replacements.

## 2024-07-17 - Avoid .map() and intermediate array allocations in Hot Paths
**Learning:** In heavily used loops or rendering pipelines (e.g., parsing markdown tables and columns), using array methods like `.map()` and `.push()` can cause unnecessary garbage collection overhead and closure allocations. Specifically, large `.map()` chains or dynamic `.push()` calls create many intermediate arrays that penalize V8 performance.
**Action:** Replace `.map()` and dynamic `.push()` with manual `for` loops over pre-allocated arrays (e.g., `new Array(length)`) to reduce garbage collection pressure and improve CPU efficiency in highly recursive or hot code paths.

## 2025-07-22 - Optimizing string parsing loops
**Learning:** In string parsing hot loops (like processing markdown tables), redundant character lookups and string allocation can impact performance. `.includes('|')` after `.startsWith('|')` is completely redundant, and `trimStart()` allocates less and scans less than `.trim()`. Caching array lookups (e.g. `lines[i]`) also saves slightly on property access.
**Action:** In high-throughput parsing loops, always cache the current element, ensure string methods (like `startsWith`, `indexOf`) are not checking conditions already satisfied by prior operations, and use more targeted trimming/slicing functions when possible.
