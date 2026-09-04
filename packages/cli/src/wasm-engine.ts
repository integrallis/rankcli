/**
 * WASM Engine Wrapper
 *
 * Bridges the WASM binary (which contains AES-encrypted paid-tier check
 * source) with Node.js execution:
 *
 * 1. WASM decrypts the JS code using a fixed, build-embedded passphrase
 * 2. We get the decrypted code from WASM
 * 3. We execute it in a Node.js VM sandbox
 * 4. Individual premium check functions are called from that sandbox
 *
 * This is code protection, not access control: entitlement (is this user
 * actually paid?) is decided by the caller, from the real Supabase-backed
 * apiKey/plan the CLI validates on login - see commands/audit.ts. This
 * module should only ever be initialized after that check passes; there
 * is no per-user license key, and passing an arbitrary string here does
 * not grant anything a validated apiKey didn't already grant.
 */

import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { AuditIssue } from '@rankcli/agent-runtime';

export type PremiumCheckFn = (html: string, url: string) => { issues: AuditIssue[]; data: unknown };

const PREMIUM_CHECK_NAMES = [
  'analyzeFeaturedSnippet',
  'analyzeInternalLinkGraph',
  'analyzeEEATSignals',
  'analyzeContentScience',
  'analyzeKeywordCannibalizationSinglePage',
  'analyzeConversionElements',
  'analyzeKeywordPlacement',
  'analyzeTopicalClusters',
  'analyzePlatformPresence',
  'analyzeInteractiveTools',
  'analyzeFunnelIntent',
  'analyzeNavBoostSignals',
  'analyzeEntitySEO',
  'analyzeFreshnessSignals',
  'analyzeAIContentStructure',
  'analyzeRAGChunkReadiness',
  'analyzeCitationQuality',
  'analyzeAnswerConciseness',
  'analyzeBrandMentionOptimization',
  'analyzeAICitationWorthiness',
  'analyzeReviewEcosystem',
] as const;

export type PremiumChecks = Record<(typeof PREMIUM_CHECK_NAMES)[number], PremiumCheckFn>;

// WASM module interface
interface WasmEngine {
  init_engine(passphrase: string): boolean;
  get_decrypted_code(): string;
  version(): string;
  is_initialized(): boolean;
  get_encrypted_size(): number;
}

let wasmModule: WasmEngine | null = null;
let auditContext: vm.Context | null = null;

/**
 * Load the WASM module.
 *
 * Node's Single Executable Application (SEA) build - used for the
 * Homebrew/Scoop native binary - bundles this whole file into one
 * standalone executable with no sibling files on disk, so the normal
 * npm-package lookup below (relative to __dirname) can never find
 * anything there. That build embeds the WASM glue JS + .wasm binary as
 * SEA assets instead (see scripts/build-sea.sh's sea-config.json) and
 * extracts them to a real temp file on first use, after which the
 * extracted glue file's own (unmodified, wasm-pack-generated)
 * sibling-file lookup works exactly like the npm-package case.
 */
async function loadWasm(): Promise<WasmEngine> {
  if (wasmModule) return wasmModule;

  const sea = require('node:sea') as typeof import('node:sea');
  if (sea.isSea()) {
    // A SEA main script's plain require() only loads built-in modules -
    // loading the extracted file from disk needs its own createRequire(),
    // per Node's own error message when this was first tried directly.
    const gluePath = extractSeaWasmAssets();
    const dynamicRequire = require('module').createRequire(gluePath);
    wasmModule = dynamicRequire(gluePath) as WasmEngine;
    return wasmModule;
  }

  // Try to load from pkg directory (development) or wasm directory (production)
  const possiblePaths = [
    path.join(__dirname, '../native/pkg/rankcli_audit_engine.js'),
    path.join(__dirname, '../wasm/rankcli_audit_engine.js'),
    path.join(__dirname, '../../native/pkg/rankcli_audit_engine.js'),
  ];

  for (const wasmPath of possiblePaths) {
    if (fs.existsSync(wasmPath)) {
      wasmModule = require(wasmPath) as WasmEngine;
      return wasmModule;
    }
  }

  throw new Error(
    'WASM engine not found. Run `npm run build:wasm` first.\n' +
    `Searched: ${possiblePaths.join(', ')}`
  );
}

/**
 * Extract the SEA-embedded WASM glue JS + binary to a real directory on
 * disk (skipping re-extraction if a same-size copy is already there -
 * cheap and avoids rewriting on every invocation of an installed
 * binary), and return the extracted glue file's path to require().
 */
function extractSeaWasmAssets(): string {
  const sea = require('node:sea') as typeof import('node:sea');
  const dir = path.join(os.tmpdir(), 'rankcli-wasm-sea');
  fs.mkdirSync(dir, { recursive: true });

  const glueAsset = sea.getRawAsset('rankcli_audit_engine.js');
  const wasmAsset = sea.getRawAsset('rankcli_audit_engine_bg.wasm');
  if (typeof glueAsset === 'string' || typeof wasmAsset === 'string') {
    throw new Error('SEA assets returned as string, expected binary ArrayBuffer');
  }
  const glueBuffer = Buffer.from(glueAsset);
  const wasmBuffer = Buffer.from(wasmAsset);
  const gluePath = path.join(dir, 'rankcli_audit_engine.js');
  const wasmPath = path.join(dir, 'rankcli_audit_engine_bg.wasm');

  const existingSize = fs.existsSync(wasmPath) ? fs.statSync(wasmPath).size : -1;
  if (existingSize !== wasmBuffer.length) {
    fs.writeFileSync(gluePath, glueBuffer);
    fs.writeFileSync(wasmPath, wasmBuffer);
  }

  return gluePath;
}

/**
 * Decrypt the embedded premium checks and prepare them for execution.
 * Only call this once the caller has independently confirmed the user is
 * entitled to premium checks (a validated paid apiKey) - see the module
 * doc comment above.
 */
export async function initEngine(decryptPassphrase: string): Promise<void> {
  const wasm = await loadWasm();

  try {
    wasm.init_engine(decryptPassphrase);
  } catch (error) {
    throw new Error(`Failed to decrypt premium checks: ${error}`);
  }

  if (!wasm.is_initialized()) {
    throw new Error('Failed to decrypt premium checks: engine did not initialize');
  }

  const jsCode = wasm.get_decrypted_code();
  createExecutionContext(jsCode);
}

/**
 * Create a sandboxed VM context for executing the decrypted checks
 */
function createExecutionContext(jsCode: string): void {
  // Create a minimal sandbox with only what the checks need
  const sandbox = {
    // Console for debugging (can be disabled in production)
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    // Timers (some checks may use setTimeout)
    setTimeout,
    clearTimeout,
    // JSON parsing
    JSON,
    // Math operations
    Math,
    // String/Array operations
    String,
    Array,
    Object,
    RegExp,
    Date,
    // URL parsing
    URL,
    URLSearchParams,
    // Node.js globals needed by bundled dependencies (e.g., cheerio)
    Buffer,
    process: { env: {} },
    // TextEncoder/TextDecoder for string handling
    TextEncoder,
    TextDecoder,
    // The RankCLI namespace will be populated by the code
    RankCLI: {},
    // Global reference
    globalThis: {} as Record<string, unknown>,
  };

  // Self-reference
  sandbox.globalThis = sandbox;

  // Create the context
  auditContext = vm.createContext(sandbox);

  // Execute the decrypted code to populate RankCLI namespace
  try {
    vm.runInContext(jsCode, auditContext, {
      filename: 'rankcli-checks.js',
      timeout: 5000, // 5 second timeout for initialization
    });
  } catch (error) {
    throw new Error(`Failed to initialize audit checks: ${error}`);
  }
}

/**
 * Call one premium check function living inside the sandbox. Arguments
 * and the result cross the VM boundary as JSON, matching every premium
 * check's (html, url) -> { issues, data } shape.
 */
function callSandboxCheck(fnName: string, html: string, url: string): { issues: AuditIssue[]; data: unknown } {
  if (!auditContext) {
    throw new Error('Engine not initialized. Call initEngine() first.');
  }

  const script = new vm.Script(`
    (function() {
      if (typeof RankCLI.${fnName} !== 'function') {
        throw new Error('RankCLI.${fnName} not found in decrypted code');
      }
      return JSON.stringify(RankCLI.${fnName}(${JSON.stringify(html)}, ${JSON.stringify(url)}));
    })()
  `);

  const resultJson = script.runInContext(auditContext, { timeout: 10000 }) as string;
  return JSON.parse(resultJson) as { issues: AuditIssue[]; data: unknown };
}

/**
 * Build a PremiumChecks object (matching agent-runtime's
 * premium-checks.types.ts) whose methods each call into the decrypted
 * VM sandbox. Pass the result as runFullAudit({ premiumChecks }).
 */
export async function getPremiumChecks(): Promise<PremiumChecks> {
  const wasm = await loadWasm();
  if (!wasm.is_initialized()) {
    throw new Error('Engine not initialized. Call initEngine() first.');
  }

  const checks = {} as PremiumChecks;
  for (const name of PREMIUM_CHECK_NAMES) {
    checks[name] = (html: string, url: string) => callSandboxCheck(name, html, url);
  }
  return checks;
}

/**
 * Get engine version info
 */
export async function getVersion(): Promise<string> {
  const wasm = await loadWasm();
  return wasm.version();
}

/**
 * Check if engine is ready
 */
export async function isReady(): Promise<boolean> {
  try {
    const wasm = await loadWasm();
    return wasm.is_initialized();
  } catch {
    return false;
  }
}
