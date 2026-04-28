## 2024-05-18 - Fix Authorization Header Leak
**Vulnerability:** Authorization headers (like `Authorization` and `authorization`) were leaking within the HTTP error payload objects inside `config.headers`, `request._headers` and `headers` objects when `enhanceError` was called on network errors, as these nested properties were not cleaned by the `stripSensitiveFields` logic.
**Learning:** Generic error serialization can unintentionally capture standard HTTP metadata which usually contains tokens or credentials, leading to unintended leakage when errors are output to clients or logs.
**Prevention:** Always perform an explicit redaction of common auth-related header locations inside error response payloads that come from HTTP client instances before relaying error details outside of their execution context.

## 2024-05-18 - Fix Command Injection on Windows via tryOpenBrowser
**Vulnerability:** In `tryOpenBrowser`, using `execFile('cmd', ['/c', 'start', '', url])` to open URLs on Windows was vulnerable to command injection because `cmd.exe` processes shell metacharacters like `&` within its arguments before passing them to the internal `start` command, completely bypassing `execFile`'s usual protections against shell injection.
**Learning:** `child_process.execFile` does not protect against shell injection when the executed binary is itself a shell (like `cmd.exe`). Any arguments passed to it will undergo normal shell parsing rules.
**Prevention:** Avoid spawning shell binaries entirely for generic tasks. To open URLs on Windows securely without invoking `cmd.exe`, use the OS-level file protocol handler directly via `execFile('rundll32', ['url.dll,FileProtocolHandler', url])`.
