import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  resolveAIProvider,
  runAIAnalysis,
  extractJsonObject,
  ollamaBaseUrl,
  probeOllama,
  AI_PROVIDERS,
} from './ai.js';

const noOllama = async () => null;

describe('resolveAIProvider', () => {
  it('prefers OpenRouter when its key is present alongside others', async () => {
    const r = await resolveAIProvider({}, { OPENAI_API_KEY: 'sk-x', OPENROUTER_API_KEY: 'sk-or-x', DEEPSEEK_API_KEY: 'd' }, noOllama);
    expect(r.ok && r.ai.provider).toBe('openrouter');
  });

  it.each([
    ['DEEPSEEK_API_KEY', 'deepseek', 'https://api.deepseek.com'],
    ['TOGETHER_API_KEY', 'together', 'https://api.together.xyz/v1'],
    ['FIREWORKS_API_KEY', 'fireworks', 'https://api.fireworks.ai/inference/v1'],
    ['MISTRAL_API_KEY', 'mistral', 'https://api.mistral.ai/v1'],
    ['CEREBRAS_API_KEY', 'cerebras', 'https://api.cerebras.ai/v1'],
  ])('auto-detects %s', async (envKey, provider, baseUrl) => {
    const r = await resolveAIProvider({}, { [envKey]: 'k' }, noOllama);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ai.provider).toBe(provider);
      expect(r.ai.baseUrl).toBe(baseUrl);
      expect(r.ai.model).toBe(AI_PROVIDERS[provider].model);
      expect(r.ai.apiKey).toBe('k');
    }
  });

  it('keeps a bare --ai-key meaning OpenAI, but recognises distinctive prefixes', async () => {
    const plain = await resolveAIProvider({ aiKey: 'sk-abc' }, {}, noOllama);
    expect(plain.ok && plain.ai.provider).toBe('openai');
    const or = await resolveAIProvider({ aiKey: 'sk-or-v1-abc' }, {}, noOllama);
    expect(or.ok && or.ai.provider).toBe('openrouter');
  });

  it('fails with hints when nothing is configured and no Ollama is running', async () => {
    const r = await resolveAIProvider({}, {}, noOllama);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hints.join(' ')).toMatch(/ollama/i);
  });

  it('falls back to a running local Ollama with a notice and its first model', async () => {
    const r = await resolveAIProvider({}, {}, async () => ['qwen3:8b', 'llama3.2']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ai.provider).toBe('ollama');
      expect(r.ai.model).toBe('qwen3:8b');
      expect(r.ai.apiKey).toBeUndefined();
      expect(r.ai.notice).toMatch(/local Ollama/);
    }
  });

  it('skips embedding models when picking an Ollama model', async () => {
    const r = await resolveAIProvider({}, {}, async () => ['nomic-embed-text:latest', 'llama3.2:3b']);
    expect(r.ok && r.ai.model).toBe('llama3.2:3b');
  });

  it('reports an Ollama with no models installed', async () => {
    const r = await resolveAIProvider({ aiProvider: 'ollama' }, {}, async () => []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hints.join(' ')).toMatch(/ollama pull/);
  });

  it('requires a key for hosted providers but not for local ones', async () => {
    const hosted = await resolveAIProvider({ aiProvider: 'deepseek' }, {}, noOllama);
    expect(hosted.ok).toBe(false);
    const local = await resolveAIProvider({ aiProvider: 'lmstudio', aiModel: 'm' }, {}, noOllama);
    expect(local.ok && local.ai.baseUrl).toBe('http://localhost:1234/v1');
  });

  it('--ai-base-url alone means a custom OpenAI-compatible server, without JSON mode', async () => {
    const r = await resolveAIProvider({ aiBaseUrl: 'http://box:8080/v1/', aiModel: 'm' }, {}, noOllama);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ai.provider).toBe('custom');
      expect(r.ai.baseUrl).toBe('http://box:8080/v1');
      expect(r.ai.jsonMode).toBe(false);
    }
  });

  it('rejects an unknown provider', async () => {
    const r = await resolveAIProvider({ aiProvider: 'skynet' }, {}, noOllama);
    expect(r.ok).toBe(false);
  });

  it('honours OLLAMA_HOST in its usual forms', () => {
    expect(ollamaBaseUrl({})).toBe('http://localhost:11434/v1');
    expect(ollamaBaseUrl({ OLLAMA_HOST: '0.0.0.0:11434' })).toBe('http://127.0.0.1:11434/v1');
    expect(ollamaBaseUrl({ OLLAMA_HOST: 'gpu-box' })).toBe('http://gpu-box:11434/v1');
    expect(ollamaBaseUrl({ OLLAMA_HOST: 'https://ollama.internal' })).toBe('https://ollama.internal/v1');
  });
});

describe('extractJsonObject', () => {
  it('parses plain JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences and surrounding prose', () => {
    expect(extractJsonObject('Sure! Here you go:\n```json\n{"a": {"b": 2}}\n```\nHope that helps.')).toEqual({ a: { b: 2 } });
  });

  it('ignores <think> blocks and braces inside them', () => {
    expect(extractJsonObject('<think>maybe {"x": 1}? no</think>{"contentScore": 70}')).toEqual({ contentScore: 70 });
  });

  it('handles braces inside strings and trailing commas', () => {
    expect(extractJsonObject('Result: {"s": "a } b", "n": [1, 2,],}')).toEqual({ s: 'a } b', n: [1, 2] });
  });

  it('returns null when there is no object', () => {
    expect(extractJsonObject('I cannot help with that.')).toBeNull();
  });
});

describe('runAIAnalysis against a local OpenAI-compatible server', () => {
  let server: Server;
  let base: string;
  const requests: Array<{ path: string; body: Record<string, unknown>; auth?: string }> = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        const path = req.url || '';
        if (path === '/api/tags') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ models: [{ name: 'tiny:1b' }] }));
          return;
        }
        if (path === '/v1/models') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ data: [{ id: 'loaded-model' }] }));
          return;
        }
        const body = raw ? JSON.parse(raw) : {};
        requests.push({ path, body, auth: req.headers.authorization });
        // Like many local models: fenced JSON with chatter around it.
        const content = 'Here is the analysis:\n```json\n{"contentScore": 64, "suggestions": ["Add a meta description"], "prioritizedFixes": [{"code": "META_DESCRIPTION_MISSING", "priority": 1, "rationale": "Shown in results"}]}\n```';
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('probes Ollama tags', async () => {
    expect(await probeOllama(`${base}/v1`)).toEqual(['tiny:1b']);
    expect(await probeOllama('http://127.0.0.1:1/v1', 300)).toBeNull();
  });

  it('asks the server for its loaded model and parses a fenced reply, with no key and no JSON mode', async () => {
    const r = await resolveAIProvider({ aiProvider: 'llamacpp', aiBaseUrl: `${base}/v1` }, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ai.model).toBe('loaded-model');

    const result = await runAIAnalysis('https://example.com', [
      { code: 'META_DESCRIPTION_MISSING', severity: 'warning', category: 'on-page', title: 'Missing meta description', description: '', impact: '', howToFix: '' },
    ], r.ai);

    expect('analysis' in result && result.analysis.contentScore).toBe(64);
    const last = requests.at(-1)!;
    expect(last.path).toBe('/v1/chat/completions');
    expect(last.auth).toBeUndefined();
    expect(last.body.response_format).toBeUndefined();
    expect(last.body.model).toBe('loaded-model');
  });

  it('reports an HTTP failure as an error, not as a silent null', async () => {
    const r = await resolveAIProvider({ aiBaseUrl: 'http://127.0.0.1:1/v1', aiModel: 'm' }, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = await runAIAnalysis('https://example.com', [], r.ai);
    expect('error' in result && result.error).toMatch(/request failed/);
  });
});
