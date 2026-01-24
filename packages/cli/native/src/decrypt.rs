//! Decryption for embedded JavaScript checks

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};

/// Derive encryption key from license key
/// Must match the derivation in build.rs exactly
pub fn derive_key(license_key: &str) -> [u8; 32] {
    let input = format!("{}rankcli-v1-2024", license_key);
    let mut result = [0u8; 32];

    // FNV-1a style hashing to fill 32 bytes
    // This is deterministic and matches build.rs
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

/// Decrypt the embedded JS checks
pub fn decrypt_checks(
    key: &[u8; 32],
    encrypted: &[u8],
    nonce: &[u8; 12],
) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Cipher init failed: {}", e))?;

    let nonce = Nonce::from_slice(nonce);

    let decrypted = cipher
        .decrypt(nonce, encrypted)
        .map_err(|_| "Invalid license key".to_string())?;

    String::from_utf8(decrypted)
        .map_err(|e| format!("Invalid UTF-8: {}", e))
}
