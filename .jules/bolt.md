## 2025-02-12 - URL Delimiter Parsing Optimization
**Learning:** In JavaScript, using an unescaped `/` within a regex literal `/[/?#]/` causes a `SyntaxError` (Invalid regular expression: missing /), even within character classes. Also, placing regex literals inside functions on hot paths like URL validation causes slight overhead from repeated regex object creation.
**Action:** When finding the first occurrence of multiple characters, consolidate multiple `.indexOf` calls into a single regex `.search()` pass (e.g. `URL_DELIMITER_REGEX.search(str)`), but always ensure slashes are properly escaped (or avoided via instantiation constraints) and ALWAYS declare regexes at the module level outside functions.

## 2024-05-18 - Extract module-level constants
**Learning:** Recreating static map objects inside frequently called functions (like markdown parsing helpers) causes unnecessary object allocation and garbage collection overhead.
**Action:** Always move static, read-only map objects to module-level constants outside of functions, especially on hot paths like text parsing.
