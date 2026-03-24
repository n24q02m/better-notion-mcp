# Bolt Performance Learnings

- **fetchChildrenRecursive Parallelization**: It is highly performant to collect all recursive promises in an array and await them concurrently via `Promise.all()` after the loop. This speeds up tree traversal while respecting existing batching limits, as the inner recursive calls naturally employ batching to prevent unbounded promise accumulation.
