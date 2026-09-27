import { describe, it, expect } from 'vitest';
import { analyzeColorContrast } from './color-contrast.js';

const URL = 'https://example.com/';

function codes(html: string): string[] {
  return analyzeColorContrast(html, URL).issues.map((i) => i.code);
}

describe('color contrast', () => {
  // The exact shape from rankcli.dev's own /login: a <noscript> fallback painted
  // #0a0a0a with #a1a1aa text. Real ratio is about 9:1. The checker read only the
  // element's own inline style, found no background, assumed white, and reported
  // 2.56:1 - "critical, this text may be unreadable" - on text that is perfectly
  // readable. It did that on every dark-themed page, for everyone.
  it('reads the background off an ancestor instead of assuming white', () => {
    const html = `<html><body>
      <div style="color: #e4e4e7; background: #0a0a0a;">
        <p style="font-size: 1.25rem; color: #a1a1aa;">Ship code, get ranked.</p>
      </div>
    </body></html>`;
    expect(codes(html)).not.toContain('A11Y_CONTRAST_CRITICAL');
  });

  it('keeps looking outward past a transparent ancestor', () => {
    const html = `<html><body>
      <div style="background: #0a0a0a;">
        <section style="background: transparent;">
          <p style="color: #a1a1aa;">Still on the dark background.</p>
        </section>
      </div>
    </body></html>`;
    expect(codes(html)).not.toContain('A11Y_CONTRAST_CRITICAL');
  });

  it('still reports genuinely unreadable text', () => {
    const html = `<html><body>
      <div style="background: #ffffff;">
        <p style="color: #cccccc;">Pale grey on white is 1.6:1.</p>
      </div>
    </body></html>`;
    expect(codes(html)).toContain('A11Y_CONTRAST_CRITICAL');
  });

  it('says nothing when no ancestor paints a background', () => {
    // Previously this was reported against an assumed white page. We do not know
    // what this text sits on, and a guess here is what produced the false critical.
    const html = `<html><body><p style="color: #a1a1aa;">Unknown backdrop.</p></body></html>`;
    expect(codes(html)).not.toContain('A11Y_CONTRAST_CRITICAL');
  });
});
