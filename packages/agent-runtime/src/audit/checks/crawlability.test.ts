import { describe, it, expect } from 'vitest';
import { validateLastmodValues } from './crawlability.js';

describe('validateLastmodValues', () => {
  it('reports zero count when there are no lastmod tags', () => {
    const xml = '<urlset><url><loc>https://example.com/</loc></url></urlset>';
    expect(validateLastmodValues(xml)).toMatchObject({ count: 0, invalidCount: 0 });
  });

  it('accepts valid date-only and full datetime lastmod values', () => {
    const xml = `
      <urlset>
        <url><loc>https://example.com/a</loc><lastmod>2026-01-15</lastmod></url>
        <url><loc>https://example.com/b</loc><lastmod>2026-01-15T10:00:00Z</lastmod></url>
        <url><loc>https://example.com/c</loc><lastmod>2026-01-15T10:00:00+02:00</lastmod></url>
      </urlset>
    `;
    expect(validateLastmodValues(xml)).toMatchObject({ count: 3, invalidCount: 0 });
  });

  it('flags malformed lastmod values', () => {
    const xml = `
      <urlset>
        <url><loc>https://example.com/a</loc><lastmod>not-a-date</lastmod></url>
        <url><loc>https://example.com/b</loc><lastmod>01/15/2026</lastmod></url>
      </urlset>
    `;
    expect(validateLastmodValues(xml)).toMatchObject({ count: 2, invalidCount: 2 });
  });

  it('calls ten or more identical lastmod days uniform, and a spread of dates not', () => {
    const same = `<urlset>${Array.from({ length: 12 }, (_, i) => `<url><loc>https://e.com/${i}</loc><lastmod>2026-01-15T10:00:00Z</lastmod></url>`).join('')}</urlset>`;
    expect(validateLastmodValues(same)).toMatchObject({ count: 12, invalidCount: 0, uniform: true, sample: '2026-01-15T10:00:00Z' });
    const spread = `<urlset>${Array.from({ length: 12 }, (_, i) => `<url><loc>https://e.com/${i}</loc><lastmod>2026-01-${String(1 + i).padStart(2, '0')}</lastmod></url>`).join('')}</urlset>`;
    expect(validateLastmodValues(spread).uniform).toBe(false);
    // A small sitemap built in one go is not a generator stamping dates.
    const few = `<urlset>${Array.from({ length: 3 }, (_, i) => `<url><loc>https://e.com/${i}</loc><lastmod>2026-01-15</lastmod></url>`).join('')}</urlset>`;
    expect(validateLastmodValues(few).uniform).toBe(false);
  });

  it('flags future-dated lastmod values', () => {
    const xml = `<urlset><url><loc>https://example.com/</loc><lastmod>2099-01-01</lastmod></url></urlset>`;
    expect(validateLastmodValues(xml)).toMatchObject({ count: 1, invalidCount: 1 });
  });

  it('counts a mix of valid and invalid entries correctly', () => {
    const xml = `
      <urlset>
        <url><loc>https://example.com/a</loc><lastmod>2026-01-15</lastmod></url>
        <url><loc>https://example.com/b</loc><lastmod>garbage</lastmod></url>
      </urlset>
    `;
    expect(validateLastmodValues(xml)).toMatchObject({ count: 2, invalidCount: 1 });
  });
});
