/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const get_checks_limit: () => number;
export const get_decrypted_code: () => [number, number, number, number];
export const get_encrypted_size: () => number;
export const get_tier: () => [number, number];
export const init_engine: (a: number, b: number) => [number, number, number];
export const is_initialized: () => number;
export const validate_license: (a: number, b: number) => [number, number];
export const version: () => [number, number];
export const __wbindgen_externrefs: WebAssembly.Table;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_start: () => void;
