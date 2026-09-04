#!/usr/bin/env node
/**
 * inject-config.js
 * 
 * Injects production configuration into the built CLI bundle.
 * Run this AFTER tsup build, BEFORE npm publish.
 * 
 * Required environment variables:
 *   RANKCLI_SUPABASE_URL - Supabase project URL
 *   RANKCLI_SUPABASE_ANON_KEY - Supabase anon/public key
 *   RANKCLI_WEB_URL - Web app URL (default: https://rankcli.dev)
 *   RANKCLI_BUILD_KEY - Passphrase that decrypts the WASM-embedded
 *     premium checks (same value native/build.rs used to encrypt them).
 *     Optional here - if unset, premium checks stay undecryptable for
 *     this build, same as if RANKCLI_BUILD_KEY was unset for build.rs.
 *
 * Usage:
 *   node scripts/inject-config.js
 */

const fs = require('fs');
const path = require('path');

const DIST_FILES = [
  'dist/index.js',
  'dist/index.mjs',
];

// Regex to match any INJECTED_CONFIG = null pattern (handles various tsup outputs)
// Matches: var/const/let INJECTED_CONFIG = null; with optional whitespace
const INJECTED_CONFIG_REGEX = /(var|const|let)\s+INJECTED_CONFIG\s*=\s*null\s*;?/g;

// Also match if already injected (for re-injection)
const ALREADY_INJECTED_REGEX = /(var|const|let)\s+INJECTED_CONFIG\s*=\s*\{[^}]+\}\s*;?/g;

function main() {
  const supabaseUrl = process.env.RANKCLI_SUPABASE_URL;
  const supabaseAnonKey = process.env.RANKCLI_SUPABASE_ANON_KEY;
  const webAppUrl = process.env.RANKCLI_WEB_URL || 'https://rankcli.dev';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing required environment variables:');
    if (!supabaseUrl) console.error('   - RANKCLI_SUPABASE_URL');
    if (!supabaseAnonKey) console.error('   - RANKCLI_SUPABASE_ANON_KEY');
    console.error('\nSet these before running inject-config.js');
    process.exit(1);
  }

  const decryptPassphrase = process.env.RANKCLI_BUILD_KEY;
  if (!decryptPassphrase) {
    console.warn('⚠️  RANKCLI_BUILD_KEY not set - premium checks will be undecryptable in this build');
  }

  const config = {
    supabaseUrl,
    supabaseAnonKey,
    webAppUrl,
    ...(decryptPassphrase ? { decryptPassphrase } : {}),
  };

  const replacement = JSON.stringify(config);

  let filesUpdated = 0;

  for (const relPath of DIST_FILES) {
    const filePath = path.join(__dirname, '..', relPath);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping ${relPath} (not found)`);
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if config needs injection (null) or re-injection (already has value)
    const hasNullConfig = INJECTED_CONFIG_REGEX.test(content);
    INJECTED_CONFIG_REGEX.lastIndex = 0; // Reset regex state
    
    const hasExistingConfig = ALREADY_INJECTED_REGEX.test(content);
    ALREADY_INJECTED_REGEX.lastIndex = 0; // Reset regex state
    
    if (!hasNullConfig && !hasExistingConfig) {
      console.warn(`⚠️  Skipping ${relPath} (no INJECTED_CONFIG pattern found)`);
      continue;
    }

    // Replace the config (use var for CJS, const for ESM)
    const varType = relPath.endsWith('.mjs') ? 'const' : 'var';
    const newConfig = `${varType} INJECTED_CONFIG = ${replacement};`;
    
    if (hasNullConfig) {
      content = content.replace(INJECTED_CONFIG_REGEX, newConfig);
      INJECTED_CONFIG_REGEX.lastIndex = 0;
    } else {
      content = content.replace(ALREADY_INJECTED_REGEX, newConfig);
      ALREADY_INJECTED_REGEX.lastIndex = 0;
      console.log(`   (re-injecting existing config)`);
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Injected config into ${relPath}`);
    filesUpdated++;
  }

  if (filesUpdated === 0) {
    console.error('❌ No files were updated. Check build output.');
    process.exit(1);
  }

  console.log(`\n✅ Production config injected into ${filesUpdated} file(s)`);
  console.log(`   Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log(`   Web App URL: ${webAppUrl}`);
}

main();
