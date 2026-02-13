#!/bin/bash
# Clean up stale release-please PRs and branches for a target branch.
# Usage: ./cleanup-release-prs.sh --branch=dev|main
# Environment: GH_TOKEN must be set (with write access to PRs and branches)
#
# This script:
# 1. Closes all open release-please PRs targeting the specified branch
# 2. Deletes all release-please branches for that target (including component branches)
#
# Safe to run multiple times (idempotent).

set -euo pipefail

# Default
BRANCH=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --branch=*)
      BRANCH="${arg#*=}"
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 --branch=dev|main"
      exit 1
      ;;
  esac
done

if [ -z "$BRANCH" ]; then
  echo "Error: --branch is required"
  echo "Usage: $0 --branch=dev|main"
  exit 1
fi

echo "Cleaning up release-please PRs for branch: $BRANCH"

# 1. Close open release-please PRs
RELEASE_PRS=$(gh pr list --base "$BRANCH" --label "autorelease: pending" --json number --jq '.[].number' 2>/dev/null || echo "")
if [ -n "$RELEASE_PRS" ]; then
  for pr in $RELEASE_PRS; do
    echo "Closing stale release PR #$pr"
    gh pr close "$pr" --comment "Closed by cleanup-release-prs. A new PR will be created on next push." 2>/dev/null || true
  done
else
  echo "No open release-please PRs found for $BRANCH"
fi

# 2. Delete release-please branches (pattern: release-please--branches--{branch}*)
# Handles both standard and component-based branch names
RELEASE_BRANCHES=$(git ls-remote --heads origin "release-please--branches--${BRANCH}*" 2>/dev/null | awk '{print $2}' | sed 's|refs/heads/||' || echo "")
if [ -n "$RELEASE_BRANCHES" ]; then
  for branch in $RELEASE_BRANCHES; do
    echo "Deleting branch: $branch"
    git push origin --delete "$branch" 2>/dev/null || true
  done
else
  echo "No release-please branches found for $BRANCH"
fi

echo "Cleanup complete for $BRANCH"
