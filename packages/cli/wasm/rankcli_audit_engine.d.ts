/* tslint:disable */
/* eslint-disable */

/**
 * Get checks limit for current tier
 */
export function get_checks_limit(): number;

/**
 * Get the decrypted JavaScript code for execution.
 * This is called by the Node.js wrapper which runs it in a VM sandbox.
 * The code is ONLY available after successful init_engine() with valid license.
 */
export function get_decrypted_code(): string;

/**
 * Get size of encrypted payload (for debugging)
 */
export function get_encrypted_size(): number;

/**
 * Get current tier
 */
export function get_tier(): string;

/**
 * Initialize the engine with a license key.
 * Decrypts the embedded checks and stores them for execution.
 */
export function init_engine(license_key: string): boolean;

/**
 * Check if engine is initialized
 */
export function is_initialized(): boolean;

/**
 * Validate a license key and return the tier
 */
export function validate_license(license_key: string): string;

/**
 * Get version info
 */
export function version(): string;
