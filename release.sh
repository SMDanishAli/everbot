#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

usage() {
  cat <<'EOF'
Usage: ./release.sh [--feature|--major]

Creates a release commit and an annotated version tag.
The default release type is patch.

Examples:
  ./release.sh
  ./release.sh --feature
  ./release.sh --major
EOF
}

release_type="patch"

case "${1:-}" in
  "")
    ;;
  --feature)
    release_type="minor"
    ;;
  --major)
    release_type="major"
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    echo "Error: unknown option '$1'." >&2
    usage >&2
    exit 1
    ;;
esac

if [[ "$#" -gt 1 ]]; then
  echo "Error: only one release option may be provided." >&2
  usage >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree must be clean before creating a release." >&2
  exit 1
fi

current_branch="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$current_branch" ]]; then
  echo "Error: releases must be created from a branch, not a detached HEAD." >&2
  exit 1
fi

npm version "$release_type" --no-git-tag-version
version="$(node -p "require('./package.json').version")"
tag="v${version}"

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Error: tag '$tag' already exists." >&2
  git checkout -- package.json package-lock.json
  exit 1
fi

git add package.json package-lock.json
git commit -m "Release ${tag}" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git tag -a "$tag" -m "Release ${tag}"
git push origin "$current_branch" "$tag"

echo "Created and pushed release ${tag} on ${current_branch}."
