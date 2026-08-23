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

## Rejected

Proposals that were reviewed and declined. A closing comment lives on the PR, where it cannot be read again; this section is the part that carries forward. Before proposing an optimization, check that it is not listed here.

**Bar for a performance change in this repo:** a measured number on a realistic payload, or a named hot path. "Expected impact", a complexity argument, or "tests pass" is not a measurement.

- **`+=` instead of a pre-allocated array + `join('')` in `properties.ts` title/rich_text extraction** (PR #1152). Rejected: it reverses `2abf195 (#991)`, which introduced the pre-allocated array on those same lines under the `2024-07-17` entry above. Both directions were argued as faster and neither was measured. Do not flip these lines again without a benchmark that survives noise.
- **Dropping the redundant `.includes('|')` and using `.trimStart()` in `markdown.ts` table parsing** (PRs #1142, #1143, #1144 — one cluster, three PRs). The redundancy is real and the rewrite is behaviour-preserving, but `parseTable` runs once per table during page conversion and the removed check scans a single line. Unmeasured, so closed. `#1142` is the cleanest diff if this is ever revisited.
- **Writing `// ⚡ Bolt: ...` narration into source files** (PR #1143, `markdown.ts:193`). This is a public repository; attribution markers of that form do not belong in shipped code. Keep the rationale in this ledger and in the commit message.
- **Deleting existing entries from this file** (PR #1143 removed 22 lines). This ledger is append-only memory. Removing entries is how settled proposals return.

## 2026-08-23 - In-place Array Truncation and Early Pagination Exit
**Learning:** In V8/Bun environments, using `.slice(0, limit)` to truncate large arrays (like paginated API results) creates unnecessary garbage collection overhead due to intermediate array allocations. Furthermore, slicing after fetching all results causes excessive network I/O.
**Action:** Use in-place array truncation (`arr.length = limit`) instead of `.slice()`. When paginating API requests, use `autoPaginate`'s built-in `limit` option to exit the pagination loop early and pass the dynamically calculated `pageSize` directly to the API network call to avoid fetching excess data.
