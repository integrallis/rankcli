#!/usr/bin/env node
'use strict';

// The CLI bundle (dist/index.js) is CommonJS and require()s ESM-only
// dependencies (chalk 5, conf 12, inquirer 9, open 10). Node runs
// require() of an ES module without a flag from 20.19 and 22.12 on; older
// versions crash with ERR_REQUIRE_ESM before printing anything useful.
// Check first so `npx @rankcli/cli` on an old Node says what to do.
const [major, minor] = process.versions.node.split('.').map(Number);
const supported = major >= 23 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);

if (!supported) {
  console.error(`rankcli needs Node.js 20.19+ or 22.12+ (this is ${process.versions.node}).`);
  console.error('Upgrade Node (https://nodejs.org), or use the standalone binary: brew install integrallis/tap/rankcli');
  process.exit(1);
}

require('../dist/index.js');
