"""CF better-notion-mcp live OAuth full-flow self-test harness.

Drives the deployed better-notion-mcp Cloudflare Worker (Worker + Container + KV)
end-to-end against a public endpoint. Unlike wet/imagine (local-form password
grant, fully autonomous), notion uses DELEGATED Notion OAuth: the /authorize
endpoint 302-redirects the user to Notion, who must APPROVE in their workspace.
That approval is a genuine user gate -- this harness drives everything around it
but cannot (and must not) automate the Notion "Allow" click.

Flow (delegated authorization_code + PKCE, public client `local-browser`):
  1. bootstrap  -- gen PKCE, GET /authorize -> capture the Notion authorize URL,
                   persist the code_verifier; print the URL for the user to open.
  2. (user)     -- open the URL, approve in Notion. The browser lands on
                   <endpoint>/callback-done?code=<server_code>&state=... (a
                   terminal "tab can be closed" page). Copy that final URL (or
                   just the code value).
  3. exchange   -- POST /token (code + code_verifier) -> bearer JWT; persist it;
                   then an authenticated MCP round-trip: config(status) asserts
                   has_token=true, users(me) returns the Notion bot user.
  4. recreate-verify -- after `wrangler containers delete <id> && wrangler deploy`,
                   REUSE the persisted JWT (EdDSA key is HKDF-deterministic from
                   CREDENTIAL_SECRET, so the old JWT still verifies after recreate)
                   and call config(status). has_token MUST still be true WITHOUT
                   re-approving Notion -- proof the access token survived in KV
                   (KvNotionTokenStore -> PerPluginStore, D2 KV write-through).

The two-sub isolation gate (plan Task 8.6) needs TWO distinct Notion identities
(two workspaces/accounts), so run `bootstrap`+`exchange` twice with --token-file
pointed at two different files and confirm each sub's users(me) differs.

Examples:
  python scripts/cf_full_flow.py bootstrap
  python scripts/cf_full_flow.py exchange --landing "https://notion.n24q02m.com/callback-done?code=...&state=..."
  python scripts/cf_full_flow.py recreate-verify
  python scripts/cf_full_flow.py bootstrap --token-file .notion_cf_token_b   # 2nd sub
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json as _json
import secrets
import sys
import urllib.parse
from pathlib import Path

# No hardcoded host: set CF_ENDPOINT or pass --endpoint https://<your-worker-domain>.
# This self-tests YOUR deployed CF server; creds come from env (MCP_RELAY_PASSWORD +
# provider keys) -- the maintainer injects them via skret, but any export works.
DEFAULT_ENDPOINT = os.environ.get("CF_ENDPOINT", "")
CLIENT_ID = "local-browser"


def _pkce_path(token_file: str) -> Path:
    return Path(__file__).with_name(f"{token_file}.pkce")


def _token_path(token_file: str) -> Path:
    return Path(__file__).with_name(token_file)


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _sub_of(token: str) -> str:
    payload = _json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
    return payload.get("sub", "?")


def bootstrap(endpoint: str, token_file: str) -> None:
    import httpx  # lazy so --help works without deps

    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    state = _b64url(secrets.token_bytes(16))
    redirect_uri = f"{endpoint}/callback-done"

    with httpx.Client(timeout=60, follow_redirects=False) as c:
        r = c.get(
            f"{endpoint}/authorize",
            params={
                "client_id": CLIENT_ID,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "state": state,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            },
        )
    if r.status_code != 302:
        raise SystemExit(
            f"bootstrap: expected 302 from /authorize, got {r.status_code}: {r.text[:300]}"
        )
    notion_url = r.headers.get("location", "")
    if "api.notion.com" not in notion_url:
        raise SystemExit(
            f"bootstrap: /authorize did not redirect to Notion, got: {notion_url[:300]}"
        )

    _pkce_path(token_file).write_text(
        _json.dumps(
            {"verifier": verifier, "state": state, "redirect_uri": redirect_uri}
        )
    )
    print("=" * 70)
    print("OPEN THIS URL AND APPROVE IN NOTION:")
    print(notion_url)
    print("=" * 70)
    print("After approving you land on a 'tab can be closed' page. Copy that full")
    print("URL (it contains ?code=...) and run:")
    print(f'  python scripts/cf_full_flow.py exchange --landing "<that URL>"')
    print(f"(PKCE verifier saved to {_pkce_path(token_file).name})")


def _extract_code(landing: str) -> str:
    if "code=" not in landing:
        # allow pasting the bare code too
        return landing.strip()
    q = urllib.parse.urlparse(landing).query or landing.split("?", 1)[-1]
    code = urllib.parse.parse_qs(q).get("code", [""])[0]
    if not code:
        raise SystemExit(f"could not extract ?code= from: {landing[:200]}")
    return code


def exchange(endpoint: str, token_file: str, landing: str) -> None:
    import httpx

    pkce = _json.loads(_pkce_path(token_file).read_text())
    code = _extract_code(landing)
    with httpx.Client(timeout=60, follow_redirects=False) as c:
        tok = c.post(
            f"{endpoint}/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": pkce["verifier"],
                "redirect_uri": pkce["redirect_uri"],
                "client_id": CLIENT_ID,
            },
        )
    if tok.status_code != 200:
        raise SystemExit(f"exchange: /token {tok.status_code}: {tok.text[:300]}")
    jwt = tok.json()["access_token"]
    _token_path(token_file).write_text(jwt)
    print(f"TOKEN OK len={len(jwt)} sub={_sub_of(jwt)} (saved to {token_file})")
    _run_session(endpoint, jwt, expect_has_token=True, probe_me=True)
    print("EXCHANGE + AUTHENTICATED ROUND-TRIP PASS.")


def recreate_verify(endpoint: str, token_file: str) -> None:
    jwt = _token_path(token_file).read_text().strip()
    print(f"Reusing JWT sub={_sub_of(jwt)} (no re-auth) after container recreate...")
    _run_session(endpoint, jwt, expect_has_token=True, probe_me=True)
    print(
        "RECREATE-VERIFY PASS: JWT identity + Notion token survived recreate via KV (no re-auth)."
    )


def _run_session(
    endpoint: str, jwt: str, *, expect_has_token: bool, probe_me: bool
) -> None:
    import anyio

    async def _go() -> None:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        async with (
            streamablehttp_client(
                f"{endpoint}/mcp", headers={"Authorization": f"Bearer {jwt}"}
            ) as (r, w, _),
            ClientSession(r, w) as s,
        ):
            await s.initialize()
            tools = await s.list_tools()
            print("TOOLS:", [t.name for t in tools.tools])
            st = await s.call_tool("config", {"action": "status"})
            st_txt = "".join(getattr(b, "text", "") for b in st.content)
            print("CONFIG_STATUS:", st_txt[:300].replace("\n", " "))
            if expect_has_token:
                assert '"has_token": true' in st_txt or '"has_token":true' in st_txt, (
                    f"has_token is NOT true -- token did not survive / not saved: {st_txt[:300]}"
                )
                print("ASSERT OK: has_token=true.")
            if probe_me:
                me = await s.call_tool("users", {"action": "me"})
                me_txt = "".join(getattr(b, "text", "") for b in me.content)
                print("USERS_ME:", me_txt[:300].replace("\n", " "))
                assert "error" not in me_txt.lower() or "bot" in me_txt.lower(), (
                    f"users(me) failed -- Notion token not usable: {me_txt[:300]}"
                )

    anyio.run(_go)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="CF better-notion-mcp live OAuth full-flow harness"
    )
    ap.add_argument("mode", choices=["bootstrap", "exchange", "recreate-verify"])
    ap.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    ap.add_argument(
        "--landing",
        default="",
        help="the /callback-done URL (or bare code) for `exchange`",
    )
    ap.add_argument(
        "--token-file",
        default=".notion_cf_token",
        help="per-sub token state file (use 2 for isolation)",
    )
    a = ap.parse_args()

    if a.mode == "bootstrap":
        bootstrap(a.endpoint, a.token_file)
    elif a.mode == "exchange":
        if not a.landing:
            sys.exit("exchange requires --landing '<callback-done URL or code>'")
        exchange(a.endpoint, a.token_file, a.landing)
    else:
        recreate_verify(a.endpoint, a.token_file)


if __name__ == "__main__":
    main()
