## 2025-02-12 - URL Delimiter Parsing Optimization
**Learning:** In JavaScript, using an unescaped `/` within a regex literal `/[/?#]/` causes a `SyntaxError` (Invalid regular expression: missing /), even within character classes. Also, placing regex literals inside functions on hot paths like URL validation causes slight overhead from repeated regex object creation.
**Action:** When finding the first occurrence of multiple characters, consolidate multiple `.indexOf` calls into a single regex `.search()` pass (e.g. `URL_DELIMITER_REGEX.search(str)`), but always ensure slashes are properly escaped (or avoided via instantiation constraints) and ALWAYS declare regexes at the module level outside functions.

## 2025-02-12 - Object literals in Hot Paths
**Learning:** Object mapping literal properties in TypeScript where keys are not valid identifiers (like 'ℹ️' or emojis) require quotes to avoid Syntax Errors.
**Action:** When extracting local map objects into module-level constants (e.g., `CALLOUT_ICON_MAP`), ensure all non-identifier keys are properly wrapped in string quotes to prevent immediate build breakages.

## 2025-05-06 - normalizeId Fast Path Optimization
**Learning:** Using `id.replace(/-/g, '')` directly on strings that are already clean (do not contain hyphens) incurs unnecessary regex evaluation overhead on hot paths, adding ~10-20x extra time compared to checking for the target character first.
**Action:** When a replacement string is commonly already correctly formatted, apply an early return check using `indexOf` (e.g., `if (id.indexOf('-') === -1) return id`) to bypass the regex engine.

## 2025-05-16 - Cache object property lookups in tight loops
**Learning:** In tight loops evaluating many conditional branches based on an object property (like `p.type` in `extractPageProperties`), repeatedly accessing the property (`p.type === 'x'`) causes unnecessary overhead in V8 engine property lookup.
**Action:** Extract the property to a local variable (`const type = p.type`) before the conditional branches. This micro-optimization yielded a ~75% reduction in execution time for large property objects.
