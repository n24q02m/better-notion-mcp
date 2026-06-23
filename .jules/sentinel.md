## 2025-05-15 - Remove Authentication Bypass Option (MCP_AUTH_DISABLE)
**Vulnerability:** Authentication Bypass / Privilege Escalation.
**Learning:** The `MCP_AUTH_DISABLE=1` option allowed anonymous access to the server, which collapsed all users onto a single 'default' token bucket. This compromised multi-user isolation and allowed any caller to use a pre-configured token without proper authorization.
**Prevention:** Avoid providing "debug" or "bypass" flags in production transport layers that weaken the security model. Enforce strict JWT subject verification to maintain per-user isolation in multi-tenant environments.
