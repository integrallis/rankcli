import { describe, expect, it } from 'vitest';
import { dedupeIssues, REDUNDANT_WHEN_PRESENT } from './dedupe.js';
import type { AuditIssue } from './types.js';

const issue = (code: string, severity: AuditIssue['severity'] = 'notice', urls = ['https://example.com/']): AuditIssue => ({
  code,
  severity,
  category: 'on-page',
  title: code,
  description: '',
  impact: '',
  howToFix: '',
  affectedUrls: urls,
});

const codes = (issues: AuditIssue[]) => issues.map((i) => i.code);

describe('dedupeIssues', () => {
  it('reports a missing viewport once, keeping the error', () => {
    const out = dedupeIssues([issue('HTML_NO_VIEWPORT', 'warning'), issue('VIEWPORT_MISSING', 'error'), issue('RESPONSIVE_NO_VIEWPORT', 'error')]);
    expect(codes(out)).toEqual(['VIEWPORT_MISSING']);
    expect(out[0].severity).toBe('error');
  });

  it('leaves a secondary code alone when its primary did not fire', () => {
    expect(codes(dedupeIssues([issue('HTML_NO_VIEWPORT')]))).toEqual(['HTML_NO_VIEWPORT']);
    expect(codes(dedupeIssues([issue('BING_NOT_VERIFIED')]))).toEqual(['BING_NOT_VERIFIED']);
  });

  it('collapses the six no-testimonials findings into one', () => {
    const six = ['NO_SOCIAL_PROOF', 'BOFU_NO_SOCIAL_PROOF', 'AI_NO_TESTIMONIALS', 'AI_NO_REVIEW_INTEGRATION', 'AI_NO_REVIEW_PLATFORMS', 'AI_WEAK_REVIEW_ECOSYSTEM'];
    expect(codes(dedupeIssues(six.map((c) => issue(c))))).toEqual(['NO_SOCIAL_PROOF']);
  });

  it('collapses the review-ecosystem trio under the testimonials finding on a page with no commercial check', () => {
    const four = ['AI_NO_TESTIMONIALS', 'AI_NO_REVIEW_INTEGRATION', 'AI_NO_REVIEW_PLATFORMS', 'AI_WEAK_REVIEW_ECOSYSTEM'];
    expect(codes(dedupeIssues(four.map((c) => issue(c))))).toEqual(['AI_NO_TESTIMONIALS']);
  });

  it('diagnoses a client-rendered shell once, and the implied thin-content findings go with it', () => {
    const shell = ['REACT_CSR_DETECTED', 'CLIENT_SIDE_RENDERING', 'EMPTY_BODY_CONTENT', 'HIGH_JS_RENDERING_RATIO', 'AI_LOW_HTML_READABILITY', 'THIN_CONTENT', 'LOW_CONTENT_ENTROPY', 'H1_MISSING', 'NO_VISIBLE_HEADLINE'];
    expect(codes(dedupeIssues(shell.map((c) => issue(c))))).toEqual(['CLIENT_SIDE_RENDERING', 'H1_MISSING']);
  });

  it('reads the rules against the original report, so a dropped code still drops its own secondaries', () => {
    // EMPTY_BODY_CONTENT is dropped by CLIENT_SIDE_RENDERING but still retires THIN_CONTENT.
    const out = dedupeIssues([issue('CLIENT_SIDE_RENDERING'), issue('EMPTY_BODY_CONTENT'), issue('THIN_CONTENT')]);
    expect(codes(out)).toEqual(['CLIENT_SIDE_RENDERING']);
  });

  it('merges the affected URLs of a code reported twice', () => {
    const out = dedupeIssues([issue('H1_MISSING', 'error', ['https://a/']), issue('H1_MISSING', 'error', ['https://b/'])]);
    expect(out).toHaveLength(1);
    expect(out[0].affectedUrls).toEqual(['https://a/', 'https://b/']);
  });

  it('does not mutate its input', () => {
    const input = [issue('SCHEMA_MISSING'), issue('NO_ORGANIZATION_SCHEMA')];
    const before = JSON.stringify(input);
    dedupeIssues(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('never lists a kept code as redundant to itself', () => {
    for (const rule of REDUNDANT_WHEN_PRESENT) {
      if (typeof rule.keep === 'string') expect(rule.drop).not.toContain(rule.keep);
    }
  });
});
