#!/usr/bin/env node
/**
 * verify-premium-audit.js - end to end: the built CLI (dist/index.js) runs the premium checks.
 *
 * Serves a small page locally and audits it twice - with the decrypt passphrase
 * (RANKCLI_BUILD_KEY, or the dev key) and without - and fails unless the first run reports
 * premium checks the second can't. verify-wasm.js proves the WASM holds the right code; this
 * proves the CLI actually decrypts and runs it. Used by build-cli.yml before publishing.
 */
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { mkdtempSync } = require('fs');
const { tmpdir } = require('os');

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Acme Widgets - Pricing</title><meta name="description" content="Acme widgets pricing and plans.">
</head><body><h1>Pricing</h1><p>Acme widgets help teams ship faster. Plans start at $9 per month.</p>
<h2>What is a widget?</h2><p>A widget is a small tool.</p></body></html>`;

// Asynchronous on purpose: this process also serves the page, and a blocking execFileSync
// would leave the CLI's requests to it hanging.
function audit(url, passphrase) {
  const env = { ...process.env, RANKCLI_CONFIG_DIR: mkdtempSync(path.join(tmpdir(), 'rankcli-verify-')) };
  delete env.RANKCLI_API_KEY;
  if (passphrase) env.RANKCLI_BUILD_KEY = passphrase;
  else delete env.RANKCLI_BUILD_KEY;
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, '..', 'dist', 'index.js'), 'audit', '--url', url, '-o', 'json'], {
      env, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024,
    }, (error, stdout) => {
      // A gated or failed audit still prints its JSON report; only a missing report is an error.
      try {
        const report = JSON.parse(stdout);
        resolve(new Set((report.issues || []).map((i) => i.code)));
      } catch {
        reject(new Error(`the CLI printed no JSON report${error ? ` (${error.message})` : ''}`));
      }
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
  } else {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    const withKey = await audit(url, process.env.RANKCLI_BUILD_KEY || 'dev');
    const without = await audit(url, '');
    const premiumOnly = [...withKey].filter((code) => !without.has(code));
    if (premiumOnly.length === 0) {
      console.error(`verify-premium-audit: no premium checks ran (${withKey.size} issues with the passphrase, ${without.size} without)`);
      process.exitCode = 1;
    } else {
      console.log(`verify-premium-audit: ok - ${premiumOnly.length} premium checks reported (e.g. ${premiumOnly.slice(0, 3).join(', ')})`);
    }
  } catch (error) {
    console.error(`verify-premium-audit: ${error.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
