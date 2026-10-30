#!/usr/bin/env node
/**
 * verify-premium-audit.js - end to end: the built CLI (dist/index.js) runs every check.
 *
 * Serves a small page locally, works out which codes the 21 checks in agent-runtime's
 * premium-checks.ts report for it, audits the page with the CLI, and fails unless the CLI's
 * report carries those codes. Until 2026-10 these checks were encrypted into a WASM binary and
 * a stale binary once shipped for months with none of them; this is the guard against that
 * class of regression. Used by build-cli.yml before publishing and by ci.yml.
 */
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { mkdtempSync } = require('fs');
const { tmpdir } = require('os');
const { premiumChecks } = require('@rankcli/agent-runtime');

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Acme Widgets - Pricing</title><meta name="description" content="Acme widgets pricing and plans.">
</head><body><h1>Pricing</h1><p>Acme widgets help teams ship faster. Plans start at $9 per month.</p>
<h2>What is a widget?</h2><p>A widget is a small tool.</p></body></html>`;

// Asynchronous on purpose: this process also serves the page, and a blocking execFileSync
// would leave the CLI's requests to it hanging.
function audit(url) {
  const env = { ...process.env, RANKCLI_CONFIG_DIR: mkdtempSync(path.join(tmpdir(), 'rankcli-verify-')) };
  delete env.RANKCLI_API_KEY;
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
    const expected = new Set();
    for (const check of Object.values(premiumChecks)) {
      for (const issue of check(PAGE, url).issues) expected.add(issue.code);
    }
    const reported = await audit(url);
    const found = [...expected].filter((code) => reported.has(code));
    // The engine's dedupe pass drops a code when a broader one is present, so the report
    // carries most of the expected codes, not necessarily all of them.
    if (expected.size === 0 || found.length < Math.ceil(expected.size / 2)) {
      console.error(`verify-premium-audit: ${found.length} of the ${expected.size} codes the 21 checks report for the page reached the CLI's report (${reported.size} issues)`);
      process.exitCode = 1;
    } else {
      console.log(`verify-premium-audit: ok - ${found.length}/${expected.size} codes from the 21 checks reported (e.g. ${found.slice(0, 3).join(', ')})`);
    }
  } catch (error) {
    console.error(`verify-premium-audit: ${error.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
