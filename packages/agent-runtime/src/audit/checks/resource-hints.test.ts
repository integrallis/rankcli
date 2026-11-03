import { describe, it, expect } from 'vitest';
import { detectThirdPartyDomains, analyzeResourceHints } from './resource-hints.js';

const URL = 'https://example.com/';

describe('third-party origins for preconnect', () => {
  it('ignores an origin used only by a lazy-loaded image (rankcli.dev #30)', () => {
    const html = `<html><head></head><body><footer><img src="https://badge.example/b.png" loading="lazy" alt=""></footer></body></html>`;
    expect(detectThirdPartyDomains(html, URL)).toEqual([]);
    expect(analyzeResourceHints(html, URL).issues.map((i) => i.code)).not.toContain('MISSING_PRECONNECT');
  });
  it('keeps an origin used by an eager image or a script', () => {
    const html = `<html><head><script src="https://cdn.example/a.js"></script></head><body><img src="https://img.example/hero.png" alt=""></body></html>`;
    expect(detectThirdPartyDomains(html, URL).sort()).toEqual(['https://cdn.example', 'https://img.example']);
  });
});
