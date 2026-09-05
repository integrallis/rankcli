import { describe, it, expect } from 'vitest';
import { generateFixes } from './fixer.js';
import type { SEOIssue } from './types.js';

function issue(code: string, message: string): SEOIssue {
  return { severity: 'warning', category: 'social', code, message, impact: 'medium' };
}

describe('generateFixes', () => {
  it('collapses multiple sub-issue codes in the same family into a single fix', async () => {
    // A real audit reports OG sub-tags as separate issues (og:image, og:url,
    // og:title, etc), but they all map to the same "insert the OG block"
    // fix. Without dedup, applyFixes() would insert that block once per
    // matching issue, corrupting the file with repeated tags.
    const issues: SEOIssue[] = [
      issue('OG_IMAGE_MISSING', 'Missing og:image'),
      issue('OG_URL_MISSING', 'Missing og:url'),
      issue('OG_TITLE_MISSING', 'Missing og:title'),
      issue('MISSING_VIEWPORT', 'Missing viewport meta tag'),
      issue('HTML_NO_VIEWPORT', 'Missing viewport meta tag'),
    ];

    const fixes = await generateFixes(issues, { cwd: process.cwd() });

    const codes = fixes.map((f) => f.issue.code);
    expect(codes).toEqual([...new Set(codes)]);
    expect(codes.filter((c) => c === 'MISSING_OG_TAGS')).toHaveLength(1);
    expect(codes.filter((c) => c === 'MISSING_VIEWPORT')).toHaveLength(1);
  });
});
