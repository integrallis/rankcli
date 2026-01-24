/**
 * WASM Entry Point
 *
 * This is the entry point for the code that gets embedded in WASM.
 * It's a minimal build that only includes sync checks (no network requests).
 *
 * Build with: tsup src/wasm-entry.ts --format esm --minify
 */

// Import and re-export the WASM adapter
import './wasm-adapter.js';

// Export types that might be needed
export type { AuditIssue, AuditReport } from './audit/types.js';
