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

const PLACEHOLDER = 'null; // __INJECT_PRODUCTION_CONFIG__';

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

  const config = {
    supabaseUrl,
    supabaseAnonKey,
    webAppUrl,
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
    
    if (!content.includes(PLACEHOLDER)) {
      console.warn(`⚠️  Skipping ${relPath} (placeholder not found - already injected?)`);
      continue;
    }

    content = content.replace(PLACEHOLDER, replacement);
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
