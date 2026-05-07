## 2025-02-12 - URL Delimiter Parsing Optimization
**Learning:** In JavaScript, using an unescaped `/` within a regex literal `/[/?#]/` causes a `SyntaxError` (Invalid regular expression: missing /), even within character classes. Also, placing regex literals inside functions on hot paths like URL validation causes slight overhead from repeated regex object creation.
**Action:** When finding the first occurrence of multiple characters, consolidate multiple `.indexOf` calls into a single regex `.search()` pass (e.g. `URL_DELIMITER_REGEX.search(str)`), but always ensure slashes are properly escaped (or avoided via instantiation constraints) and ALWAYS declare regexes at the module level outside functions.

## 2025-02-12 - Object literals in Hot Paths
**Learning:** Object mapping literal properties in TypeScript where keys are not valid identifiers (like 'ℹ️' or emojis) require quotes to avoid Syntax Errors.
**Action:** When extracting local map objects into module-level constants (e.g., `CALLOUT_ICON_MAP`), ensure all non-identifier keys are properly wrapped in string quotes to prevent immediate build breakages.

## 2026-05-07 - Optimized URL parsing in security helpers
**Learning:** Consolidating multiple string search operations (like  or multiple  calls) into a single regex  pass significantly improves performance on hot paths. Using  instead of  for protocol validation provides O(1) lookups.
**Action:** Always prefer single-pass regex validation and Set-based lookups for frequently called utility functions like URL and protocol validators.

## 2026-05-07 - Optimized URL parsing in security helpers
**Learning:** Consolidating multiple string search operations (like `indexOf` or multiple `search` calls) into a single regex `search` pass significantly improves performance on hot paths. Using `Set.has()` instead of `Array.includes()` for protocol validation provides O(1) lookups.
**Action:** Always prefer single-pass regex validation and Set-based lookups for frequently called utility functions like URL and protocol validators.
