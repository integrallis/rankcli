# RankCLI Native WASM Engine

This directory contains the Rust code that compiles to WebAssembly with the SEO checks embedded inside.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         BUILD PIPELINE                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  packages/agent-runtime/src/     TypeScript source (280+ checks)    │
│              ↓                                                      │
│  pnpm build                      Compiles to dist/index.mjs         │
│              ↓                                                      │
│  packages/cli/native/build.rs    Reads & encrypts the JS            │
│              ↓                                                      │
│  cargo build / wasm-pack         Embeds encrypted bytes in binary   │
│              ↓                                                      │
│  rankcli_audit_engine.wasm       Final binary (~2-5MB)              │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## What Ships to Users

```
npm install rankcli
    ↓
node_modules/rankcli/
├── dist/
│   └── index.js          # CLI entry point
├── wasm/
│   └── rankcli.wasm      # WASM binary (encrypted JS inside)
└── package.json
```

**Users NEVER see:**
- The TypeScript source code
- The compiled JavaScript checks
- Any readable logic

## Security

| Layer | Protection |
|-------|------------|
| Encryption | AES-256-GCM with build-time key |
| Key derivation | License key → SHA-256 → decryption key |
| Runtime | QuickJS sandbox inside WASM |
| Tier enforcement | Compiled into binary |

## Building

### Development (placeholder checks)

```bash
cd packages/cli/native
wasm-pack build --target nodejs --dev
```

### Production (full 280+ checks)

```bash
# 1. Build agent-runtime first
cd packages/agent-runtime
pnpm build

# 2. Set encryption key (from CI secrets)
export RANKCLI_BUILD_KEY=$(cat /path/to/key.txt)

# 3. Build WASM
cd ../cli/native
wasm-pack build --target nodejs --release
```

## Files

| File | Purpose |
|------|---------|
| `Cargo.toml` | Rust dependencies |
| `build.rs` | Reads JS, encrypts, embeds at compile time |
| `src/lib.rs` | WASM entry points (init_engine, run_audit) |
| `src/decrypt.rs` | AES-256-GCM decryption |
| `src/runtime.rs` | QuickJS wrapper (executes decrypted JS) |
| `src/placeholder_checks.js` | Dev fallback when agent-runtime not built |

## CI/CD Integration

```yaml
# .github/workflows/build.yml
jobs:
  build-wasm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build agent-runtime
        run: cd packages/agent-runtime && pnpm build

      - name: Build WASM
        env:
          RANKCLI_BUILD_KEY: ${{ secrets.WASM_BUILD_KEY }}
        run: |
          cd packages/cli/native
          wasm-pack build --target nodejs --release

      - name: Package
        run: |
          mkdir -p packages/cli/wasm
          cp packages/cli/native/pkg/*.wasm packages/cli/wasm/
```

## Next Steps

1. **QuickJS Integration**: Replace placeholder in `runtime.rs` with actual rquickjs
2. **License Validation**: Add proper JWT/signature verification
3. **CI Pipeline**: Set up GitHub Actions for multi-platform builds
