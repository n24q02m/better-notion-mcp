## 2025-02-12 - URL Delimiter Parsing Optimization
**Learning:** In JavaScript, using an unescaped `/` within a regex literal `/[/?#]/` causes a `SyntaxError` (Invalid regular expression: missing /), even within character classes. Also, placing regex literals inside functions on hot paths like URL validation causes slight overhead from repeated regex object creation.
**Action:** When finding the first occurrence of multiple characters, consolidate multiple `.indexOf` calls into a single regex `.search()` pass (e.g. `URL_DELIMITER_REGEX.search(str)`), but always ensure slashes are properly escaped (or avoided via instantiation constraints) and ALWAYS declare regexes at the module level outside functions.

## 2025-02-12 - Object literals in Hot Paths
**Learning:** Object mapping literal properties in TypeScript where keys are not valid identifiers (like 'ℹ️' or emojis) require quotes to avoid Syntax Errors.
**Action:** When extracting local map objects into module-level constants (e.g., `CALLOUT_ICON_MAP`), ensure all non-identifier keys are properly wrapped in string quotes to prevent immediate build breakages.

## 2025-05-06 - normalizeId Fast Path Optimization
**Learning:** Using `id.replace(/-/g, '')` directly on strings that are already clean (do not contain hyphens) incurs unnecessary regex evaluation overhead on hot paths, adding ~10-20x extra time compared to checking for the target character first.
**Action:** When a replacement string is commonly already correctly formatted, apply an early return check using `indexOf` (e.g., `if (id.indexOf('-') === -1) return id`) to bypass the regex engine.

## 2025-05-18 - Object Iteration in Hot Paths
**Learning:** Using `Object.entries(obj)` creates transient array tuples `[key, value]` for every property in an object. On hot paths like processing Notion schemas (which can be large and heterogeneous), this causes significant garbage collection overhead and is 2-3x slower than using `Object.keys(obj)` combined with indexed loops. Additionally, using array `.map()` and `.includes()` inside these loops adds further overhead compared to standard for-loops and boolean logic.
**Action:** Replace `Object.entries()` with `Object.keys()` and an indexed loop (e.g. `const name = keys[i]; const p = properties[name]`) in high-frequency data formatting loops.
## 2025-05-24 - URL Validation Fast Path Optimization
**Learning:** Using `includes()` checks on arrays or sequential `indexOf` / `substring` operations for prefix checking in tight loops (like URL validation) causes noticeable performance hits.
**Action:** Replace `includes` checks on static arrays with `Set.has` for O(1) lookups. Additionally, when searching for multiple characters in a string simultaneously, consolidate into a single `.exec()` regex pass rather than multiple string operations, which avoids unnecessary allocations and function calls.

## 2025-05-26 - Array.includes() vs Set.has() for O(1) Lookups
**Learning:** Checking for membership in an array using `['a', 'b', ...].includes(value)` within hot paths requires an O(N) scan. This can become an issue when iterating or repeatedly checking values.
**Action:** Replace `Array.includes()` with `Set.has()` by extracting the array into a module-level `Set`. This improves lookup times significantly to O(1).
## 2026-05-28 - Caching Notion API Retrieve Calls in Blocks Tool
**Learning:** Repeated Notion API calls for the same resource within a short timeframe significantly impact performance. Implementing a simple in-memory Map cache with TTL (Time-To-Live) and ensuring the cache is updated/invalidated on mutations (update/delete) provides a substantial performance boost without complexity.
**Action:** Always check for repeated 'retrieve' or 'get' calls in high-traffic or composite tools and consider implementing a localized cache with proper lifecycle management.
