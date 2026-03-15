# Style Guide - better-notion-mcp

## Architecture
MCP server for Notion API. TypeScript, single-package repo.

## TypeScript
- Formatter/Linter: Biome (2 spaces, double quotes, semicolons)
- Build: esbuild (bundle to single file)
- Test: Vitest
- Runtime: Node.js (ES modules)
- SDK: @notionhq/client, @modelcontextprotocol/sdk

## Code Patterns
- Composite tools: withErrorHandling wrapper, retryWithBackoff for transient failures
- Proper Notion API error handling with NotionMCPError
- Pagination handling for all list operations
- Rich text <-> Markdown conversion must preserve fidelity
- Zod for input validation on all tool parameters

## Testing (mandatory)

Every bug fix and every new feature must include tests. No exceptions.

- **Bug fixes**: write a failing test that reproduces the bug first, then fix, then verify it passes.
- **New features**: write tests covering the happy path and relevant error cases.
- Test files live next to source files (`foo.ts` → `foo.test.ts`).
- Run the suite before committing: `bun run test`

PRs without tests for changed behavior will be rejected.

## Commits
Conventional Commits (feat:, fix:, chore:, docs:, refactor:, test:).

## Fork Workflow (agents must follow FORK.md)

This repo is a fork. Before starting any work, sync upstream first.
The full mandatory workflow is in [`FORK.md`](../FORK.md) — read it before
opening any PRs (to the fork or to upstream).

Key rules:
1. `git fetch upstream && git merge upstream/main` — always before starting work
2. Write failing test → fix → verify passing (TDD order, no exceptions)
3. Fork PRs (`deskmagic/better-notion-mcp`) — normal, no restrictions
4. Upstream PRs (`n24q02m/better-notion-mcp`) — explicit human decision only, clean branch off `upstream/main`, no fork-specific files

## Security
Never hardcode API keys. Validate all user inputs. Prevent path traversal in help tool.
