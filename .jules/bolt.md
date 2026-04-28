## 2024-05-18 - Markdown Inline Parser Optimization
**Learning:** Checking character types before invoking complex string matching methods (`tryParseMention`, `tryParseLink`, `tryParseFormatting`) in tight loops significantly improves parsing performance by avoiding unnecessary function calls on regular text characters.
**Action:** When parsing formats character-by-character, always include a fast-path that quickly skips non-trigger characters before executing complex parsing logic.
