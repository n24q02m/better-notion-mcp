## 2025-02-12 - URL Delimiter Parsing Optimization
**Learning:** In JavaScript, using an unescaped `/` within a regex literal `/[/?#]/` causes a `SyntaxError` (Invalid regular expression: missing /), even within character classes. Also, placing regex literals inside functions on hot paths like URL validation causes slight overhead from repeated regex object creation.
**Action:** When finding the first occurrence of multiple characters, consolidate multiple `.indexOf` calls into a single regex `.search()` pass (e.g. `URL_DELIMITER_REGEX.search(str)`), but always ensure slashes are properly escaped (or avoided via instantiation constraints) and ALWAYS declare regexes at the module level outside functions.

## 2025-02-12 - Object literals in Hot Paths
**Learning:** Object mapping literal properties in TypeScript where keys are not valid identifiers (like 'ℹ️' or emojis) require quotes to avoid Syntax Errors.
**Action:** When extracting local map objects into module-level constants (e.g., `CALLOUT_ICON_MAP`), ensure all non-identifier keys are properly wrapped in string quotes to prevent immediate build breakages.

## 2025-05-19 - N+1 Query Optimization in Recursive Trees
**Learning:** In the absence of bulk retrieval endpoints (like in Notion's Block Children API), depth-first recursion for tree population creates a serial N+1 query bottleneck. Breadth-first parallelization combined with a shared concurrency queue and per-session caching significantly improves performance.
**Action:** When populating hierarchical data (like blocks or folders), group API calls by depth level and execute them in parallel using `Promise.allSettled`. Implement a session-scoped `Map` cache to avoid redundant requests during complex processing sessions while preventing multi-tenant data leaks.
