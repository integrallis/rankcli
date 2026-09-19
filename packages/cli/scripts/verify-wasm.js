#!/usr/bin/env node
/**
 * verify-wasm.js - proves the WASM about to ship is the one just built.
 *
 * Checks that wasm/ decrypts with the build passphrase (RANKCLI_BUILD_KEY, or the dev key),
 * that the decrypted code contains the premium checks, and that it is byte-for-byte the
 * agent-runtime bundle that build.rs encrypted. Releases used to publish a WASM from February:
 * `cp -r pkg ../wasm` nested each fresh build in wasm/pkg/ and left the stale committed
 * wasm/*.wasm in place, while the "verification" only checked that init_engine existed.
 *
 * Runs at the end of `pnpm build:wasm`, and in build-cli.yml / native-release.yml.
 */
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`verify-wasm: ${message}`);
  process.exit(1);
}

const passphrase = process.env.RANKCLI_BUILD_KEY || 'dev';
const gluePath = path.join(__dirname, '..', 'wasm', 'rankcli_audit_engine.js');
if (!fs.existsSync(gluePath)) fail(`${gluePath} is missing - run pnpm build:wasm`);

const wasm = require(gluePath);
try {
  wasm.init_engine(passphrase);
} catch (error) {
  fail(`the passphrase does not decrypt the embedded checks (${error})`);
}
if (!wasm.is_initialized()) fail('the engine did not initialize after decrypting');

const code = wasm.get_decrypted_code();
for (const marker of ['analyzeNavBoostSignals', 'Commercial page without clear CTA']) {
  if (!code.includes(marker)) fail(`the embedded checks don't include the premium checks (no "${marker}")`);
}

// In the monorepo, the embedded code must be exactly the bundle just built.
const bundlePath = path.join(__dirname, '..', '..', 'agent-runtime', 'dist', 'wasm', 'wasm-adapter.global.js');
if (fs.existsSync(bundlePath) && code !== fs.readFileSync(bundlePath, 'utf8')) {
  fail(`wasm/ does not embed the current ${bundlePath} - it is stale`);
}

console.log(`verify-wasm: ok - ${code.length} bytes of checks, premium included${fs.existsSync(bundlePath) ? ', matches the fresh bundle' : ''}`);
