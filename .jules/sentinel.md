## 2024-05-22 - Information Leakage in Error Objects
**Vulnerability:** `NotionMCPError` was including raw error objects in its `details` property, which were then exposed to the client. This leaked sensitive information like Authorization headers from Axios errors.
**Learning:** Generic error handling that blindly wraps unknown errors is a common source of leaks. Always sanitize or whitelist properties when enhancing errors for client consumption.
**Prevention:** Use a `sanitizeErrorDetails` helper that whitelists safe properties (message, code, status) and strips everything else before attaching to custom error objects.
