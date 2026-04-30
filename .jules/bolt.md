## 2024-05-18 - Markdown Inline Parser Optimization
**Learning:** Checking character types before invoking complex string matching methods (`tryParseMention`, `tryParseLink`, `tryParseFormatting`) in tight loops significantly improves parsing performance by avoiding unnecessary function calls on regular text characters.
**Action:** When parsing formats character-by-character, always include a fast-path that quickly skips non-trigger characters before executing complex parsing logic.

## 2024-04-30 - URL Validation Delimiter Search Optimization
**Learning:** Checking for URL delimiters in `isSafeUrl` using multiple `indexOf` calls followed by array filtering and destructuring is less efficient than a single regex `.search(/[/?#]/)` call. Replacing the `indexOf` cascade with regex avoids multiple string traversals and array allocations.
**Action:** Always prefer regex searches or simple loops when trying to find the first occurrence of multiple possible delimiter characters in strings.
