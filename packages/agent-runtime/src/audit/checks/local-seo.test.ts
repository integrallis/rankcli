import { describe, expect, it } from 'vitest';
import { analyzeLocalSEO } from './local-seo.js';

const codes = (html: string) => analyzeLocalSEO(html, 'https://acme.dev/').issues.map((i) => i.code);

describe('LOCAL_BUSINESS_SCHEMA_MISSING', () => {
  it('is not reported for a site that shows no phone number or address (it fired on every site)', () => {
    expect(codes('<html><body><h1>Acme</h1><p>A linter for websites.</p></body></html>')).not.toContain('LOCAL_BUSINESS_SCHEMA_MISSING');
  });

  it('is reported for a page with a phone number and no LocalBusiness schema', () => {
    expect(codes('<html><body><h1>Acme Plumbing</h1><a href="tel:+14155551234">Call (415) 555-1234</a></body></html>')).toContain('LOCAL_BUSINESS_SCHEMA_MISSING');
  });
});
