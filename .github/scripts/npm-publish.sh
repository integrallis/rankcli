#!/usr/bin/env bash
# Publish the package in the current directory unless that version is already on npm.
# Trusted Publishing (OIDC) first; the NPM_TOKEN secret as a fallback, with a warning,
# until the package is linked to this repository and workflow on npmjs.com.
set -euo pipefail
NAME="${1:?usage: npm-publish.sh <package-name>}"
VERSION=$(node -p "require('./package.json').version")
if npm view "$NAME@$VERSION" version >/dev/null 2>&1; then
  echo "$NAME@$VERSION is already on npm, skipping"
  exit 0
fi
if npm publish --access public --ignore-scripts; then
  echo "published $NAME@$VERSION (Trusted Publishing)"
elif [ -n "${NPM_TOKEN:-}" ] && NODE_AUTH_TOKEN="$NPM_TOKEN" npm publish --access public --ignore-scripts; then
  echo "published $NAME@$VERSION with NPM_TOKEN"
  echo "::warning::$NAME is not linked to Trusted Publishing from this repository, so this used the token. A maintainer with 2FA links it once: npx npm@latest trust github $NAME --repo integrallis/rankcli --file release.yml --allow-publish"
else
  echo "::error::$NAME@$VERSION was not published: Trusted Publishing is not linked to integrallis/rankcli + release.yml and no working NPM_TOKEN exists."
  exit 1
fi
