# Bolt's Journal

## 2025-02-23 - Avoid Array+join string accumulation optimization
**Learning:** A PR to replace `+=` string concatenation with Array `push()` + `join('')` was rejected. Reason: V8's rope-string optimization makes `+=` vs Array+join indistinguishable at typical payload sizes. Also, the codebase explicitly uses `+=` for efficiency in functions like `extractPlainText`, and adding conflicting optimizations creates contradictory patterns. Furthermore, comments shouldn't contain emoji (like ⚡) per project guidelines.
**Action:** Do not attempt to replace `+=` string concatenation with Array+join for performance. Always check adjacent functions in the file for established performance patterns before introducing new ones. Avoid emojis in code comments.
