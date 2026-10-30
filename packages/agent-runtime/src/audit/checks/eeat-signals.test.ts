import { describe, it, expect } from 'vitest';
import { detectYMYL } from './eeat-signals.js';

const page = (title: string, body: string) => `<html><head><title>${title}</title></head><body><h1>${title}</h1><p>${body}</p></body></html>`;

describe('detectYMYL', () => {
  it('does not flag an SEO tool page for "warning", "price" or "health score"', () => {
    const html = page('Pricing - RankCLI', 'Plans start at $9. Fix every warning and error. Health scores for crawlability. Buy once, cancel any time. Terms and privacy law.');
    expect(detectYMYL(html, 'https://rankcli.dev/pricing')).toBe(false);
  });

  it('flags pages about health, money or legal matters', () => {
    expect(detectYMYL(page('Early symptoms of diabetes', 'Short intro.'), 'https://x.dev/a')).toBe(true);
    expect(detectYMYL(page('How to refinance your mortgage', 'Short intro.'), 'https://x.dev/b')).toBe(true);
    expect(detectYMYL(page('Finding a divorce lawyer', 'Short intro.'), 'https://x.dev/c')).toBe(true);
  });

  it('flags a body that keeps returning to one topic, not a single mention', () => {
    const topical = 'Our loans and mortgages: compare loans, mortgage rates, credit scores and insurance. '.repeat(3) + 'word '.repeat(100);
    expect(detectYMYL(page('Our guide', topical), 'https://x.dev/guide')).toBe(true);
    const passing = 'We once mentioned insurance. ' + 'word '.repeat(400);
    expect(detectYMYL(page('Our guide', passing), 'https://x.dev/guide')).toBe(false);
  });

  it('uses the URL path', () => {
    expect(detectYMYL(page('Guide', 'text'), 'https://x.dev/health/sleep')).toBe(true);
    expect(detectYMYL(page('Guide', 'text'), 'https://x.dev/healthcheck')).toBe(false);
  });
});
