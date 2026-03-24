
## String Concatenation vs Array Push/Join in Bun/V8

When optimizing string building in tight loops (e.g., `richTextToMarkdown`), replacing `+=` concatenation with `Array.push()` and `.join('')` does not universally yield performance improvements in modern JavaScript engines like V8 (used by Node) and JavaScriptCore (used by Bun).

In synthetic micro-benchmarks, `+=` string concatenation can be significantly faster (e.g., 917 ns vs 1.82 µs for N=50 items, or 120 µs vs 214 µs for N=5000 items). This is because modern engines heavily optimize the `+=` operator using "Rope" strings (or cons strings) which defer actual memory allocation until the string is read, avoiding intermediate garbage collection pressure. Array allocation and the final `join()` call add measurable overhead in these micro-benchmarks.

However, replacing `+=` with `push`/`join` remains a common architectural standard in TypeScript/JavaScript to prevent potential $O(n^2)$ complexity in older environments or pathological cases. When implementing this pattern, be transparent about the lack of measurable synthetic speedups on V8/JSC if benchmarks favor `+=`.
