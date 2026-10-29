import { describe, expect, it } from 'vitest';
import { checkAMP } from './additional-checks.js';

describe('checkAMP', () => {
  it('reports no AMP_MISSING finding: AMP has had no ranking role since 2021', () => {
    const article = '<html><head><meta property="og:type" content="article"></head><body><article><p>News and blog.</p></article></body></html>';
    const { issues, data } = checkAMP(article, 'https://acme.dev/post');
    expect(issues).toEqual([]);
    expect(data.hasAmpLink).toBe(false);
  });

  it('still reports an amphtml link as data', () => {
    const { data } = checkAMP('<html><head><link rel="amphtml" href="https://acme.dev/amp/post"></head></html>', 'https://acme.dev/post');
    expect(data).toMatchObject({ hasAmpLink: true, ampUrl: 'https://acme.dev/amp/post' });
  });
});
