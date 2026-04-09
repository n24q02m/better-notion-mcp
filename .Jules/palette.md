## 2024-04-08 - Improve Notion Token UX
**Learning:** Adding validation to the token input field provides immediate feedback, preventing users from submitting invalid Notion tokens during setup. This is a crucial UX improvement because it stops user error early. The regex ensures the token starts with `ntn_` or `secret_`.
**Action:** When working with API token inputs, always consider adding format validation using regex directly in the schema to give users real-time feedback.
