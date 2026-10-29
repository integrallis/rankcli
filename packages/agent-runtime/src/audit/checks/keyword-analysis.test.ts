import { describe, expect, it } from 'vitest';
import { analyzeKeywords } from './keyword-analysis.js';

// `filler` distinct words plus the word 20 times: with 400 filler words the word is 4.8%.
const page = (host: string, word: string, filler = 400) =>
  `<html><head><title>${word} framework</title></head><body><h1>${word}</h1><p>${(`${word} `).repeat(20)}${Array.from({ length: filler }, (_, i) => `word${i}`).join(' ')}</p></body></html>`;

const stuffing = (html: string, url: string) => analyzeKeywords(html, url).issues.find((i) => i.code === 'KEYWORD_STUFFING');

describe('KEYWORD_STUFFING', () => {
  it('does not flag a brand saying its own name (nextjs.org was flagged for "next" at 4.2%)', () => {
    expect(stuffing(page('nextjs.org', 'next'), 'https://nextjs.org/')).toBeUndefined();
    expect(stuffing(page('rankcli.dev', 'rankcli'), 'https://rankcli.dev/')).toBeUndefined();
  });

  it('exempts the og:site_name as well', () => {
    const html = page('x.dev', 'acme').replace('<head>', '<head><meta property="og:site_name" content="Acme Widgets">');
    expect(stuffing(html, 'https://x.dev/')).toBeUndefined();
  });

  it('still flags a non-brand word that dominates a page of real length', () => {
    const issue = stuffing(page('x.dev', 'cheap'), 'https://x.dev/');
    expect(issue).toBeDefined();
    expect(issue?.details?.keywords).toContain('cheap');
  });

  it('ignores density on a short page', () => {
    expect(stuffing(page('x.dev', 'cheap', 40), 'https://x.dev/')).toBeUndefined();
  });
});
