## 2025-01-20 - Optimize Markdown Indentation Prefixing
**Learning:** In V8/Bun environments, replacing `/^/gm` with `.replaceAll` inside template literals when prepending prefixes significantly improves execution speed by avoiding regex evaluation overhead, which is surprisingly slow for this specific multiline replacement task.
**Action:** Use `.replaceAll("\n", "\n[prefix]")` with template literals instead of `.replace(/^/gm, "prefix")` for multiline prefix insertions (e.g. indentation, blockquotes) in hot paths.
