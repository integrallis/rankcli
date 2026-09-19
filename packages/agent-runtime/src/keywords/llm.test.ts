import { describe, it, expect } from 'vitest';
import { keywordLLM, parseJsonReply, type KeywordLLM } from './llm.js';
import { summarizeSite } from './ai-summarizer.js';
import { evaluateToolFeasibility } from './llm-judge.js';
import type { SiteCrawlResult } from './site-crawler.js';

function fakeLLM(reply: string, extra: Partial<KeywordLLM> = {}) {
  const prompts: string[] = [];
  const llm: KeywordLLM = {
    async complete(prompt) {
      prompts.push(prompt);
      return reply;
    },
    ...extra,
  };
  return { llm, prompts };
}

describe('parseJsonReply', () => {
  it('reads the object out of fences, prose, <think> blocks and trailing commas', () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonReply('Sure:\n```json\n{"a": {"b": 2},}\n```')).toEqual({ a: { b: 2 } });
    expect(parseJsonReply('<think>{"no": 1}</think> {"yes": true}')).toEqual({ yes: true });
    expect(parseJsonReply('I cannot help with that.')).toBeNull();
  });
});

describe('keywordLLM', () => {
  it('prefers an explicit model, falls back to an OpenAI key, else none', () => {
    const { llm } = fakeLLM('{}');
    expect(keywordLLM({ llm, openaiApiKey: 'sk-x' })).toBe(llm);
    expect(keywordLLM({ openaiApiKey: 'sk-x' })?.embed).toBeTypeOf('function');
    expect(keywordLLM({})).toBeUndefined();
  });
});

describe('the keyword engine on any provider', () => {
  const crawl = {
    aggregatedContent: 'x'.repeat(20_000),
    uniqueHeadings: ['Pricing', 'Features'],
    detectedPageTypes: { product: 1, pricing: 1, blog: 0, feature: 2 },
  } as unknown as SiteCrawlResult;

  it('summarizes with the given model and sends a small-context model less page text', async () => {
    const { llm, prompts } = fakeLLM(
      'Here you go: {"productName": "Acme", "industry": "Dev tools", "confidence": 0.8}',
      { maxContentChars: 5000 },
    );
    const summary = await summarizeSite(crawl, { llm });
    expect(summary.productName).toBe('Acme');
    expect(prompts[0]).toContain('x'.repeat(5000) + '\n...[truncated]');
    expect(prompts[0]).not.toContain('x'.repeat(5001));
  });

  it('drops a tool idea when the judge replies with prose instead of crashing', async () => {
    const { llm } = fakeLLM('I am not able to score this.');
    const score = await evaluateToolFeasibility(
      { keyword: 'json formatter', toolName: 'JSON Formatter', toolDescription: 'Formats JSON' },
      { productName: 'Acme', keyFeatures: [] } as never,
      null,
      { llm },
    );
    expect(score.overallScore).toBe(0);
    expect(score.passes).toBe(false);
  });
});
