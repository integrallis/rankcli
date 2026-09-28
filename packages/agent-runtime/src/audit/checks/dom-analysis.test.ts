import { describe, it, expect } from 'vitest';
import { analyzeDOMStructure } from './dom-analysis.js';

const URL = 'https://example.com/';

/** n <div>s, optionally with whitespace and a comment between each. */
function page(n: number, { pretty = false } = {}): string {
  const sep = pretty ? '\n  <!-- item -->\n  ' : '';
  const body = Array.from({ length: n }, () => `${sep}<div><span>x</span></div>`).join('');
  return `<html><body>${body}</body></html>`;
}

function analyze(html: string) {
  return analyzeDOMStructure(html, URL);
}

describe('DOM analysis', () => {
  // The thresholds (1500 warning / 3000 error) come from Lighthouse, which counts elements.
  // countNodes counted every node cheerio returns, so whitespace and comments inflated it:
  // tailwindcss.com measured 3,231 against 2,230 real elements and was reported as an error,
  // and `--fail-on error` exits 1. Re-indenting a template could fail a build.
  it('counts elements, not whitespace and comments', () => {
    const dense = analyze(page(400));
    const spaced = analyze(page(400, { pretty: true }));
    expect(spaced.data.nodeCount).toBe(dense.data.nodeCount);
  });

  it('formatting a page cannot push it over the error threshold', () => {
    const dense = analyze(page(1400));
    const spaced = analyze(page(1400, { pretty: true }));
    const sev = (r: ReturnType<typeof analyze>) =>
      r.issues.find((i) => i.code === 'DOM_SIZE_EXCESSIVE')?.severity;
    expect(sev(spaced)).toBe(sev(dense));
  });

  it('still reports a genuinely huge DOM as an error', () => {
    // 1,600 divs x 2 elements each = 3,200 elements, past the 3,000 error threshold.
    const { issues } = analyze(page(1600));
    expect(issues.find((i) => i.code === 'DOM_SIZE_EXCESSIVE')?.severity).toBe('error');
  });

  it('leaves a small page alone', () => {
    const { issues } = analyze(page(10));
    expect(issues.map((i) => i.code)).not.toContain('DOM_SIZE_EXCESSIVE');
  });
});
