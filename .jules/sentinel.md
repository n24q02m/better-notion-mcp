## 2024-05-18 - Fix Authorization Header Leak
**Vulnerability:** Authorization headers (like `Authorization` and `authorization`) were leaking within the HTTP error payload objects inside `config.headers`, `request._headers` and `headers` objects when `enhanceError` was called on network errors, as these nested properties were not cleaned by the `stripSensitiveFields` logic.
**Learning:** Generic error serialization can unintentionally capture standard HTTP metadata which usually contains tokens or credentials, leading to unintended leakage when errors are output to clients or logs.
**Prevention:** Always perform an explicit redaction of common auth-related header locations inside error response payloads that come from HTTP client instances before relaying error details outside of their execution context.

## 2024-05-18 - Fix Command Injection on Windows via tryOpenBrowser
**Vulnerability:** In `tryOpenBrowser`, using `execFile('cmd', ['/c', 'start', '', url])` to open URLs on Windows was vulnerable to command injection because `cmd.exe` processes shell metacharacters like `&` within its arguments before passing them to the internal `start` command, completely bypassing `execFile`'s usual protections against shell injection.
**Learning:** `child_process.execFile` does not protect against shell injection when the executed binary is itself a shell (like `cmd.exe`). Any arguments passed to it will undergo normal shell parsing rules.
**Prevention:** Avoid spawning shell binaries entirely for generic tasks. To open URLs on Windows securely without invoking `cmd.exe`, use the OS-level file protocol handler directly via `execFile('rundll32', ['url.dll,FileProtocolHandler', url])`.
## 2025-02-27 - Fix Command Injection in OAuth Tests on Windows
**Vulnerability:** In `tests/test-oauth-mcp.mjs`, the `_openBrowser` function was using `execFile('cmd', ['/c', 'start', url])` to open authorization URLs on Windows. This allowed any unsanitized `url` payload containing shell metacharacters (like `&` or `|`) to bypass protections and trigger arbitrary code execution, as `cmd.exe` parses and executes them before running the internal `start` command.
**Learning:** `child_process.execFile` only guarantees safe parameter passing to the binary being invoked. If the binary is a shell (like `cmd.exe`), it applies its own parsing rules to the passed arguments, re-introducing shell injection risks even when using the ostensibly safe `execFile`.
**Prevention:** When programmatic interaction requires opening URLs on Windows without shell intervention, utilize OS-level file protocol handlers directly via `execFile('rundll32', ['url.dll,FileProtocolHandler', url])` to avoid `cmd.exe` parsing entirely.
## 2025-05-22 - [XPIA Breakout via Malicious Payload Tags]
**Vulnerability:** The `wrapToolResult` function used `</untrusted_notion_content>` to encapsulate untrusted data returned from Notion to defend against Indirect Prompt Injection (XPIA). However, an attacker could include `</untrusted_notion_content>` in the malicious data payload itself, which would prematurely close the security wrapper and allow subsequent lines to be interpreted as trusted system instructions by the LLM.
**Learning:** Security wrappers like `<untrusted_content>` tags are vulnerable to premature termination if the encapsulated data is not sanitized or escaped. Attackers can control the returned data (e.g., Notion page content) to craft malicious breakout strings.
**Prevention:** Always sanitize the payload data (e.g., using `String.replace`) to escape or replace any strings that match the wrapper's closing tags (case-insensitively) before encapsulating the data.

## 2025-05-28 - XPIA Breakout via Whitespace Padding
**Vulnerability:** Untrusted content tools were protected against XPIA using a closing tag replacement regex (`/<\/untrusted_notion_content>/gi`). However, this regex was strict and failed to match whitespace-padded payloads (e.g., `</untrusted_notion_content >`), allowing an attacker to bypass the sanitization and execute prompt injection.
**Learning:** XML/HTML parsers (including LLMs parsing pseudo-XML tags) often tolerate whitespace before the closing angle bracket. A strict exact-match regex sanitization is insufficient for tag-based wrappers, as attackers can pad their payload to break out of the wrapper while still satisfying parser leniency.
**Prevention:** Always use regex quantifiers for optional whitespace (e.g., `\s*`) when matching or sanitizing closing tags to handle evasion tactics effectively.

## 2026-05-28 - Improve Security Coverage for isSafeWebUrl
**Vulnerability:** N/A (Testing Task)
**Learning:** The  function provides a stricter validation layer for opening URLs in external browsers compared to , specifically by enforcing standard web protocols (HTTP/HTTPS) and preventing shell flag injection (URLs starting with ).
**Prevention:** Ensure all security-critical utility functions have comprehensive unit test coverage, specifically targeting edge cases like protocol obfuscation, shell injection vectors, and malformed URL handling.

## 2026-05-28 - Improve Security Coverage for isSafeWebUrl
**Vulnerability:** N/A (Testing Task)
**Learning:** The function isSafeWebUrl provides a stricter validation layer for opening URLs in external browsers compared to isSafeUrl, specifically by enforcing standard web protocols (HTTP/HTTPS) and preventing shell flag injection (URLs starting with dash).
**Prevention:** Ensure all security-critical utility functions have comprehensive unit test coverage, specifically targeting edge cases like protocol obfuscation, shell injection vectors, and malformed URL handling.
## 2025-05-28 - XPIA Breakout via Closing Tag Attributes
**Vulnerability:** Untrusted content returned from external APIs was wrapped in `<untrusted_notion_content>` tags. The regex used to sanitize payload breakout attempts (`/<\/untrusted_notion_content\s*>/gi`) only matched trailing whitespace. An attacker could bypass this wrapper by injecting arbitrary attributes into the closing tag within their payload (e.g., `</untrusted_notion_content bypass="true">`), prematurely escaping the security boundary.
**Learning:** Security boundaries relying on XML/HTML-style tags must account for the leniency of the underlying parsers (including LLMs). Exact matches or simple whitespace checks fail when attackers exploit syntax flexibility, such as tag attributes, which are normally invalid in closing tags but tolerated by parsers.
**Prevention:** When sanitizing closing tags for prompt injection defense, use a regex that matches any character except the closing angle bracket (e.g., `[^>]*`) to neutralize all variations, padding, and attributes that could be used for evasion.

## 2026-06-10 - Missing tests for normalizeId
**Vulnerability:** N/A (Testing Task)
**Learning:** `normalizeId` is a stable utility used for ID comparison. Comprehensive testing should verify that it only removes hyphens and does not affect case or other whitespace characters (tabs, newlines), ensuring consistency across the MCP server.
**Prevention:** Always verify that utility functions have tests covering not just the happy path but also the preservation of non-target characters like case and whitespace.
