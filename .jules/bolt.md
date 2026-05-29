## 2025-05-15 - [CLEANUP] Use of any type
**Learning:** Replacing 'any' with 'unknown' or specific interfaces (like 'ErrorLike') improves type safety and forces proper type narrowing when accessing properties.
**Action:** Always prefer 'unknown' over 'any' for external data or error objects, and use type guards or interfaces to safely handle them.
