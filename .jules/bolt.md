## 2023-07-06 - Replacing spread operator pushes with manual loops
**Learning:** In V8 environments (like Bun and Node), appending large arrays using the spread operator (`array.push(...otherArray)`) can cause `RangeError: Maximum call stack size exceeded` errors if the array is exceptionally large. It also incurs performance penalties due to intermediate array allocations.
**Action:** Use manual `for` loops to push elements individually, avoiding `.slice()` or spread operator when dealing with potentially unbounded arrays.
