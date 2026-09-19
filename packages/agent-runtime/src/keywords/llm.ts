/**
 * The keyword engine's view of a language model: one prompt in, a JSON reply out, and
 * optionally embeddings. The CLI builds one from its provider resolver (Apple Intelligence on a
 * Mac that has it, OpenRouter, Ollama, ...); an OpenAI key on its own still works, through
 * openAIKeywordLLM, exactly as the engine always called OpenAI.
 */
import OpenAI from 'openai';

export interface KeywordLLM {
  /**
   * A reply to one prompt that asks for a JSON object. `best` asks for the provider's stronger
   * model where it has one. Replies are parsed with parseJsonReply, never trusted to be clean.
   */
  complete(prompt: string, opts?: { system?: string; maxTokens?: number; temperature?: number; best?: boolean }): Promise<string>;
  /** Embeddings for keyword clustering. Without it, clustering falls back to term vectors. */
  embed?(texts: string[]): Promise<number[][]>;
  /** Most page text worth sending in one prompt: small-context models get less. */
  maxContentChars?: number;
  /** How many tool ideas to judge (two calls each): slow local models get fewer. */
  maxToolIdeas?: number;
}

/** The engine's original backend: gpt-4o-mini, gpt-4o for `best`, JSON mode, text-embedding-3-small. */
export function openAIKeywordLLM(apiKey: string, opts: { model?: string } = {}): KeywordLLM {
  const openai = new OpenAI({ apiKey });
  const openAIModel = opts.model;
  return {
    async complete(prompt, opts = {}) {
      const response = await openai.chat.completions.create({
        model: opts.best ? 'gpt-4o' : openAIModel ?? 'gpt-4o-mini',
        messages: [
          ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
          { role: 'user' as const, content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: opts.temperature ?? 0.3,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      });
      return response.choices[0]?.message?.content || '';
    },
    async embed(texts) {
      const response = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts });
      return response.data.map((item) => item.embedding);
    },
  };
}

/** The model to use: an explicit one, else OpenAI when there's a key, else none. */
export function keywordLLM(options: { llm?: KeywordLLM; openaiApiKey?: string }): KeywordLLM | undefined {
  return options.llm ?? (options.openaiApiKey ? openAIKeywordLLM(options.openaiApiKey) : undefined);
}

/**
 * The JSON object in a model reply. Local and small models wrap it in ``` fences, prepend prose
 * or emit <think> blocks; this takes the outermost {...} and tolerates trailing commas.
 */
export function parseJsonReply(text: string): Record<string, any> | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  const candidate = cleaned.slice(start, end + 1);
  for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // try the next form
    }
  }
  return null;
}
