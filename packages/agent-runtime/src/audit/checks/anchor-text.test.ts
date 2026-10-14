import { describe, it, expect } from 'vitest';
import { analyzeAnchorText } from './anchor-text.js';

const URL = 'https://example.com/';

function run(html: string) {
  return analyzeAnchorText(html, URL);
}

describe('analyzeAnchorText: empty anchors', () => {
  it('flags a link with no text, no label and no image', () => {
    const { issues, data } = run('<a href="/about"></a>');
    expect(data.emptyAnchors).toBe(1);
    expect(issues.map((i) => i.code)).toContain('ANCHOR_TEXT_EMPTY');
  });

  it('accepts a logo link whose only content is an image with alt text', () => {
    const { issues, data } = run('<a href="/"><img src="/logo.svg" alt="Acme"></a>');
    expect(data.emptyAnchors).toBe(0);
    expect(issues.map((i) => i.code)).not.toContain('ANCHOR_TEXT_EMPTY');
  });

  it('accepts an icon link whose SVG carries a title', () => {
    const { issues, data } = run(
      '<a href="https://github.com/acme"><svg><title>Acme on GitHub</title><path d="M0 0"/></svg></a>'
    );
    expect(data.emptyAnchors).toBe(0);
    expect(issues.map((i) => i.code)).not.toContain('ANCHOR_TEXT_EMPTY');
  });

  it('still flags an image link whose alt is empty', () => {
    const { data } = run('<a href="/"><img src="/logo.svg" alt=""></a>');
    expect(data.emptyAnchors).toBe(1);
  });

  it('accepts aria-label on an otherwise empty link', () => {
    const { data } = run('<a href="/x" aria-label="Open X"><svg></svg></a>');
    expect(data.emptyAnchors).toBe(0);
  });
});
