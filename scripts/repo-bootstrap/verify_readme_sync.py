#!/usr/bin/env python3
"""Per-language package registry README field check (Spec A enforcement).

Detects language(s) from manifest presence and asserts:
- Python (pyproject.toml): [project] readme names the README on disk
- TS (package.json): repository field = github.com/n24q02m/<repo>.git
- Go (Dockerfile): LABEL org.opencontainers.image.source=...
- Rust (Cargo.toml): [package] readme = "README.md"
- Universal: exactly one README (.md or .rst) exists, with a non-empty tagline
- MCP server (server.json): description matches README tagline

Markdown is the house default, but reStructuredText is a first-class README on
PyPI and some repos are rst end to end. So the Python check asserts agreement
with the file that is actually there rather than a hardcoded name -- the failure
worth catching is a manifest pointing at a file that does not exist, which
renders an empty registry page while the repo itself looks fine. Rust stays
pinned to Markdown on purpose: crates.io renders Markdown only, so an rst readme
there would publish as unformatted text.

Run from any repo's working directory:
    python verify_readme_sync.py [--repo-root=.]

Returns exit 0 if all checks pass, 1 if any FAIL, 2 if no manifest detected.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import tomllib
from pathlib import Path

if __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from _lib import (  # type: ignore[import-not-found]
    CheckResult,
    extract_readme_tagline,
    has_failure,
    normalize_for_match,
    render_results,
)

# ---------------------------------------------------------------------------
# Which file is this repo's README
# ---------------------------------------------------------------------------

KNOWN_READMES = ("README.md", "README.rst")


def find_readmes(repo_root: Path) -> list[Path]:
    """Every recognised README present at the repo root, in preference order."""
    return [p for name in KNOWN_READMES if (p := repo_root / name).exists()]


def resolve_readme(repo_root: Path) -> Path | None:
    """This repo's README, or None if it has none.

    With more than one present this returns the preferred name so the tagline
    checks still have something to read; the ambiguity itself is reported by
    check_readme_exists rather than by every check downstream of it.
    """
    found = find_readmes(repo_root)
    return found[0] if found else None


def _readme_field_verdict(repo_root: Path, declared: object) -> tuple[bool, str]:
    """Whether a manifest's readme field agrees with the file on disk."""
    on_disk = resolve_readme(repo_root)
    expected = on_disk.name if on_disk else " or ".join(KNOWN_READMES)
    if not isinstance(declared, str) or not declared:
        return False, f"readme field missing (expected {expected})"
    if on_disk is not None:
        if declared.lower() == on_disk.name.lower():
            return True, f'readme = "{declared}"'
        return False, f'readme = "{declared}" but the README on disk is {on_disk.name}'
    # Nothing on disk to agree with -- check_readme_exists is already failing for
    # that, so only reject a name that is not a README at all.
    if declared.lower() in {name.lower() for name in KNOWN_READMES}:
        return True, f'readme = "{declared}"'
    return False, f"readme should be {expected} (got: {declared})"


# ---------------------------------------------------------------------------
# Per-language checks
# ---------------------------------------------------------------------------


def check_python_readme_field(repo_root: Path) -> CheckResult:
    pp = repo_root / "pyproject.toml"
    if not pp.exists():
        return CheckResult(
            "Python", "pyproject_readme_field", "SKIP", "No pyproject.toml"
        )
    try:
        data = tomllib.loads(pp.read_text(encoding="utf-8"))
    except Exception as e:
        return CheckResult(
            "Python",
            "pyproject_readme_field",
            "FAIL",
            f"Could not parse pyproject.toml: {e}",
        )
    project = data.get("project") or {}
    readme = project.get("readme")
    # PEP 621 allows either a bare filename or a table with `file`.
    declared = readme.get("file") if isinstance(readme, dict) else readme
    ok, detail = _readme_field_verdict(repo_root, declared)
    return CheckResult(
        "Python",
        "pyproject_readme_field",
        "PASS" if ok else "FAIL",
        detail if ok else f"[project] {detail}",
        evidence={} if ok else {"readme": readme},
    )


def check_ts_repository_field(repo_root: Path) -> CheckResult:
    pkg = repo_root / "package.json"
    if not pkg.exists():
        return CheckResult(
            "TypeScript", "package_repository_field", "SKIP", "No package.json"
        )
    try:
        data = json.loads(pkg.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return CheckResult(
            "TypeScript",
            "package_repository_field",
            "FAIL",
            f"package.json invalid: {e}",
        )
    repo = data.get("repository")
    repo_url = ""
    if isinstance(repo, str):
        repo_url = repo
    elif isinstance(repo, dict):
        repo_url = repo.get("url", "")
    if "github.com/n24q02m/" in repo_url or "github.com:n24q02m/" in repo_url:
        return CheckResult("TypeScript", "package_repository_field", "PASS", repo_url)
    return CheckResult(
        "TypeScript",
        "package_repository_field",
        "FAIL",
        f"repository.url should reference github.com/n24q02m/<repo> (got: {repo_url})",
        evidence={"repository": repo},
    )


def check_go_dockerfile_ghcr_label(repo_root: Path) -> CheckResult:
    df = repo_root / "Dockerfile"
    if not df.exists():
        return CheckResult(
            "Go/Docker", "dockerfile_ghcr_label", "SKIP", "No Dockerfile"
        )
    text = df.read_text(encoding="utf-8")
    if re.search(
        r"LABEL\s+org\.opencontainers\.image\.source\s*=\s*[\"']?https://github\.com/n24q02m/",
        text,
    ):
        return CheckResult(
            "Go/Docker",
            "dockerfile_ghcr_label",
            "PASS",
            "LABEL org.opencontainers.image.source set",
        )
    return CheckResult(
        "Go/Docker",
        "dockerfile_ghcr_label",
        "FAIL",
        "Dockerfile missing 'LABEL org.opencontainers.image.source=https://github.com/n24q02m/...'",
    )


def _resolve_workspace_members(
    repo_root: Path, patterns: list[str], exclude_patterns: list[str]
) -> list[Path]:
    """Expand Cargo `[workspace] members`/`exclude` patterns into member directories.

    Cargo workspace members are glob patterns (e.g. `"crates/*"`), not a literal
    directory list -- `Path.glob` resolves both the literal and the wildcard case
    identically, so a fixed member list still works unchanged.
    """
    resolved: dict[str, Path] = {}
    for pattern in patterns:
        for path in repo_root.glob(pattern):
            if path.is_dir() and (path / "Cargo.toml").is_file():
                resolved[str(path)] = path
    excluded = {str(p) for pattern in exclude_patterns for p in repo_root.glob(pattern)}
    return [p for key, p in sorted(resolved.items()) if key not in excluded]


def _rust_crate_publish_gap(pkg: dict) -> str | None:
    """Reason a workspace member is NOT subject to the readme rule, or None if it is.

    A crate that cannot reach crates.io as written has no registry README to be
    out of sync with -- `publish = false`, or missing the description/license
    metadata `cargo publish` itself requires, both mean "not registry-bound",
    not "wrong readme field".
    """
    if pkg.get("publish") is False:
        return "publish = false"
    missing = []
    if not pkg.get("description"):
        missing.append("description")
    if not pkg.get("license") and not pkg.get("license-file"):
        missing.append("license or license-file")
    if missing:
        return f"missing {' and '.join(missing)}"
    return None


def _check_rust_workspace_readme(repo_root: Path, workspace: dict) -> CheckResult:
    members = _resolve_workspace_members(
        repo_root,
        workspace.get("members") or [],
        workspace.get("exclude") or [],
    )

    subject: list[tuple[str, dict]] = []
    excluded_reasons: list[str] = []
    for member_dir in members:
        member_ct = member_dir / "Cargo.toml"
        try:
            member_data = tomllib.loads(member_ct.read_text(encoding="utf-8"))
        except Exception as e:
            excluded_reasons.append(f"{member_dir.name}: Cargo.toml invalid ({e})")
            continue
        pkg = member_data.get("package")
        if not isinstance(pkg, dict):
            excluded_reasons.append(f"{member_dir.name}: no [package] table")
            continue
        crate_name = pkg.get("name", member_dir.name)
        gap = _rust_crate_publish_gap(pkg)
        if gap is not None:
            excluded_reasons.append(f"{crate_name}: {gap}")
            continue
        subject.append((crate_name, pkg))

    if not subject:
        detail = (
            "; ".join(excluded_reasons)
            if excluded_reasons
            else "no workspace members resolved"
        )
        return CheckResult(
            "Rust",
            "cargo_readme_field",
            "SKIP",
            f"Workspace has no publishable crate ({detail})",
            evidence={
                "members_examined": [m.name for m in members],
                "reasons": excluded_reasons,
            },
        )

    failing = [
        (name, pkg.get("readme"))
        for name, pkg in subject
        if not (
            isinstance(pkg.get("readme"), str)
            and pkg.get("readme", "").lower() == "readme.md"
        )
    ]
    if failing:
        detail = "; ".join(
            f'{name} readme should be "README.md" (got: {readme})'
            for name, readme in failing
        )
        return CheckResult(
            "Rust",
            "cargo_readme_field",
            "FAIL",
            f"{len(failing)} publishable crate(s) missing readme field: {detail}",
            evidence={"failing": failing},
        )

    passing_names = ", ".join(name for name, _ in subject)
    return CheckResult(
        "Rust",
        "cargo_readme_field",
        "PASS",
        f'{len(subject)} publishable crate(s) have readme = "README.md" ({passing_names})',
    )


def check_rust_cargo_readme(repo_root: Path) -> CheckResult:
    ct = repo_root / "Cargo.toml"
    if not ct.exists():
        return CheckResult("Rust", "cargo_readme_field", "SKIP", "No Cargo.toml")
    try:
        data = tomllib.loads(ct.read_text(encoding="utf-8"))
    except Exception as e:
        return CheckResult(
            "Rust", "cargo_readme_field", "FAIL", f"Cargo.toml invalid: {e}"
        )

    if "package" in data:
        pkg = data["package"] or {}
        readme = pkg.get("readme")
        if isinstance(readme, str) and readme.lower() == "readme.md":
            return CheckResult(
                "Rust", "cargo_readme_field", "PASS", f'readme = "{readme}"'
            )
        return CheckResult(
            "Rust",
            "cargo_readme_field",
            "FAIL",
            f'[package] readme should be "README.md" (got: {readme})',
            evidence={"readme": readme},
        )

    if "workspace" in data:
        return _check_rust_workspace_readme(repo_root, data["workspace"] or {})

    return CheckResult(
        "Rust",
        "cargo_readme_field",
        "SKIP",
        "Cargo.toml has neither [package] nor [workspace]",
    )


# ---------------------------------------------------------------------------
# Universal checks
# ---------------------------------------------------------------------------


def check_readme_exists(repo_root: Path) -> CheckResult:
    found = find_readmes(repo_root)
    if not found:
        return CheckResult(
            "Universal",
            "readme_exists",
            "FAIL",
            f"No README at repo root (expected {' or '.join(KNOWN_READMES)})",
        )
    if len(found) > 1:
        # Two READMEs is worse than none: the registry renders whichever the
        # manifest names while humans edit whichever they opened, so the two
        # drift apart with nothing to flag it.
        names = ", ".join(p.name for p in found)
        return CheckResult(
            "Universal",
            "readme_exists",
            "FAIL",
            f"More than one README at repo root ({names}) -- keep exactly one",
            evidence={"readmes": [p.name for p in found]},
        )
    rd = found[0]
    if rd.stat().st_size == 0:
        return CheckResult("Universal", "readme_exists", "FAIL", f"{rd.name} is empty")
    return CheckResult(
        "Universal",
        "readme_exists",
        "PASS",
        f"{rd.name} ({rd.stat().st_size} bytes)",
    )


def check_readme_tagline(repo_root: Path) -> CheckResult:
    rd = resolve_readme(repo_root)
    if rd is None:
        return CheckResult(
            "Universal", "readme_tagline_present", "SKIP", "README missing"
        )
    text = rd.read_text(encoding="utf-8")
    tagline = extract_readme_tagline(text, filename=rd.name)
    if tagline and len(tagline) >= 10:
        return CheckResult(
            "Universal",
            "readme_tagline_present",
            "PASS",
            f"Tagline: {tagline[:60]}...",
        )
    return CheckResult(
        "Universal",
        "readme_tagline_present",
        "FAIL",
        "No substantive tagline found (need ≥10 chars on first prose line)",
    )


# ---------------------------------------------------------------------------
# MCP-server-specific check
# ---------------------------------------------------------------------------


def check_mcp_server_description_matches(repo_root: Path) -> CheckResult:
    sj = repo_root / "server.json"
    if not sj.exists():
        return CheckResult(
            "MCP", "server_json_description_matches", "SKIP", "Not an MCP server"
        )
    rd = resolve_readme(repo_root)
    if rd is None:
        return CheckResult(
            "MCP", "server_json_description_matches", "SKIP", "README missing"
        )
    try:
        sj_data = json.loads(sj.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return CheckResult(
            "MCP",
            "server_json_description_matches",
            "FAIL",
            f"server.json invalid: {e}",
        )
    desc = (sj_data.get("description") or "").strip()
    if not desc:
        return CheckResult(
            "MCP",
            "server_json_description_matches",
            "FAIL",
            "server.json has empty description",
        )
    tagline = extract_readme_tagline(rd.read_text(encoding="utf-8"), filename=rd.name)
    if not tagline:
        return CheckResult(
            "MCP",
            "server_json_description_matches",
            "SKIP",
            "Cannot extract README tagline",
        )
    if normalize_for_match(desc) == normalize_for_match(tagline):
        return CheckResult(
            "MCP",
            "server_json_description_matches",
            "PASS",
            "server.json description matches README tagline",
        )
    return CheckResult(
        "MCP",
        "server_json_description_matches",
        "FAIL",
        "server.json description != README tagline",
        evidence={"server_json_description": desc, "readme_tagline": tagline},
    )


# ---------------------------------------------------------------------------
# Detection + main
# ---------------------------------------------------------------------------


def detect_languages(repo_root: Path) -> list[str]:
    langs: list[str] = []
    if (repo_root / "pyproject.toml").exists():
        langs.append("python")
    if (repo_root / "package.json").exists():
        langs.append("typescript")
    if (repo_root / "Cargo.toml").exists():
        langs.append("rust")
    if (repo_root / "go.mod").exists():
        langs.append("go")
    if (repo_root / "Dockerfile").exists() and "go" not in langs:
        langs.append("go")  # GHCR LABEL applies to all GHCR-publishing repos
    return langs


def run_checks(repo_root: Path, langs: list[str] | None = None) -> list[CheckResult]:
    results: list[CheckResult] = []
    detected = langs if langs else detect_languages(repo_root)

    # Universal first
    results.append(check_readme_exists(repo_root))
    results.append(check_readme_tagline(repo_root))

    # Per-language
    if "python" in detected:
        results.append(check_python_readme_field(repo_root))
    if "typescript" in detected:
        results.append(check_ts_repository_field(repo_root))
    if "go" in detected:
        results.append(check_go_dockerfile_ghcr_label(repo_root))
    if "rust" in detected:
        results.append(check_rust_cargo_readme(repo_root))

    # MCP server (always check if server.json present)
    results.append(check_mcp_server_description_matches(repo_root))
    return results


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Per-language registry README field check")
    p.add_argument("--repo-root", default=".", help="Local repo root (default cwd)")
    p.add_argument(
        "--lang",
        choices=["auto", "python", "typescript", "go", "rust", "all"],
        default="auto",
        help="Target language (default: auto-detect from manifests)",
    )
    p.add_argument("--format", default="table", choices=["json", "table", "markdown"])
    p.add_argument("--output-file")
    return p.parse_args()


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    if not repo_root.exists():
        print(f"ERROR: --repo-root {repo_root} does not exist", file=sys.stderr)
        return 2

    if args.lang == "auto":
        langs = detect_languages(repo_root)
    elif args.lang == "all":
        langs = ["python", "typescript", "go", "rust"]
    else:
        langs = [args.lang]

    if not langs and args.lang == "auto":
        print(
            "WARNING: no recognizable manifest (pyproject.toml, package.json, "
            "Cargo.toml, go.mod, Dockerfile) found at repo root",
            file=sys.stderr,
        )
        # Still run universal checks
        results = run_checks(repo_root, langs=[])
    else:
        results = run_checks(repo_root, langs=langs)

    output = render_results(results, args.format)
    if args.output_file:
        Path(args.output_file).write_text(output, encoding="utf-8")
    else:
        print(output)

    return 1 if has_failure(results) else 0


if __name__ == "__main__":
    sys.exit(main())
