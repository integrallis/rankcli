/**
 * The keyword engine's model (agent-runtime's KeywordLLM), from the same provider `audit --ai`
 * resolves: Apple Intelligence on a Mac that has it, else a key from the env, else Ollama.
 * Only OpenAI supplies embeddings here; other providers cluster keywords with term vectors.
 * Small or slow local models get less page text per prompt and judge fewer tool ideas (each
 * idea is two model calls).
 */
import type { KeywordLLM } from '@rankcli/agent-runtime';
import { completeWithAI, type ResolvedAI } from './ai.js';

async function openAIEmbeddings(ai: ResolvedAI, texts: string[]): Promise<number[][]> {
  const response = await fetch(`${ai.baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings returned HTTP ${response.status}`);
  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  return data.data.map((item) => item.embedding);
}

export function keywordLLMFromAI(ai: ResolvedAI): KeywordLLM {
  const llm: KeywordLLM = {
    async complete(prompt, opts = {}) {
      const reply = await completeWithAI(ai, { system: opts.system, prompt, maxTokens: opts.maxTokens, json: true });
      if ('error' in reply) throw new Error(reply.error);
      return reply.text;
    },
  };
  if (ai.provider === 'openai' && ai.apiKey && ai.jsonMode) {
    // jsonMode is only set on OpenAI's real endpoint, not a --ai-base-url override.
    llm.embed = (texts) => openAIEmbeddings(ai, texts);
  }
  if (ai.provider === 'apple') {
    // The on-device window is 4,096 tokens for prompt and reply together.
    llm.maxContentChars = 5000;
    llm.maxToolIdeas = 5;
  } else if (ai.local) {
    llm.maxToolIdeas = 5;
  }
  return llm;
}
