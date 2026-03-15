# Fork Workflow

This is a fork of [n24q02m/better-notion-mcp](https://github.com/n24q02m/better-notion-mcp)
maintained at [deskmagic/better-notion-mcp](https://github.com/deskmagic/better-notion-mcp).

## Remotes

| Remote | URL | Purpose |
|--------|-----|---------|
| `origin` | `git@github.com:deskmagic/better-notion-mcp.git` | The fork — our deploy target |
| `upstream` | `git@github.com:n24q02m/better-notion-mcp.git` | Original repo |

---

## Mandatory Workflow (in order, no skipping steps)

### Step 1 — Sync upstream FIRST, before any other work

```bash
git fetch upstream
git merge upstream/main
# Resolve any conflicts, run bun run test, push to origin
```

This must happen before writing any code. It ensures:
- Our work applies cleanly to the current upstream state
- Upstream PR branches are conflict-free from the start
- We don't discover conflicts only after a PR already exists

### Step 2 — Write the failing test

Before touching production code, write a test that fails because of the bug or
that describes the missing behavior. Commit it separately with a `test:` prefix.

```bash
bun run test   # must show the new test failing
```

### Step 3 — Fix the code

Make the minimal change needed to make the failing test pass. Run the full suite.

```bash
bun run test   # all tests must pass
bun run build  # must compile clean
```

### Step 4 — Push to the fork and open a PR to fork/main

```bash
git push origin fix/my-fix
gh pr create --repo deskmagic/better-notion-mcp --base main --head fix/my-fix
```

This is our internal deploy path. No special restrictions.

### Step 5 — Consciously decide whether to open an upstream PR

**This is a deliberate, explicit decision — never automatic.**

Upstream PRs are public and carry reputational weight. Ask:
- Is this fix useful to the broader community (not just our fork)?
- Does it follow upstream's style and contribution guidelines?
- Are there no fork-specific files (FORK.md, local configs, etc.) in the diff?

If yes, create a clean branch off `upstream/main`:

```bash
git checkout -b upstream-pr/fix-my-fix upstream/main
# Apply only the upstream-relevant changes (NOT FORK.md or fork-specific files)
bun run test   # verify against upstream's test suite
bun run build

git push origin upstream-pr/fix-my-fix
gh pr create --repo n24q02m/better-notion-mcp --base main \
  --head deskmagic:upstream-pr/fix-my-fix \
  --title "fix: ..." --body "..."
```

Agents and automated workflows must NEVER run `gh pr create --repo n24q02m/...`
without explicit instruction from Alexander.

---

## Fork-specific files (never send to upstream)

These files exist only in the fork and must be excluded from upstream PRs:

- `FORK.md` (this file)

When cherry-picking or creating upstream branches, always verify the diff
does not include these files before pushing.

---

## Pulling upstream changes (routine sync)

```bash
git fetch upstream
git checkout main
git merge upstream/main
# Resolve conflicts if any, run bun run test + bun run build
git push origin main
```

Do this regularly to keep the fork current and avoid large conflict batches.
