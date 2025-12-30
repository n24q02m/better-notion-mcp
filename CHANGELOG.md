# [2.1.0-beta.1](https://github.com/n24q02m/better-notion-mcp/compare/v2.0.1...v2.1.0-beta.1) (2025-12-30)


### Features

* add CI and CD workflows for automated deployment and testing ([57ed3ac](https://github.com/n24q02m/better-notion-mcp/commit/57ed3ac8a4dea8482249aee7c5b56fb232f09b02))

## [2.0.1](https://github.com/n24q02m/better-notion-mcp/compare/v2.0.0...v2.0.1) (2025-12-29)


### Bug Fixes

* correct DOCS_DIR path for bundled CLI ([17e2800](https://github.com/n24q02m/better-notion-mcp/commit/17e2800e8533273a20bef87d687d3ada2c3f49a9))

# [2.0.0](https://github.com/n24q02m/better-notion-mcp/compare/v1.1.0...v2.0.0) (2025-12-26)


### Features

* implement tiered descriptions for token optimization ([ae16cc9](https://github.com/n24q02m/better-notion-mcp/commit/ae16cc9107c086af1a15a88e87ed181670e5629d))


### BREAKING CHANGES

* Tool descriptions are now compressed by default.
Use 'help' tool or MCP resources to access full documentation.

# [1.1.0](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.19...v1.1.0) (2025-12-26)


### Features

* streamline project setup by introducing a `mise run setup` task and updating documentation ([4aa3166](https://github.com/n24q02m/better-notion-mcp/commit/4aa31660bd2896330c86a6b81e8d21e38c65dc8b))

## [1.0.19](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.18...v1.0.19) (2025-12-11)


### Bug Fixes

* update installation instructions in README and streamline package.json formatting ([ba8575a](https://github.com/n24q02m/better-notion-mcp/commit/ba8575a38806690d761b7c1f7090441b285c84f0))

## [1.0.18](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.17...v1.0.18) (2025-12-10)


### Bug Fixes

* streamline pre-commit hook entries and update README instructions ([2c57733](https://github.com/n24q02m/better-notion-mcp/commit/2c577339ab849a5c8e8f5db73edd29a6672cc9e7))

## [1.0.17](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.16...v1.0.17) (2025-12-10)


### Bug Fixes

* update Mise configuration and installation instructions in README ([7af1d2b](https://github.com/n24q02m/better-notion-mcp/commit/7af1d2b7443af7549dcac914c173026f28080d7e))

## [1.0.16](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.15...v1.0.16) (2025-12-10)


### Bug Fixes

* add publishConfig for public access ([b704cda](https://github.com/n24q02m/better-notion-mcp/commit/b704cda20f6b441c56d2bf9dc2162bf56fabef4e))
* add release script ([3a1da3b](https://github.com/n24q02m/better-notion-mcp/commit/3a1da3bbe266ba0493a84504bf5cc816ae4deabc))
* remove redundant npm auth setup step in release workflow ([42752bd](https://github.com/n24q02m/better-notion-mcp/commit/42752bddef6b15ba9db38f76c3aa76d0578cfb62))
* streamline JSON formatting in biome.json and package.json for consistency ([3ea9266](https://github.com/n24q02m/better-notion-mcp/commit/3ea926644c7b3bccb8abe60a4c1b255ce0c96eb3))

## [1.0.15](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.14...v1.0.15) (2025-12-09)


### Bug Fixes

* update pnpm-lock.yaml to sync with package.json ([e536ce4](https://github.com/n24q02m/better-notion-mcp/commit/e536ce454730c22ea1412114ccc0f559b3213066))

## [1.0.14](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.13...v1.0.14) (2025-12-06)

### Bug Fixes

- Remove unused folder path from workspace configuration ([9a1a6c9](https://github.com/n24q02m/better-notion-mcp/commit/9a1a6c910d3f6658614b93e93d2b5171d29510b9))

## [1.0.13](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.12...v1.0.13) (2025-12-06)

### Bug Fixes

- Update limitations in README and make query optional in workspace function ([a552ead](https://github.com/n24q02m/better-notion-mcp/commit/a552ead28c8efd9c94afc0cb2377d0008cc778e2))

## [1.0.12](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.11...v1.0.12) (2025-12-06)

### Bug Fixes

- Rename 'notion' to 'better-notion' in README ([c952370](https://github.com/n24q02m/better-notion-mcp/commit/c9523704b6120d5270d2db3c066adc49edfe2907))

## [1.0.11](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.10...v1.0.11) (2025-12-06)

### Bug Fixes

- use GITHUB_TOKEN for GHCR authentication ([e67ae17](https://github.com/n24q02m/better-notion-mcp/commit/e67ae1708e74db1a12b8b48a32cccc1289a0ceff))

## [1.0.10](https://github.com/n24q02m/better-notion-mcp/compare/v1.0.9...v1.0.10) (2025-12-06)

### Bug Fixes

- trigger release 1.0.10 ([820f0a9](https://github.com/n24q02m/better-notion-mcp/commit/820f0a90e5883255383c499f89f655742eb40af2))

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
