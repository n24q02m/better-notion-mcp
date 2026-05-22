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
