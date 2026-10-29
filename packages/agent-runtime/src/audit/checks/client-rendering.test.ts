import { describe, expect, it } from 'vitest';
import { analyzeClientRendering } from './client-rendering.js';

describe('AI_KEY_CONTENT_NOT_IN_HTML', () => {
  it('is satisfied by any substantial paragraph, not only the first <p> (sive.rs opens with a one-liner)', () => {
    const html = `<html><head><title>Derek Sivers</title></head><body><h1>Derek Sivers</h1>
      <p>Hi.</p><p>${'A long paragraph of real server-rendered text about writing and music. '.repeat(6)}</p></body></html>`;
    const { issues, data } = analyzeClientRendering(html, 'https://sive.rs/');
    expect(data.aiAccessibility.keyContentInHTML).toBe(true);
    expect(issues.map((i) => i.code)).not.toContain('AI_KEY_CONTENT_NOT_IN_HTML');
  });
});
