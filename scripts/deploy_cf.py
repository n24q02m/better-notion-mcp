#!/usr/bin/env python3
"""Build + push + deploy this MCP server's Cloudflare Worker+Container.

Turns the manual CF redeploy recipe into one repeatable command. Reads the
gitignored ``wrangler.deploy.jsonc`` (real account/KV/D1/Vectorize IDs) for the
container image name + account, builds the ``http`` target, pushes to the CF
managed registry, deploys, waits for the container rollout to finish
(STATE=ready) so you never verify against a half-rolled old image, then runs a
**credential-free canary gate** and **auto-rolls-back** if it fails.

Run from the repo root, with the CF dev token injected by skret:

    MSYS_NO_PATHCONV=1 skret run -e dev --path=/n24q02m/dev -- \\
        python scripts/deploy_cf.py            # tag defaults to b-<short-sha>
    ... python scripts/deploy_cf.py --tag b10-abc1234   # explicit tag
    ... python scripts/deploy_cf.py --skip-build         # reuse a built image
    ... python scripts/deploy_cf.py --dry-run            # print the plan only
    ... python scripts/deploy_cf.py --no-canary          # skip the post-deploy gate

Requires: CLOUDFLARE_API_TOKEN in env (skret /n24q02m/dev CF_DEV_TOKEN ->
export CLOUDFLARE_API_TOKEN), docker, and ``bunx wrangler``. The CF container
registry only pulls from registry.cloudflare.com/<account>/... (not ghcr), so the
local image is tagged to that path before ``wrangler containers push``.

Why the rollout wait: a heavy image (wet ~6GB) keeps serving OLD Durable Object
instances for minutes after deploy (``containers list`` STATE=provisioning);
verifying during that window shows stale behaviour. See docs/cf-deploy.md.

Why the canary gate: the unit / T0 suite cannot reach the CF-glue layer
(worker.ts CONTAINER_ENV_KEYS forwarding, container HOST bind, JWT signing keys),
which is exactly where the painful deploy regressions live. The gate is
credential-free (no per-server secrets needed) and catches the three that have
actually happened: (A) ``MCP_RELAY_PASSWORD`` dropped from the forward list ->
``/authorize`` serves the form with no login front door = open self-service relay;
(B) the bearer gate dropped -> ``/mcp`` no longer 401s; (C) ephemeral per-instance
JWT keys -> ``/.well-known/jwks.json`` ``kid`` changes between requests (the
/token-signs-with-A, /mcp-verifies-with-B -> 401 bug). On failure the previously
deployed image tag is redeployed automatically. A full authenticated
protocol round-trip (self-auth + setup + tool calls) stays in
``scripts/cf_full_flow.py``, which needs the per-server runtime secrets.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEPLOY_CONFIG = "wrangler.deploy.jsonc"


def _strip_jsonc(text: str) -> str:
    """Strip full-line // comments + trailing commas so json.loads accepts our
    deploy.jsonc. Inline // after values is intentionally NOT stripped (would
    corrupt https:// URLs); our deploy.jsonc keeps comments on their own lines."""
    lines = [ln for ln in text.splitlines() if not re.match(r"\s*//", ln)]
    body = "\n".join(lines)
    body = re.sub(r",(\s*[}\]])", r"\1", body)  # trailing commas
    return body


def _load_deploy_config(repo: Path) -> dict:
    path = repo / DEPLOY_CONFIG
    if not path.exists():
        sys.exit(
            f"{DEPLOY_CONFIG} not found in {repo}. It is gitignored (real IDs); "
            "reconstruct it from the committed wrangler.jsonc + CF resource IDs first."
        )
    return json.loads(_strip_jsonc(path.read_text(encoding="utf-8")))


def _short_sha(repo: Path) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--short", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def _run(cmd: list[str], *, dry: bool, cwd: Path | None = None) -> None:
    print(f"  $ {' '.join(cmd)}")
    if dry:
        return
    subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)


def _image_parts(cfg: dict) -> tuple[str, str, str]:
    """Return (registry_base_without_tag, account_id, image_name) from the
    deploy config's first container image ref
    registry.cloudflare.com/<account>/<name>:<tag>."""
    ref = cfg["containers"][0]["image"]
    base = ref.rsplit(":", 1)[0]  # drop existing tag
    m = re.match(r"registry\.cloudflare\.com/([0-9a-f]+)/(.+)$", base)
    if not m:
        sys.exit(
            f"unexpected image ref (need registry.cloudflare.com/<acct>/<name>): {ref}"
        )
    return base, m.group(1), m.group(2)


def _public_url(cfg: dict) -> str:
    url = str((cfg.get("vars") or {}).get("PUBLIC_URL", "")).rstrip("/")
    if not url:
        sys.exit(
            "PUBLIC_URL missing from deploy config vars; cannot run the canary "
            "gate. Add it or pass --no-canary."
        )
    return url


def _set_image_tag(repo: Path, full_ref: str) -> None:
    """Rewrite the deploy.jsonc image line in place so `wrangler deploy` ships the
    tag we just pushed (gitignored file, safe to edit)."""
    path = repo / DEPLOY_CONFIG
    text = path.read_text(encoding="utf-8")
    new = re.sub(
        r'("image":\s*")registry\.cloudflare\.com/[^"]+(")',
        rf"\g<1>{full_ref}\g<2>",
        text,
        count=1,
    )
    path.write_text(new, encoding="utf-8")


def _wait_ready(worker: str, *, dry: bool, timeout_s: int = 600) -> None:
    """Poll `wrangler containers list` until the worker leaves provisioning."""
    if dry:
        print(f"  (dry-run) would poll containers list until {worker} STATE=ready")
        return
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        out = subprocess.run(
            ["bunx", "wrangler", "containers", "list"],
            capture_output=True,
            text=True,
        ).stdout
        line = next((ln for ln in out.splitlines() if worker in ln), "")
        print(f"  [rollout] {line.strip() or '(no row yet)'}")
        if line and "provisioning" not in line.lower():
            print(f"  rollout complete: {worker} is no longer provisioning.")
            return
        time.sleep(25)
    print(f"  WARNING: {worker} still provisioning after {timeout_s}s — verify later.")


# --------------------------------------------------------------------------- #
# Canary gate (credential-free) + auto-rollback                               #
# --------------------------------------------------------------------------- #


def _get(url: str, *, timeout: int = 12) -> tuple[int, dict[str, str], str]:
    """GET following redirects. Return (status, lowercased-headers, final_url)."""
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "cf-canary"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            hdrs = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, hdrs, resp.geturl()
    except urllib.error.HTTPError as e:  # 4xx/5xx still carry headers we need
        hdrs = {k.lower(): v for k, v in (e.headers or {}).items()}
        return e.code, hdrs, e.url or url
    except (urllib.error.URLError, TimeoutError, OSError):
        # unreachable / TLS / timeout: status 0 makes every gate fail, which is
        # the correct canary verdict (a deploy that is not reachable must roll back)
        return 0, {}, url


def _gate_a(public_url: str) -> bool:
    """/authorize must land on /login = the shared relay-password front door is on."""
    authz = (
        f"{public_url}/authorize?response_type=code&client_id=local-browser"
        f"&redirect_uri={public_url}/callback-done&state=x"
        f"&code_challenge=x&code_challenge_method=S256&scope=offline_access"
    )
    _, _, final = _get(authz)
    ok = "/login" in final
    detail = (
        "OK" if ok else "FAIL: no /login -> OPEN SELF-SERVICE RELAY (Gate A dropped)"
    )
    print(f"  [canary] Gate A  /authorize -> {final}  {detail}")
    return ok


def _gate_b(public_url: str) -> bool:
    """/mcp must 401 with a WWW-Authenticate: Bearer challenge."""
    status, hdrs, _ = _get(f"{public_url}/mcp")
    ok = status == 401 and "bearer" in hdrs.get("www-authenticate", "").lower()
    detail = "OK" if ok else f"FAIL (status={status}, bearer challenge missing)"
    print(f"  [canary] Gate B  /mcp -> {status}  {detail}")
    return ok


def _jwks_kid(public_url: str) -> str | None:
    try:
        status, _, _ = _get(f"{public_url}/.well-known/jwks.json")
        if status != 200:
            return None
        with urllib.request.urlopen(
            f"{public_url}/.well-known/jwks.json", timeout=12
        ) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        keys = data.get("keys") or []
        return keys[0].get("kid") if keys else None
    except Exception:
        return None


def _gate_kid_stable(public_url: str) -> bool:
    """jwks kid must be identical across requests; a varying kid means ephemeral
    per-instance signing keys (/token signs with A, /mcp verifies with B -> 401)."""
    kids = {_jwks_kid(public_url) for _ in range(3)}
    ok = len(kids) == 1 and None not in kids
    detail = "OK" if ok else "FAIL: kid varies/absent -> ephemeral per-instance keys"
    print(f"  [canary] JWKS    kid -> {kids}  {detail}")
    return ok


def _canary(public_url: str, *, dry: bool) -> bool:
    if dry:
        print(
            "  (dry-run) would run canary: Gate A /authorize->/login, "
            "Gate B /mcp 401, JWKS kid-stable"
        )
        return True
    print(f"Canary gate against {public_url} (credential-free):")
    results = [
        _gate_a(public_url),
        _gate_b(public_url),
        _gate_kid_stable(public_url),
    ]
    return all(results)


def _rollback(repo: Path, worker: str, prev_ref: str, *, dry: bool) -> None:
    print(f"  CANARY FAILED -> rolling back to previous image {prev_ref}")
    if dry:
        return
    _set_image_tag(repo, prev_ref)
    _run(
        ["bunx", "wrangler", "deploy", "--config", DEPLOY_CONFIG],
        dry=False,
        cwd=repo,
    )
    _wait_ready(worker, dry=False)
    print(f"  rolled back {worker} to {prev_ref}.")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Deploy this MCP server's CF Worker+Container."
    )
    p.add_argument("--tag", default="", help="image tag (default: b-<short-sha>)")
    p.add_argument(
        "--skip-build", action="store_true", help="reuse an already-built local image"
    )
    p.add_argument("--dry-run", action="store_true", help="print the plan, run nothing")
    p.add_argument(
        "--no-canary",
        action="store_true",
        help="skip the post-deploy canary gate (and its auto-rollback)",
    )
    args = p.parse_args(argv)

    repo = Path(__file__).resolve().parent.parent
    cfg = _load_deploy_config(repo)
    worker = cfg["name"]
    base, _account, name = _image_parts(cfg)
    prev_ref = cfg["containers"][0]["image"]  # currently-deployed tag, for rollback
    tag = args.tag or f"b-{_short_sha(repo)}"
    local = f"{name}:{tag}"
    full = f"{base}:{tag}"

    print(f"Deploy {worker}: image {local} -> {full}")
    if not args.skip_build:
        print("[1/4] docker build --target http")
        _run(
            ["docker", "build", "--target", "http", "-t", local, "."],
            dry=args.dry_run,
            cwd=repo,
        )
    print("[2/4] docker tag -> CF registry")
    _run(["docker", "tag", local, full], dry=args.dry_run)
    print("[3/4] wrangler containers push")
    _run(["bunx", "wrangler", "containers", "push", full], dry=args.dry_run, cwd=repo)
    print(f"[4/4] wrangler deploy --config {DEPLOY_CONFIG}")
    if not args.dry_run:
        _set_image_tag(repo, full)
    _run(
        ["bunx", "wrangler", "deploy", "--config", DEPLOY_CONFIG],
        dry=args.dry_run,
        cwd=repo,
    )

    print("Waiting for container rollout (avoid verifying a half-rolled old image)...")
    _wait_ready(worker, dry=args.dry_run)

    if args.no_canary:
        print(
            f"DONE (--no-canary): {worker} deployed at tag {tag}. "
            "Verify manually with scripts/cf_full_flow.py."
        )
        return 0

    if _canary(_public_url(cfg), dry=args.dry_run):
        print(
            f"DONE: {worker} deployed at tag {tag}, canary PASS. "
            "Run scripts/cf_full_flow.py for the authenticated tool round-trip."
        )
        return 0

    if prev_ref == full:
        print(
            "  CANARY FAILED but the previous image ref equals the just-deployed "
            "ref; not auto-rolling-back. Investigate manually."
        )
        return 1
    _rollback(repo, worker, prev_ref, dry=args.dry_run)
    print(f"FAILED: {worker} canary did not pass; rolled back to {prev_ref}.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
