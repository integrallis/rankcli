import { describe, it, expect } from 'vitest';
import { extractLlmsTxtLinks } from './llms-txt.js';

describe('extractLlmsTxtLinks', () => {
  const baseUrl = 'https://example.com';

  it('resolves relative links against the base URL', () => {
    const content = '- [About](/about): learn more\n- [Docs](/docs): documentation';
    expect(extractLlmsTxtLinks(content, baseUrl)).toEqual([
      'https://example.com/about',
      'https://example.com/docs',
    ]);
  });

  it('keeps absolute links as-is', () => {
    const content = '- [External](https://other.com/page): a link';
    expect(extractLlmsTxtLinks(content, baseUrl)).toEqual(['https://other.com/page']);
  });

  it('skips unresolvable links without throwing', () => {
    const content = '- [Email](mailto:hi@example.com): contact\n- [About](/about): learn more';
    expect(extractLlmsTxtLinks(content, baseUrl)).toEqual([
      'https://example.com/about',
    ]);
  });

  it('returns an empty array when there are no links', () => {
    expect(extractLlmsTxtLinks('# Title\n> description', baseUrl)).toEqual([]);
  });
});
