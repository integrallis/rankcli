//! Build script - embeds encrypted JS checks at compile time
//!
//! During `cargo build`:
//! 1. Reads compiled JS from ../dist/index.mjs
//! 2. Encrypts with AES-256-GCM
//! 3. Generates Rust code with embedded bytes

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::Rng;
use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=../../agent-runtime/dist/wasm/wasm-adapter.global.js");
    println!("cargo:rerun-if-env-changed=RANKCLI_BUILD_KEY");

    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("embedded_checks.rs");

    // Read compiled JS checks
    let js_code = read_js_bundle();

    // Get encryption key from CI environment
    let key = get_encryption_key();

    // Generate random nonce
    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; 12] = rng.gen();
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
    let encrypted = cipher
        .encrypt(nonce, js_code.as_bytes())
        .expect("Encryption failed");

    // Generate Rust code
    let rust_code = format!(
        r#"
/// Encrypted JavaScript checks (AES-256-GCM)
pub const ENCRYPTED_CHECKS: &[u8] = &{:?};

/// Encryption nonce
pub const ENCRYPTION_NONCE: &[u8; 12] = &{:?};

/// Original size for verification
pub const ORIGINAL_SIZE: usize = {};
"#,
        encrypted.as_slice(),
        nonce_bytes,
        js_code.len()
    );

    fs::write(&dest_path, rust_code).unwrap();
    println!("cargo:warning=Embedded {} bytes of encrypted JS", encrypted.len());
}

fn read_js_bundle() -> String {
    // The agent-runtime package contains the SEO checks
    // We use the IIFE bundle that sets globalThis.RankCLI
    let iife_bundle_path = Path::new("../../agent-runtime/dist/wasm/wasm-adapter.global.js");
    let wasm_bundle_path = Path::new("../../agent-runtime/dist/wasm/wasm-entry.mjs");
    let regular_bundle_path = Path::new("../../agent-runtime/dist/index.mjs");

    if iife_bundle_path.exists() {
        println!("cargo:warning=Embedding IIFE bundle from agent-runtime/dist/wasm/wasm-adapter.global.js");
        fs::read_to_string(iife_bundle_path).expect("Failed to read IIFE JS bundle")
    } else if wasm_bundle_path.exists() {
        println!("cargo:warning=IIFE bundle not found, using ESM bundle (rebuild with pnpm build:wasm)");
        fs::read_to_string(wasm_bundle_path).expect("Failed to read WASM JS bundle")
    } else if regular_bundle_path.exists() {
        println!("cargo:warning=WASM bundles not found, using regular bundle");
        fs::read_to_string(regular_bundle_path).expect("Failed to read JS bundle")
    } else {
        // Placeholder for local development
        println!("cargo:warning=agent-runtime not built - using placeholder checks");
        include_str!("src/placeholder_checks.js").to_string()
    }
}

fn get_encryption_key() -> [u8; 32] {
    match env::var("RANKCLI_BUILD_KEY") {
        Ok(key_b64) => {
            let bytes = STANDARD.decode(&key_b64).expect("Invalid base64 key");
            bytes.try_into().expect("Key must be 32 bytes")
        }
        Err(_) => {
            println!("cargo:warning=Using dev key! Set RANKCLI_BUILD_KEY in production");
            // Development-only key: SHA-256("dev" + salt)
            // This matches what decrypt.rs will derive from license_key="dev"
            derive_key("dev")
        }
    }
}

/// Derive encryption key from license (must match decrypt.rs exactly)
fn derive_key(license_key: &str) -> [u8; 32] {
    let input = format!("{}rankcli-v1-2024", license_key);
    let mut result = [0u8; 32];

    // FNV-1a style hashing - must match decrypt.rs
    for i in 0..4 {
        let mut hash: u64 = 0xcbf29ce484222325; // FNV offset basis
        for byte in input.as_bytes() {
            hash ^= *byte as u64;
            hash = hash.wrapping_mul(0x100000001b3); // FNV prime
        }
        hash ^= i as u64;
        hash = hash.wrapping_mul(0x100000001b3);
        result[i * 8..(i + 1) * 8].copy_from_slice(&hash.to_le_bytes());
    }

    result
}
