import { describe, it, expect } from 'vitest';
import { analyzeResponsiveImages } from './responsive-images.js';

const URL = 'https://example.com/';

function img(n: number, attrs = ''): string {
  return Array.from({ length: n }, (_, i) => `<img src="/i${i}.png" alt="i${i}" ${attrs}>`).join('');
}

async function codes(html: string) {
  const result = await analyzeResponsiveImages(html, URL);
  const issues = Array.isArray(result) ? result : (result.issues ?? []);
  return issues.map((i) => ({ code: i.code, severity: i.severity }));
}

describe('responsive images', () => {
  // `--fail-on error` exits 1, so this severity decides whether someone's build breaks.
  // At error, a sweep on 2026-09-28 failed svelte.dev, tailwindcss.com, rust-lang.org,
  // laravel.com and fastapi.tiangolo.com - all over missing width/height. A linter that breaks
  // the build of five well-built sites gets uninstalled.
  it('does not fail a build over images missing dimensions', async () => {
    const found = await codes(`<html><body>${img(6)}</body></html>`);
    const dimension = found.filter((f) => f.code === 'IMAGES_MISSING_DIMENSIONS');
    expect(dimension.length).toBeGreaterThan(0);
    for (const d of dimension) expect(d.severity).not.toBe('error');
  });

  it('still reports it, and reports more of them louder', async () => {
    const many = await codes(`<html><body>${img(6)}</body></html>`);
    const few = await codes(`<html><body>${img(1)}</body></html>`);
    expect(many.find((f) => f.code === 'IMAGES_MISSING_DIMENSIONS')?.severity).toBe('warning');
    expect(few.find((f) => f.code === 'IMAGES_MISSING_DIMENSIONS')?.severity).toBe('notice');
  });

  it('says nothing when every image is sized', async () => {
    const found = await codes(`<html><body>${img(6, 'width="80" height="60"')}</body></html>`);
    expect(found.map((f) => f.code)).not.toContain('IMAGES_MISSING_DIMENSIONS');
  });
});
