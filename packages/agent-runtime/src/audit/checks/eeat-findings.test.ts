import { describe, expect, it } from 'vitest';
import { analyzeEEATSignals } from './eeat-signals.js';

const codes = (html: string, url = 'https://acme.dev/') => analyzeEEATSignals(html, url).issues.map((i) => i.code);

describe('REVIEW_NO_VIDEO', () => {
  it('does not fire because "best" or "review" appears somewhere in the HTML (it fired on every site)', () => {
    const html = '<html><head><title>Acme - ship code, get ranked</title></head><body><h1>Acme</h1><p>The best way to review your SEO before deploy. Top 10 checks.</p></body></html>';
    expect(codes(html)).not.toContain('REVIEW_NO_VIDEO');
  });

  it('fires on a page whose title says it is a review', () => {
    const html = '<html><head><title>Acme Widget review: six months in</title></head><body><h1>Acme Widget review</h1><p>We tested it.</p></body></html>';
    expect(codes(html, 'https://blog.example/acme-review')).toContain('REVIEW_NO_VIDEO');
  });
});
