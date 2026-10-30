import { describe, it, expect } from 'vitest';
import { analyzeBrandMentionOptimization } from './brand-mention-optimization.js';

const page = (body: string) =>
  `<html><head><title>Acme</title></head><body><main>${body}</main></body></html>`;

describe('analyzeBrandMentionOptimization: brand definition', () => {
  it('accepts "<Brand> is a <category>" without a superlative', () => {
    const { issues } = analyzeBrandMentionOptimization(
      page('<p>Acme is a free, developer-first SEO tool. Run audits locally and fix issues in CI.</p>'),
      'https://acme.dev/'
    );
    expect(issues.map((i) => i.code)).not.toContain('AI_NO_BRAND_DEFINITION');
  });

  it('matches the brand name case-insensitively', () => {
    const { issues } = analyzeBrandMentionOptimization(
      page('<p>ACME is an open source linter for websites that catches SEO regressions.</p>'),
      'https://www.acme.dev/about'
    );
    expect(issues.map((i) => i.code)).not.toContain('AI_NO_BRAND_DEFINITION');
  });

  it('still flags a page that never says what the brand is', () => {
    const { issues } = analyzeBrandMentionOptimization(
      page('<p>Welcome to our site. Browse the catalogue and contact us for a quote today.</p>'),
      'https://acme.dev/'
    );
    expect(issues.map((i) => i.code)).toContain('AI_NO_BRAND_DEFINITION');
  });
});
