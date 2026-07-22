## 2025-07-22 - Regex Engine Native Optimizations
**Learning:** In V8 environments, placing JavaScript-level string length guard clauses before heavily optimized regex tests (like UUID validation) can de-optimize the happy path, causing execution to be significantly slower (e.g. from 964ps to 20ns) than relying on the native regex engine alone for valid inputs.
**Action:** Do not attempt to "optimize" simple regular expression validations (like UUID checks) with JS-level guard clauses unless targeting a specific slow path where the input length is highly variable and often invalid.

## 2025-07-22 - Optimizing string parsing loops
**Learning:** In string parsing hot loops (like processing markdown tables), redundant character lookups and string allocation can impact performance. `.includes('|')` after `.startsWith('|')` is completely redundant, and `trimStart()` allocates less and scans less than `.trim()`. Caching array lookups (e.g. `lines[i]`) also saves slightly on property access.
**Action:** In high-throughput parsing loops, always cache the current element, ensure string methods (like `startsWith`, `indexOf`) are not checking conditions already satisfied by prior operations, and use more targeted trimming/slicing functions when possible.
