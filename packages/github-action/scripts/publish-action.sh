#!/usr/bin/env bash
# Build the RankCLI GitHub Action and stage a release in a clone of the
# PUBLIC action repo (integrallis/rankcli-action). Nothing is pushed - the
# script prints the push commands for you to run. See PUBLISHING.md.
#
# Why a separate repo: `uses: owner/repo@v1` needs a public repo whose
# tagged commit contains action.yml and the built dist/. This monorepo is
# private and gitignores dist/, so the action can't be consumed from here.
#
# Usage (from anywhere):
#   packages/github-action/scripts/publish-action.sh <path-to-audit-action-clone> <version>
#   e.g. publish-action.sh ~/src/rankcli-action 1.0.0
#
# The clone must be clean. The script replaces action.yml, README.md,
# LICENSE, src/ (the action's source, without tests) and dist/ in it, commits, creates tag v<version>, and moves the major tag
# (v1) to the same commit - the convention `uses: ...@v1` relies on.
set -euo pipefail

TARGET="${1:?usage: publish-action.sh <path-to-audit-action-clone> <version>}"
VERSION="${2:?usage: publish-action.sh <path-to-audit-action-clone> <version>}"
VERSION="${VERSION#v}"
MAJOR="v${VERSION%%.*}"

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: version must be X.Y.Z (got $VERSION)" >&2
  exit 1
fi

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"
TARGET="$(cd "$TARGET" && pwd)"

if [ ! -d "$TARGET/.git" ]; then
  echo "error: $TARGET is not a git clone of the public action repo" >&2
  exit 1
fi
if [ -n "$(git -C "$TARGET" status --porcelain)" ]; then
  echo "error: $TARGET has uncommitted changes" >&2
  exit 1
fi
if git -C "$TARGET" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  echo "error: tag v$VERSION already exists in $TARGET" >&2
  exit 1
fi

echo "==> Building @rankcli/agent-runtime (the action bundles it)"
(cd "$REPO_ROOT" && pnpm --filter @rankcli/agent-runtime build)

# Build first, then test: dist.test.ts runs the bundle that will be published and checks it
# carries no premium check code or secrets (CI=true makes those tests mandatory).
echo "==> Building and testing the action"
(cd "$PKG_DIR" && rm -rf dist && pnpm build && CI=true pnpm test)

# ncc writes dist/package.json ({"type":"module"}) so dist/index.js runs as
# ESM without any package.json at the action repo root. Fail loudly if a
# future ncc stops doing that.
if ! grep -q '"module"' "$PKG_DIR/dist/package.json" 2>/dev/null; then
  echo "error: dist/package.json with \"type\": \"module\" is missing - dist/index.js would not load" >&2
  exit 1
fi

echo "==> Syncing into $TARGET"
rm -rf "$TARGET/dist"
cp -R "$PKG_DIR/dist" "$TARGET/dist"
# Source maps are for debugging here; they triple the size of the repo.
find "$TARGET/dist" -name '*.map' -delete
cp "$PKG_DIR/action.yml" "$TARGET/action.yml"
cp "$PKG_DIR/README.md" "$TARGET/README.md"
cp "$PKG_DIR/LICENSE" "$TARGET/LICENSE"
# The source behind dist/, so users can read what they run (tests stay here).
rm -rf "$TARGET/src"
mkdir -p "$TARGET/src"
for f in "$PKG_DIR"/src/*.ts; do
  case "$f" in *.test.ts) ;; *) cp "$f" "$TARGET/src/" ;; esac
done

SOURCE_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
git -C "$TARGET" add -A
git -C "$TARGET" commit -q -m "Release v$VERSION

Built from rankcli.dev@$SOURCE_SHA (packages/github-action)."
git -C "$TARGET" tag -a "v$VERSION" -m "v$VERSION"
git -C "$TARGET" tag -fa "$MAJOR" -m "$MAJOR -> v$VERSION"

cat <<EOF

Staged release v$VERSION in $TARGET (commit $(git -C "$TARGET" rev-parse --short HEAD)).
Review it, then push:

  git -C "$TARGET" push origin HEAD
  git -C "$TARGET" push origin "v$VERSION"
  git -C "$TARGET" push --force origin "$MAJOR"

Then draft a GitHub release for v$VERSION (tick "Publish this Action to the
GitHub Marketplace" the first time).
EOF
