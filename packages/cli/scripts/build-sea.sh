#!/usr/bin/env bash
# Builds a standalone Node.js Single Executable Application (SEA) binary
# for one platform. Produces a real, dependency-free executable - no
# node_modules, no separately-installed Node required to run it.
#
# Usage: build-sea.sh <label> <output-path>
#   label: linux-x86_64 | linux-aarch64 | macos-x86_64 | macos-aarch64 | windows-x86_64
#   output-path: where to write the finished binary
#
# Requires: the CLI already built (dist/index.js must exist, via
# `pnpm build:wasm && pnpm build:js`), Node >=20 on PATH (SEA support),
# and esbuild/postject available via `pnpm exec` (workspace devDependencies).
set -euo pipefail

LABEL="${1:?usage: build-sea.sh <label> <output-path>}"
OUT="${2:?usage: build-sea.sh <label> <output-path>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Git Bash on Windows represents paths as MSYS POSIX-style (e.g.
# /tmp/xyz) internally, and auto-translates them for command-line
# arguments passed to native .exe tools - but NOT for paths written into
# a file's *content*. node.exe reading sea-config.json's "main"/"output"/
# "assets" fields needs real Windows paths there, or it can't find what
# esbuild (also a native .exe) actually wrote using that same MSYS path.
to_native_path() {
  if [[ "$LABEL" == windows-* ]]; then
    # -m (not -w): forward slashes, so the result drops straight into
    # JSON without backslash-escaping, and Windows APIs accept
    # forward-slash paths natively.
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}

echo "==> [$LABEL] Bundling CLI entry point (esbuild, full bundle - no node_modules at runtime)"
# This bundles directly from src/index.ts, bypassing dist/index.js
# entirely - so inject-config.js's regex patch (which only touches the
# tsup build output) never applies here. Config needed at runtime by a
# binary nobody will run with these env vars set gets baked in instead,
# via --define replacing each process.env.X reference with a literal at
# build time. Any of these that are unset get baked in as "" (falls
# through to config.ts's own error message rather than crashing here).
#
# --define:import.meta.url separately works around an esbuild/CJS
# limitation: the `open` package reads import.meta.url at module scope
# (to locate a sidecar xdg-open script on Linux, a feature this build
# doesn't need), and esbuild's CJS shim leaves it undefined, crashing on
# load. A synthetic but valid file:// URL keeps the module loadable.
pnpm --dir "$CLI_DIR" exec esbuild "$CLI_DIR/src/index.ts" \
  --bundle --platform=node --format=cjs \
  --define:import.meta.url='"file:///rankcli-sea/index.js"' \
  --define:process.env.RANKCLI_SUPABASE_URL="\"${RANKCLI_SUPABASE_URL:-}\"" \
  --define:process.env.RANKCLI_SUPABASE_ANON_KEY="\"${RANKCLI_SUPABASE_ANON_KEY:-}\"" \
  --define:process.env.RANKCLI_WEB_URL="\"${RANKCLI_WEB_URL:-https://rankcli.dev}\"" \
  --define:process.env.RANKCLI_BUILD_KEY="\"${RANKCLI_BUILD_KEY:-}\"" \
  --outfile="$WORK/bundle.cjs"

echo "==> [$LABEL] Generating SEA blob"
# Embed the WASM glue JS + binary as SEA assets. wasm-engine.ts's
# loadWasm() extracts them to a real temp file on first use (SEA builds
# have no sibling files on disk for the normal require()-relative-path
# lookup to find) - see its module doc comment.
WASM_JS="$CLI_DIR/wasm/rankcli_audit_engine.js"
WASM_BIN="$CLI_DIR/wasm/rankcli_audit_engine_bg.wasm"
if [[ ! -f "$WASM_JS" || ! -f "$WASM_BIN" ]]; then
  echo "ERROR: WASM module not found at $WASM_JS / $WASM_BIN - run \`pnpm build:wasm\` first" >&2
  exit 1
fi
cat > "$WORK/sea-config.json" <<EOF
{
  "main": "$(to_native_path "$WORK/bundle.cjs")",
  "output": "$(to_native_path "$WORK/sea-prep.blob")",
  "disableExperimentalSEAWarning": true,
  "assets": {
    "rankcli_audit_engine.js": "$(to_native_path "$WASM_JS")",
    "rankcli_audit_engine_bg.wasm": "$(to_native_path "$WASM_BIN")"
  }
}
EOF
node --experimental-sea-config "$WORK/sea-config.json"

echo "==> [$LABEL] Copying Node runtime as the binary base"
NODE_BIN="$(node -e 'console.log(process.execPath)')"
case "$LABEL" in
  windows-*) TARGET="$WORK/rankcli.exe" ;;
  *)         TARGET="$WORK/rankcli" ;;
esac
cp "$NODE_BIN" "$TARGET"
chmod +w "$TARGET"

if [[ "$LABEL" == macos-* ]]; then
  echo "==> [$LABEL] Removing existing code signature before injection"
  codesign --remove-signature "$TARGET"
fi

echo "==> [$LABEL] Injecting SEA blob (postject)"
SENTINEL="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
if [[ "$LABEL" == macos-* ]]; then
  pnpm --dir "$CLI_DIR" exec postject "$TARGET" NODE_SEA_BLOB "$WORK/sea-prep.blob" \
    --sentinel-fuse "$SENTINEL" --macho-segment-name NODE_SEA
  echo "==> [$LABEL] Ad-hoc re-signing"
  codesign --sign - "$TARGET"
else
  pnpm --dir "$CLI_DIR" exec postject "$TARGET" NODE_SEA_BLOB "$WORK/sea-prep.blob" \
    --sentinel-fuse "$SENTINEL"
fi

mkdir -p "$(dirname "$OUT")"
cp "$TARGET" "$OUT"
chmod +x "$OUT" 2>/dev/null || true
echo "==> [$LABEL] Built $OUT"
