import { describe, it, expect } from 'vitest';
import { analyzeAIContentStructure } from './ai-content-structure.js';

const URL_ = 'https://example.com/';
const codes = (html: string) => analyzeAIContentStructure(html, URL_).issues.map((i) => i.code);
const table = '<table><tr><th>Feature</th><th>A</th><th>B</th></tr><tr><td>Price</td><td>1</td><td>2</td></tr><tr><td>Size</td><td>3</td><td>4</td></tr></table>';

describe('AI content structure', () => {
  // "vs" as a substring matched canvas, and the old operator precedence fired the table
  // finding on any page containing it, table or no table.
  it('does not ask for a comparison table on a page that has one, or that merely contains "canvas"', () => {
    expect(codes(`<html><body><h1>Canvas tools</h1><p>Draw on a canvas with svs files.</p>${table}</body></html>`)).not.toContain('AI_NO_COMPARISON_TABLE');
    expect(codes('<html><body><h1>Canvas tools</h1><p>Draw on a canvas.</p></body></html>')).not.toContain('AI_NO_COMPARISON_TABLE');
  });

  it('asks for a table when the page compares things in prose', () => {
    expect(codes('<html><body><h1>A versus B</h1><p>A is cheaper, B is faster, and the comparison depends on your needs.</p></body></html>')).toContain('AI_NO_COMPARISON_TABLE');
  });

  it('no longer reports the absence of a Q&A format or of definitions', () => {
    const found = codes('<html><body><h1>Pricing</h1><p>Plans start at 9 dollars a month. What is included depends on the plan.</p></body></html>');
    expect(found).not.toContain('AI_NO_QA_FORMAT');
    expect(found).not.toContain('AI_NO_DEFINITIONS');
    expect(found).not.toContain('AI_QUESTIONS_NO_DIRECT_ANSWERS');
  });

  it('keeps the structure score a notice, never a failed build', () => {
    const issues = analyzeAIContentStructure('<html><body><p>One paragraph and nothing else on this page at all, which is long enough to count.</p></body></html>', URL_).issues;
    for (const issue of issues) expect(issue.severity).not.toBe('warning');
  });
});
