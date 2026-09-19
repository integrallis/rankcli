import { describe, it, expect } from 'vitest';
import { keywordLLMFromAI } from './keyword-llm.js';
import type { ResolvedAI } from './ai.js';

const base: ResolvedAI = {
  provider: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'm',
  apiKey: 'k', jsonMode: false, anthropic: false, local: false,
};

describe('keywordLLMFromAI', () => {
  it('gives the on-device model less page text and fewer tool ideas', () => {
    const llm = keywordLLMFromAI({ ...base, provider: 'apple', label: 'Apple Intelligence', baseUrl: '', local: true, helper: '/x' });
    expect(llm.maxContentChars).toBe(5000);
    expect(llm.maxToolIdeas).toBe(5);
    expect(llm.embed).toBeUndefined();
  });

  it('limits slow local servers to fewer tool ideas but not less content', () => {
    const llm = keywordLLMFromAI({ ...base, provider: 'ollama', label: 'Ollama', local: true, apiKey: undefined });
    expect(llm.maxToolIdeas).toBe(5);
    expect(llm.maxContentChars).toBeUndefined();
  });

  it('offers embeddings only on OpenAI itself', () => {
    expect(keywordLLMFromAI(base).embed).toBeUndefined();
    expect(keywordLLMFromAI({ ...base, provider: 'openai', label: 'OpenAI', jsonMode: true }).embed).toBeTypeOf('function');
    // An --ai-base-url override turns JSON mode off, and with it the embeddings assumption.
    expect(keywordLLMFromAI({ ...base, provider: 'openai', label: 'OpenAI', jsonMode: false }).embed).toBeUndefined();
  });

  it('turns a provider failure into an exception the engine handles', async () => {
    const llm = keywordLLMFromAI({ ...base, baseUrl: 'http://127.0.0.1:1/v1' });
    await expect(llm.complete('hi')).rejects.toThrow(/request failed/);
  });
});
