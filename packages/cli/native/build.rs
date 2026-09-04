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
    println!("cargo:rerun-if-changed=../node_modules/@rankcli/agent-runtime/dist/index.mjs");
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
    // The agent-runtime package contains the SEO checks. Two possible
    // layouts:
    //   - Inside the pnpm monorepo: a sibling `packages/agent-runtime`
    //     directory, pnpm-workspace-linked, which may also have the
    //     Deno/WASM-specific bundles built (`pnpm build:wasm`).
    //   - A standalone repo (e.g. a public mirror of this package)
    //     installing `@rankcli/agent-runtime` as a normal npm dependency
    //     into node_modules — that package only ever ships the regular
    //     `dist/index.mjs` bundle (confirmed via `npm pack --dry-run`:
    //     no `dist/wasm/*` files are published), so only the third
    //     candidate in each list below will ever resolve there.
    // Every candidate is tried in order; the first one that exists wins.
    let candidates: [(&str, &str); 6] = [
        ("../../agent-runtime/dist/wasm/wasm-adapter.global.js", "monorepo IIFE bundle"),
        ("../../agent-runtime/dist/wasm/wasm-entry.mjs", "monorepo ESM WASM bundle"),
        ("../../agent-runtime/dist/index.mjs", "monorepo regular bundle"),
        ("../node_modules/@rankcli/agent-runtime/dist/wasm/wasm-adapter.global.js", "npm-installed IIFE bundle"),
        ("../node_modules/@rankcli/agent-runtime/dist/wasm/wasm-entry.mjs", "npm-installed ESM WASM bundle"),
        ("../node_modules/@rankcli/agent-runtime/dist/index.mjs", "npm-installed regular bundle"),
    ];

    for (candidate, description) in candidates {
        let path = Path::new(candidate);
        if path.exists() {
            println!("cargo:warning=Embedding {} from {}", description, candidate);
            return fs::read_to_string(path).expect("Failed to read JS bundle");
        }
    }

    // Placeholder for local development — neither layout found a bundle.
    println!("cargo:warning=agent-runtime not found in any known location (monorepo or node_modules) - using placeholder checks. Run `npm install` or `pnpm install` first.");
    include_str!("src/placeholder_checks.js").to_string()
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
