"""Shared utilities for repo-bootstrap scripts.

Pure stdlib only (Python 3.13+). No external dependencies.
"""

from __future__ import annotations

import json
import re
import subprocess
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# ---------------------------------------------------------------------------
# Tier classification
# ---------------------------------------------------------------------------


class Tier(Enum):
    TIER_1 = "tier_1"  # Productions list (Flagship)
    TIER_2 = "tier_2"  # Scripts list (Library/Infra)


# ---------------------------------------------------------------------------
# CheckResult + decorator + registry
# ---------------------------------------------------------------------------


@dataclass
class CheckResult:
    group: str
    name: str
    status: str  # "PASS" | "FAIL" | "SKIP"
    message: str = ""
    evidence: dict[str, Any] = field(default_factory=dict)


_CHECK_REGISTRY: list[tuple[str, str, Callable[..., CheckResult]]] = []


def check(group: str, name: str):
    """Decorator registering a check function in the global registry."""

    def decorator(fn: Callable[..., CheckResult]) -> Callable[..., CheckResult]:
        _CHECK_REGISTRY.append((group, name, fn))
        return fn

    return decorator


def get_registry() -> list[tuple[str, str, Callable[..., CheckResult]]]:
    return list(_CHECK_REGISTRY)


# ---------------------------------------------------------------------------
# AuditContext
# ---------------------------------------------------------------------------


@dataclass
class AuditContext:
    repo: str  # owner/name
    tier: Tier
    is_public: bool
    is_archived: bool
    primary_language: str  # "Python" | "TypeScript" | "Go" | etc.
    topics: list[str]
    is_docs_site: bool  # repo has docs/ + Cloudflare Pages claim
    gh: GhClient

    @property
    def owner(self) -> str:
        return self.repo.split("/", 1)[0]

    @property
    def name(self) -> str:
        return self.repo.split("/", 1)[1]


# ---------------------------------------------------------------------------
# Gh CLI wrapper with response cache
# ---------------------------------------------------------------------------
GH_COMMAND_TIMEOUT_SECONDS = 30



class GhClient:
    """Thin wrapper around `gh api` and `gh repo` subprocess calls.

    Caches successful JSON responses per (method, args) tuple to avoid
    re-querying when multiple checks need the same data.
    """

    def __init__(self) -> None:
        self._cache: dict[tuple, Any] = {}
        self._timed_out = False


    def _run(self, args: list[str]) -> str:
        if self._timed_out:
            raise GhError("gh unavailable after an earlier timeout")
        try:
            result = subprocess.run(
                ["gh", *args],
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
                timeout=GH_COMMAND_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired as exc:
            self._timed_out = True
            raise GhError(
                f"gh {' '.join(args)} timed out after "
                f"{GH_COMMAND_TIMEOUT_SECONDS} seconds"
            ) from exc
        if result.returncode != 0:
            err_parts = []
            if result.stderr:
                err_parts.append(result.stderr.strip())
            if result.stdout:
                err_parts.append(result.stdout.strip())
            err = " | ".join(err_parts) or "(no output)"
            raise GhError(
                f"gh {' '.join(args)} failed (exit {result.returncode}): {err}"
            )
        return result.stdout

    def api(
        self, path: str, *, method: str = "GET", fields: dict[str, str] | None = None
    ) -> Any:
        """Call `gh api <path>` with optional method + fields. Returns parsed JSON."""
        cache_key = ("api", path, method, tuple(sorted((fields or {}).items())))
        if cache_key in self._cache:
            return self._cache[cache_key]
        args = ["api", path, "-X", method]
        for k, v in (fields or {}).items():
            args += ["-f", f"{k}={v}"]
        out = self._run(args)
        try:
            parsed = json.loads(out) if out.strip() else None
        except json.JSONDecodeError:
            parsed = out.strip()
        self._cache[cache_key] = parsed
        return parsed

    def graphql(self, query: str, *, variables: dict[str, str] | None = None) -> Any:
        """Call `gh api graphql -f query=...`. Returns parsed JSON."""
        args = ["api", "graphql", "-f", f"query={query}"]
        for k, v in (variables or {}).items():
            args += ["-f", f"{k}={v}"]
        out = self._run(args)
        return json.loads(out)

    def repo_view(self, repo: str, fields: list[str]) -> dict[str, Any]:
        """`gh repo view <repo> --json <fields>`. Returns parsed JSON dict."""
        cache_key = ("repo_view", repo, tuple(sorted(fields)))
        if cache_key in self._cache:
            return self._cache[cache_key]
        out = self._run(["repo", "view", repo, "--json", ",".join(fields)])
        parsed = json.loads(out)
        self._cache[cache_key] = parsed
        return parsed

    def repo_topics(self, repo: str) -> list[str]:
        data = self.api(f"repos/{repo}/topics", method="GET")
        return data.get("names", []) if isinstance(data, dict) else []


class GhError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Tier auto-detection from Stars list
# ---------------------------------------------------------------------------


_STARS_LIST_QUERY = """
query {
  viewer {
    lists(first: 10) {
      nodes {
        name
        items(first: 100) {
          nodes {
            ... on Repository {
              nameWithOwner
            }
          }
        }
      }
    }
  }
}
"""


def fetch_stars_lists(gh: GhClient) -> dict[str, list[str]]:
    """Returns {list_name: [owner/repo, ...]} for all viewer Stars lists."""
    data = gh.graphql(_STARS_LIST_QUERY)
    out: dict[str, list[str]] = {}
    for node in data["data"]["viewer"]["lists"]["nodes"]:
        list_name = node["name"]
        repos = [
            item["nameWithOwner"]
            for item in node["items"]["nodes"]
            if item.get("nameWithOwner")
        ]
        out[list_name] = repos
    return out


def detect_tier(repo: str, gh: GhClient) -> Tier:
    """Determine tier from Stars list membership.

    Productions → Tier 1; Scripts → Tier 2; default → Tier 2.
    """
    lists = fetch_stars_lists(gh)
    if repo in lists.get("Productions", []):
        return Tier.TIER_1
    return Tier.TIER_2


# ---------------------------------------------------------------------------
# Build AuditContext
# ---------------------------------------------------------------------------


def build_audit_context(repo: str, *, force_tier: Tier | None = None) -> AuditContext:
    gh = GhClient()
    info = gh.repo_view(repo, ["isPrivate", "isArchived", "primaryLanguage"])
    topics = gh.repo_topics(repo)
    is_public = not info.get("isPrivate", True)
    is_archived = bool(info.get("isArchived", False))
    primary_lang = (info.get("primaryLanguage") or {}).get("name", "Unknown")
    tier = force_tier or detect_tier(repo, gh)
    is_docs_site = "docs-site" in topics or repo.endswith(("-docs", ".n24q02m.com"))
    return AuditContext(
        repo=repo,
        tier=tier,
        is_public=is_public,
        is_archived=is_archived,
        primary_language=primary_lang,
        topics=topics,
        is_docs_site=is_docs_site,
        gh=gh,
    )


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------


def format_table(results: list[CheckResult]) -> str:
    """ASCII table grouped by check group."""
    by_group: dict[str, list[CheckResult]] = {}
    for r in results:
        by_group.setdefault(r.group, []).append(r)

    lines: list[str] = []
    lines.append("=" * 88)
    lines.append(f"{'Group':<20} {'Check':<40} {'Status':<6} Message")
    lines.append("-" * 88)
    for group in by_group:
        for r in by_group[group]:
            msg = r.message[:35] + "..." if len(r.message) > 38 else r.message
            lines.append(f"{r.group:<20} {r.name:<40} {r.status:<6} {msg}")
    lines.append("-" * 88)
    summary = _summarize(results)
    lines.append(
        f"Summary: {summary['PASS']} PASS / {summary['FAIL']} FAIL / {summary['SKIP']} SKIP"
    )
    lines.append("=" * 88)
    return "\n".join(lines)


def format_json(results: list[CheckResult]) -> str:
    payload = {
        "summary": _summarize(results),
        "results": [
            {
                "group": r.group,
                "name": r.name,
                "status": r.status,
                "message": r.message,
                "evidence": r.evidence,
            }
            for r in results
        ],
    }
    return json.dumps(payload, indent=2, default=str)


def format_markdown(results: list[CheckResult]) -> str:
    """GitHub-flavored markdown for PR body / issue."""
    summary = _summarize(results)
    lines = [
        f"## Repo audit — {summary['PASS']} PASS / {summary['FAIL']} FAIL / {summary['SKIP']} SKIP",
        "",
    ]
    by_group: dict[str, list[CheckResult]] = {}
    for r in results:
        by_group.setdefault(r.group, []).append(r)
    for group, items in by_group.items():
        lines.append(f"### {group}")
        lines.append("")
        lines.append("| Check | Status | Message |")
        lines.append("|---|---|---|")
        for r in items:
            icon = {"PASS": "OK", "FAIL": "FAIL", "SKIP": "skip"}.get(
                r.status, r.status
            )
            msg = (r.message or "").replace("|", "\\|").replace("\n", " ")
            lines.append(f"| `{r.name}` | {icon} | {msg} |")
        lines.append("")
    return "\n".join(lines)


def _summarize(results: list[CheckResult]) -> dict[str, int]:
    counts = {"PASS": 0, "FAIL": 0, "SKIP": 0}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# README parsing helpers
# ---------------------------------------------------------------------------


_RST_ADORNMENT = re.compile(r"^[=\-~^\"'`*+#_:.]{3,}\s*$")


def _extract_rst_tagline(text: str) -> str | None:
    """Tagline from a reStructuredText README.

    rst marks headings with an underline of punctuation rather than `##`, and
    the tagline is usually the emphasised line right under the title
    (`*One line about the project.*`).
    """
    lines = text.splitlines()
    paragraphs: list[list[str]] = []
    current: list[str] = []
    in_directive = False
    headings_seen = 0

    for i, raw in enumerate(lines):
        stripped = raw.strip()
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        if _RST_ADORNMENT.match(stripped):
            continue  # the underline itself
        if stripped and _RST_ADORNMENT.match(nxt):
            headings_seen += 1
            if headings_seen > 1:
                break  # past the document title, into a section
            current.clear()
            continue
        if stripped.startswith(".."):  # directive or comment opener
            in_directive = True
            if current:
                paragraphs.append(current)
                current = []
            continue
        if not stripped:
            # A blank line ends a paragraph but not a directive — the directive
            # body is separated from its opener by exactly such a blank line.
            if current:
                paragraphs.append(current)
                current = []
            continue
        if in_directive:
            if raw[:1].isspace():
                continue  # still inside the indented body
            in_directive = False
        current.append(stripped)
    if current:
        paragraphs.append(current)

    for para in paragraphs:
        joined = " ".join(para)
        cleaned = re.sub(
            r"`([^`<]+?)(?:\s*<[^>]+>)?`_{0,2}", r"\1", joined
        )  # `text <url>`_
        cleaned = re.sub(r"``([^`]+)``", r"\1", cleaned)  # ``literal``
        cleaned = re.sub(r"\*{1,2}([^*]+?)\*{1,2}", r"\1", cleaned)  # *em* / **strong**
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if len(cleaned) >= 10:
            return cleaned
    return None


def extract_readme_tagline(
    readme_text: str, *, filename: str = "README.md"
) -> str | None:
    """Best-effort extract of tagline (first substantive bold/prose line) from README.

    Strategy (priority order):
    1. First **bold** OR <strong> line (canonical brand tagline in skret-style hero)
    2. First substantive prose line ≥ 10 chars (after stripping h1, badges, metadata)

    Skips:
    - <h1>...</h1> blocks + markdown `#` headers
    - HTML comments
    - Image / linked-badge lines
    - MCP Registry metadata lines (e.g. `mcp-name: io.github.n24q02m/foo`)
    - Code fence lines
    - The auto-generated cross-promo block and any other <details> section
    - Table rows

    Only the hero region counts — everything before the first `##` heading. A
    bold line further down the document is body copy, not the brand tagline.
    """
    if not filename.lower().endswith(".md"):
        return _extract_rst_tagline(readme_text)
    # Drop the generated cross-promo block, whose <summary> would otherwise read
    # as the first bold line on repos that place it directly under the title.
    text = re.sub(
        r"<!-- BEGIN: AUTO-GENERATED-CROSS-PROMO -->.*?<!-- END: AUTO-GENERATED-CROSS-PROMO -->",
        "",
        readme_text,
        flags=re.DOTALL,
    )
    text = re.sub(r"<details\b.*?</details>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Remove HTML comments
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    # Hero region only — stop at the first `##` heading
    text = re.split(r"^##\s+", text, maxsplit=1, flags=re.MULTILINE)[0]
    # Remove <h1>...</h1> blocks
    text = re.sub(r"<h1\b[^>]*>.*?</h1>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Remove markdown `# ...` h1 lines
    text = re.sub(r"^#\s+.*$", "", text, flags=re.MULTILINE)

    METADATA_PREFIXES = (
        "mcp-name:",
        "version:",
        "license:",
        "homepage:",
        "author:",
        "name:",
        "description:",
        "type:",
    )

    def clean_line(raw: str) -> str:
        cleaned = re.sub(r"^\s*>\s*", "", raw)
        cleaned = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", cleaned)
        cleaned = re.sub(r"\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)", " ", cleaned)
        cleaned = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", cleaned)
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        cleaned = re.sub(r"\*+([^*]+?)\*+", r"\1", cleaned)
        cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()

    def is_metadata(line: str) -> bool:
        low = line.strip().lower()
        return any(low.startswith(p) for p in METADATA_PREFIXES)

    def is_list_or_quote(line: str) -> bool:
        stripped = line.strip()
        # A blockquote carrying bold text is the tagline in the badge-first README
        # style (Aiora, LinguaSense), so only plain quotes are skipped.
        if stripped.startswith((">", "> ")) and re.search(
            r"\*\*[^*]+?\*\*|<strong>", stripped
        ):
            return False
        return stripped.startswith(("- ", "* ", "+ ", "> ", ">"))

    def is_table_row(line: str) -> bool:
        return line.strip().startswith("|")

    # Work in paragraphs, not lines: a tagline is often wrapped across two lines
    # ("**Peer AI agents chat in a shared folder — no human relay,\nworks on
    # Windows.**"), which no single-line regex can see as bold.
    paragraphs: list[tuple[str, bool]] = []  # (text, appears_before_first_code_fence)
    current: list[str] = []
    in_code_fence = False
    seen_fence = False

    def flush() -> None:
        if current:
            paragraphs.append((" ".join(current), not seen_fence))
            current.clear()

    for raw_line in text.splitlines():
        if raw_line.strip().startswith("```"):
            flush()
            in_code_fence = not in_code_fence
            seen_fence = True
            continue
        if in_code_fence:
            continue
        if not raw_line.strip():
            flush()
            continue
        if (
            is_metadata(raw_line)
            or is_list_or_quote(raw_line)
            or is_table_row(raw_line)
        ):
            flush()
            continue
        current.append(raw_line)
    flush()

    bold_re = re.compile(r"(?:<strong>.+?</strong>|\*\*.+?\*\*)", re.DOTALL)

    # Pass 1: first bold paragraph — the canonical brand tagline
    for para, _ in paragraphs:
        if not bold_re.search(para):
            continue
        cleaned = clean_line(para)
        if cleaned and len(cleaned) >= 10:
            return cleaned

    # Pass 2: prose fallback, but only above the first code fence. Below it the
    # text is install instructions, not a tagline — a repo whose hero holds no
    # one-liner should report none rather than borrow a sentence.
    for para, before_fence in paragraphs:
        if not before_fence:
            break
        cleaned = clean_line(para)
        if cleaned and len(cleaned) >= 10:
            return cleaned
    return None


def normalize_for_match(text: str) -> str:
    """Lower-case + strip trailing punctuation + collapse whitespace."""
    return re.sub(r"\s+", " ", text.strip().rstrip(".!?").lower())


# ---------------------------------------------------------------------------
# Result printing helpers
# ---------------------------------------------------------------------------


def render_results(results: list[CheckResult], fmt: str) -> str:
    if fmt == "json":
        return format_json(results)
    if fmt == "markdown":
        return format_markdown(results)
    return format_table(results)


def write_counts_file(results: list[CheckResult], path: str) -> None:
    """Write {passed, failed, skipped} JSON to a file (used by composite actions)."""
    summary = _summarize(results)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "passed": summary["PASS"],
                "failed": summary["FAIL"],
                "skipped": summary["SKIP"],
            },
            f,
        )


# ---------------------------------------------------------------------------
# Exit-code helpers
# ---------------------------------------------------------------------------


def has_failure(results: Iterable[CheckResult]) -> bool:
    return any(r.status == "FAIL" for r in results)
