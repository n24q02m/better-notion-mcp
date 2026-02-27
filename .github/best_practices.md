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

## Commits
Conventional Commits (feat:, fix:, chore:, docs:, refactor:, test:).

## Security
Never hardcode API keys. Validate all user inputs. Prevent path traversal in help tool.
