## 2026-06-20 - [Optimize string concatenation in property extraction]
**Learning:** Modern JavaScript engines optimize short `+=` string concatenations reasonably well, but for critical hot paths involving potentially large datasets (like paginated properties from Notion), pre-allocating an array and using `.join('')` provides a more consistent, GC-friendly memory profile.
**Action:** Always favor `Array.prototype.join('')` over `+=` loops in high-frequency string extraction paths, and standardize this idiomatic pattern across the codebase.
