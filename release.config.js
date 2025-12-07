/**
 * Semantic Release Configuration
 * Automatically analyzes commits, generates changelog, and publishes to npm
 */
export default {
  branches: ['main'],
  plugins: [
    // Analyze commits to determine version bump
    '@semantic-release/commit-analyzer',

    // Generate release notes from commits
    '@semantic-release/release-notes-generator',

    // Update CHANGELOG.md
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md'
      }
    ],

    // Publish to npm
    '@semantic-release/npm',

    // Commit updated files (CHANGELOG.md, package.json)
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'pnpm-lock.yaml'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ],

    // Create GitHub release
    '@semantic-release/github'
  ]
}
