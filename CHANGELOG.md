# 1.0.0 (2025-12-06)

### Bug Fixes

- enable pnpm-lock.yaml tracking and fix pre-commit hooks ([ba6a5f4](https://github.com/n24q02m/better-notion-mcp/commit/ba6a5f452c6e89db87587a38474546ef9f011588))
- remove test step from CI workflow (no tests yet) ([afba321](https://github.com/n24q02m/better-notion-mcp/commit/afba321a533f5a0160e59498f727b4a3911186fc))
- use changesets action correctly for auto versioning ([da5fad8](https://github.com/n24q02m/better-notion-mcp/commit/da5fad8d9dcdadd03b2d0baa6cbc295688c94683))

### Features

- Migrate from Changesets to Semantic Release for automated package publishing. ([5908581](https://github.com/n24q02m/better-notion-mcp/commit/5908581ac8a6fbe270f66cd57993cf414bd480a2))
- reset repo ([2bf101c](https://github.com/n24q02m/better-notion-mcp/commit/2bf101c98b5eef5b3caac1922e960e555cab429c))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.9] - 2025-11-08

### Docs

## [Unreleased]

### Current Features

- 7 mega action-based tools covering 75% of Notion API
- 30 actions across all tools
- Markdown-first content format
- Auto-pagination support
- Bulk operations (create/update/delete)
- NPX and Docker deployment options

### Available Tools

- `pages` - Complete page lifecycle (6 actions)
- `databases` - Database management (9 actions)
- `blocks` - Granular block editing (5 actions)
- `users` - User management (4 actions)
- `workspace` - Workspace operations (2 actions)
- `comments` - Comment operations (2 actions)
- `content_convert` - Markdown ↔ Notion blocks utility (2 directions)
