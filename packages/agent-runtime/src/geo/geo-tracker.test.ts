import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectMentions,
  scoreMention,
  parseGEOResponse,
  trackLLMVisibility,
  GEOQuery,
  GEOResult,
  MentionType,
  LLMProvider,
} from './geo-tracker.js';

describe('geo-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectMentions', () => {
    it('detects exact brand name mention', () => {
      const text = 'For SEO automation, I recommend SEO Autopilot as a great tool for developers.';
      const mentions = detectMentions(text, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(mentions).toHaveLength(1);
      expect(mentions[0].type).toBe('brand');
      expect(mentions[0].text).toBe('SEO Autopilot');
    });

    it('detects domain/URL mention', () => {
      const text = 'You can check out seo-autopilot.dev for a CLI-based solution.';
      const mentions = detectMentions(text, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(mentions).toHaveLength(1);
      expect(mentions[0].type).toBe('domain');
      expect(mentions[0].text).toContain('seo-autopilot.dev');
    });

    it('detects multiple mentions', () => {
      const text = 'SEO Autopilot (seo-autopilot.dev) is a developer tool. SEO Autopilot offers CLI features.';
      const mentions = detectMentions(text, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(mentions.length).toBeGreaterThanOrEqual(2);
    });

    it('detects case-insensitive brand mentions', () => {
      const text = 'Have you tried seo autopilot? It is good for automation.';
      const mentions = detectMentions(text, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(mentions).toHaveLength(1);
    });

    it('detects alternative brand names', () => {
      const text = 'Tools like SEOAutopilot and Ahrefs are popular.';
      const mentions = detectMentions(text, {
        brandName: 'SEO Autopilot',
        alternativeNames: ['SEOAutopilot', 'seo-autopilot'],
        domains: ['seo-autopilot.dev'],
      });

      expect(mentions).toHaveLength(1);
    });

    it('returns empty array when no mentions found', () => {
      const text = 'For SEO, I recommend Ahrefs or SEMrush.';
      const mentions = detectMentions(text, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(mentions).toHaveLength(0);
    });

    it('detects mentions with context', () => {
      const text = 'The best SEO tools are: 1. Ahrefs 2. SEO Autopilot 3. SEMrush';
      const mentions = detectMentions(text, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(mentions).toHaveLength(1);
      expect(mentions[0].position).toBeDefined();
    });
  });

  describe('scoreMention', () => {
    it('scores first position highest', () => {
      const score1 = scoreMention({ type: 'brand', text: 'SEO Autopilot', position: 1, context: '' });
      const score2 = scoreMention({ type: 'brand', text: 'SEO Autopilot', position: 3, context: '' });

      expect(score1).toBeGreaterThan(score2);
    });

    it('scores brand mentions higher than domain mentions', () => {
      const brandScore = scoreMention({ type: 'brand', text: 'SEO Autopilot', position: 1, context: '' });
      const domainScore = scoreMention({ type: 'domain', text: 'seo-autopilot.dev', position: 1, context: '' });

      expect(brandScore).toBeGreaterThan(domainScore);
    });

    it('boosts score for recommendation context', () => {
      const normalScore = scoreMention({
        type: 'brand',
        text: 'SEO Autopilot',
        position: 2,
        context: 'SEO Autopilot is a tool.',
      });
      const recommendScore = scoreMention({
        type: 'brand',
        text: 'SEO Autopilot',
        position: 2,
        context: 'I recommend SEO Autopilot for developers.',
      });

      expect(recommendScore).toBeGreaterThan(normalScore);
    });

    it('returns 0 for no mention', () => {
      const score = scoreMention(null);
      expect(score).toBe(0);
    });
  });

  describe('parseGEOResponse', () => {
    it('extracts position from numbered list', () => {
      const response = `Here are the best SEO tools:
1. Ahrefs - comprehensive SEO suite
2. SEO Autopilot - developer-first CLI tool
3. SEMrush - marketing platform`;

      const result = parseGEOResponse(response, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(result.mentioned).toBe(true);
      expect(result.position).toBe(2);
    });

    it('detects first position', () => {
      const response = `For CLI-based SEO, SEO Autopilot is the best choice. Other options include Screaming Frog.`;

      const result = parseGEOResponse(response, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(result.mentioned).toBe(true);
      expect(result.position).toBe(1);
    });

    it('handles not mentioned case', () => {
      const response = `The best SEO tools are Ahrefs, SEMrush, and Moz.`;

      const result = parseGEOResponse(response, {
        brandName: 'SEO Autopilot',
        domains: ['seo-autopilot.dev'],
      });

      expect(result.mentioned).toBe(false);
      expect(result.position).toBeNull();
    });

    it('extracts sentiment', () => {
      const positiveResponse = `SEO Autopilot is an excellent tool that I highly recommend for developers.`;
      const negativeResponse = `SEO Autopilot has some limitations and may not be suitable for large enterprises.`;

      const positiveResult = parseGEOResponse(positiveResponse, {
        brandName: 'SEO Autopilot',
        domains: [],
      });
      const negativeResult = parseGEOResponse(negativeResponse, {
        brandName: 'SEO Autopilot',
        domains: [],
      });

      expect(positiveResult.sentiment).toBe('positive');
      expect(negativeResult.sentiment).toBe('negative');
    });

    it('extracts context snippet', () => {
      const response = `There are many tools available. SEO Autopilot stands out for its CLI-first approach to SEO automation. It integrates well with CI/CD.`;

      const result = parseGEOResponse(response, {
        brandName: 'SEO Autopilot',
        domains: [],
      });

      expect(result.contextSnippet).toContain('SEO Autopilot');
      expect(result.contextSnippet!.length).toBeLessThan(200);
    });
  });

  describe('trackLLMVisibility', () => {
    it('returns results for each provider', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'SEO Autopilot is a great tool.' } }],
        }),
      });

      const query: GEOQuery = {
        keyword: 'best seo cli tool',
        brand: {
          brandName: 'SEO Autopilot',
          domains: ['seo-autopilot.dev'],
        },
        providers: ['openai'],
      };

      const results = await trackLLMVisibility(query, { fetch: mockFetch });

      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('openai');
      expect(results[0].mentioned).toBe(true);
    });

    it('handles API errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('API error'));

      const query: GEOQuery = {
        keyword: 'best seo tool',
        brand: {
          brandName: 'SEO Autopilot',
          domains: [],
        },
        providers: ['openai'],
      };

      const results = await trackLLMVisibility(query, { fetch: mockFetch });

      expect(results).toHaveLength(1);
      expect(results[0].error).toBeDefined();
      expect(results[0].mentioned).toBe(false);
    });

    it('queries multiple providers in parallel', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'SEO Autopilot is recommended.' } }],
        }),
      });

      const query: GEOQuery = {
        keyword: 'best seo automation',
        brand: {
          brandName: 'SEO Autopilot',
          domains: [],
        },
        providers: ['openai', 'anthropic'],
      };

      const results = await trackLLMVisibility(query, { fetch: mockFetch });

      expect(results).toHaveLength(2);
      expect(results.map(r => r.provider)).toContain('openai');
      expect(results.map(r => r.provider)).toContain('anthropic');
    });
  });

  describe('GEOResult structure', () => {
    it('includes all required fields', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'For developers, SEO Autopilot offers CLI-first SEO.' } }],
        }),
      });

      const query: GEOQuery = {
        keyword: 'developer seo tools',
        brand: {
          brandName: 'SEO Autopilot',
          domains: ['seo-autopilot.dev'],
        },
        providers: ['openai'],
      };

      const [result] = await trackLLMVisibility(query, { fetch: mockFetch });

      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('keyword');
      expect(result).toHaveProperty('mentioned');
      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('integration scenarios', () => {
    it('tracks visibility across multiple keywords', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'SEO Autopilot is the best CLI tool.' } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Try Ahrefs or SEMrush for SEO.' } }],
          }),
        });

      const keywords = ['best seo cli', 'seo automation tools'];
      const brand = { brandName: 'SEO Autopilot', domains: ['seo-autopilot.dev'] };

      const allResults: GEOResult[] = [];
      for (const keyword of keywords) {
        const results = await trackLLMVisibility(
          { keyword, brand, providers: ['openai'] },
          { fetch: mockFetch }
        );
        allResults.push(...results);
      }

      expect(allResults).toHaveLength(2);
      expect(allResults[0].mentioned).toBe(true);
      expect(allResults[1].mentioned).toBe(false);
    });

    it('calculates aggregate visibility score', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '1. SEO Autopilot - best for devs\n2. Ahrefs' } }],
        }),
      });

      const query: GEOQuery = {
        keyword: 'best seo tools for developers',
        brand: {
          brandName: 'SEO Autopilot',
          domains: ['seo-autopilot.dev'],
        },
        providers: ['openai'],
      };

      const [result] = await trackLLMVisibility(query, { fetch: mockFetch });

      // First position should have high score
      expect(result.score).toBeGreaterThan(80);
    });
  });
});
