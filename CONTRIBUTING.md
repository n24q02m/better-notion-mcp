# Contributing to Better Notion MCP

Thank you for your interest in contributing to Better Notion MCP! This guide will help you get started.

## Getting Started

### Prerequisites

- **mise** (recommended) or **Node.js 24+** and **bun**
- Git
- A GitHub account

**Recommended:** Use [mise](https://mise.jdx.dev/) to automatically manage Node.js and bun versions from `.mise.toml`.

### Setup Development Environment

1. **Fork the repository** and clone your fork

```bash
git clone https://github.com/YOUR_USERNAME/better-notion-mcp
cd better-notion-mcp
```

2. **Install tools and dependencies**

If using **mise** (recommended):

```bash
mise install      # Auto-install Node.js 24 and bun from .mise.toml
bun install
```

Without mise, ensure you have Node.js 24+ and bun installed:

```bash
bun install
```

3. **Build the project**

```bash
bun run build
```

4. **Run tests**

```bash
bun run test
```

> **Note:** Always use `bun run test` (which runs vitest), not `bun test` (which uses bun's built-in test runner). The test suite uses vitest-specific APIs like `vi.hoisted()` and `importOriginal` that are not available in bun's runner.

## Development Workflow

### Running Locally

```bash
# Set your Notion token
export NOTION_TOKEN=secret_xxx

# Start development server with auto-reload
bun run dev
```

### Making Changes

1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run checks: `bun run check`
4. Run tests: `bun run test`
5. Build the project: `bun run build`
6. Commit your changes (see [Commit Convention](#commit-convention))
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) with automated enforcement via commitlint and git hooks:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependencies
- `ci`: CI/CD changes
- `build`: Build system changes

### Examples

```text
feat: add bulk delete operation for pages
fix: handle pagination errors gracefully
docs: update API examples in README
test: add integration tests for databases tool
chore: upgrade dependencies
```

**Note**: Commit messages are validated automatically via git hooks when you commit.

## Release Process

Releases are automated using **Semantic Release**. We strictly follow the **Conventional Commits** specification to determine version bumps and generate changelogs automatically.

### Commit Guidelines

It is mandatory to use correct commit types so the release system knows how to bump the version:

- **fix**: Patches a bug (PATCH version bump, e.g., 1.0.0 -> 1.0.1)
- **feat**: Introduces a new feature (MINOR version bump, e.g., 1.0.0 -> 1.1.0)
- **feat!** or **fix!** (or generic **BREAKING CHANGE** in footer): Introduces a breaking change (MAJOR version bump, e.g., 1.0.0 -> 2.0.0)
- **chore**, **docs**, **style**, **refactor**, **test**: No version bump (usually)

### How to Release

1. Just create a Pull Request with your changes.
2. Ensure your commit messages follow the convention above (enforced by `commitlint`).
3. Merge the PR to `main`.
4. A maintainer triggers the CD workflow manually via **workflow_dispatch**:
   - Choose `beta` or `stable` release type.
   - PSR analyzes commits since the last release.
   - Bumps version, updates `CHANGELOG.md`, creates a tag.
   - Publishes to npm.
   - Creates a GitHub Release.
   - Builds and pushes Docker images.

You do **not** need to create manual tags or changelog entries.

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation if needed
- Add tests for new functionality
- Ensure all checks pass (`bun run check`)

- Follow existing code style
- Write clear PR descriptions

### PR Checklist

Before submitting your PR, ensure:

- [ ] Code follows TypeScript best practices
- [ ] All tests pass (`bun run test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Formatting is correct (`bun run format:check`)
- [ ] Type checking passes (`bun run type-check`)
- [ ] Commit messages follow **Conventional Commits** (`feat:`, `fix:`, etc.)
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention

## Code Style

This project uses **Biome** for formatting and linting. All changes are automatically checked via pre-commit hooks and CI.

**Guidelines:**

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Write clear, descriptive variable names
- Add comments for complex logic
- Keep functions small and focused
- Use meaningful type annotations

**Commands:**

```bash
bun run check         # Check formatting, linting & types
bun run check:fix     # Auto-fix issues
```

## Testing

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

### Writing Tests

- Place tests in `tests/` directory
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies appropriately

## Project Structure

```text
better-notion-mcp/
├── src/                    # Source code
│   ├── init-server.ts     # Server initialization
│   └── tools/             # Tool implementations
│       ├── registry.ts    # Tool registry
│       ├── composite/     # Composite tools
│       └── helpers/       # Helper utilities
├── scripts/               # Build scripts
└── build/                # Built output
```

Feel free to open an issue for:

- Bug reports
- Feature requests
- Questions about the codebase
- Discussion about architecture

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Better Notion MCP!**
