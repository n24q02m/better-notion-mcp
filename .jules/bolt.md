## 2025-02-12 - URL Delimiter Parsing Optimization
**Learning:** In JavaScript, using an unescaped `/` within a regex literal `/[/?#]/` causes a `SyntaxError` (Invalid regular expression: missing /), even within character classes. Also, placing regex literals inside functions on hot paths like URL validation causes slight overhead from repeated regex object creation.
**Action:** When finding the first occurrence of multiple characters, consolidate multiple `.indexOf` calls into a single regex `.search()` pass (e.g. `URL_DELIMITER_REGEX.search(str)`), but always ensure slashes are properly escaped (or avoided via instantiation constraints) and ALWAYS declare regexes at the module level outside functions.

## 2025-02-12 - Extract Static Objects from Hot Paths
**Learning:** In `src/tools/helpers/markdown.ts`, dictionary maps for callout icons, colors, and types were being re-created on every single function invocation. On hot paths like markdown parsing, recreating static objects repeatedly causes unnecessary memory allocation and garbage collection overhead.
**Action:** Always extract static, read-only objects (like dictionaries, sets, or configurations) into module-level constants outside of functions, especially those called frequently within loops or parsers.
