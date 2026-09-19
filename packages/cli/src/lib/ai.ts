/**
 * AI analysis for `rankcli audit --ai`, on the user's own provider.
 *
 * Everything except Anthropic speaks OpenAI's /chat/completions shape, so a
 * provider is just a base URL, a default model, the env vars its key may
 * live in, and whether it honours `response_format: json_object`. Local
 * servers (Ollama, LM Studio, llama.cpp, vLLM, anything OpenAI-compatible)
 * need no key and usually no model name either - the server is asked what
 * it has loaded. Anthropic's Messages API is genuinely different (x-api-key,
 * top-level system, typed content blocks) and gets its own branch.
 *
 * On a Mac with Apple Intelligence (macOS 26+, Apple silicon), Apple's on-device model is
 * the default: it's free and local. It isn't an HTTP server, so it goes through a small
 * native helper (apple-ai.ts). Pass --ai-provider or set RANKCLI_AI_PROVIDER to choose another.
 *
 * Nothing here trusts a model to return clean JSON: local models wrap it in
 * ``` fences, prepend prose, or emit <think> blocks, so the reply is parsed
 * defensively (extractJsonObject) whether or not JSON mode was requested.
 */
import type { AuditIssue } from '@rankcli/agent-runtime';
import {
  OPENAI_FAST,
  ANTHROPIC_FAST,
  OPENROUTER_DEFAULT,
  GROQ_DEFAULT,
  GEMINI_DEFAULT,
  DEEPSEEK_DEFAULT,
  MISTRAL_DEFAULT,
  TOGETHER_DEFAULT,
  FIREWORKS_DEFAULT,
  CEREBRAS_DEFAULT,
} from '../models.js';
import { checkAppleAI, generateWithAppleAI, type AppleAIStatus } from './apple-ai.js';

export interface AIAnalysis {
  contentScore: number;
  suggestions: string[];
  prioritizedFixes: Array<{ code: string; priority: number; rationale: string }>;
}

interface ProviderPreset {
  label: string;
  /** OpenAI-compatible base (…/v1). Absent for `custom`, which needs --ai-base-url. */
  baseUrl?: string;
  /** Absent for local servers: the server is asked which models it has. */
  model?: string;
  /** Env vars that may hold this provider's key, in priority order. */
  envKeys: string[];
  /** Runs on the user's machine (or a self-hosted box) - no key required. */
  local?: boolean;
  /** Confirmed to accept response_format: { type: 'json_object' }. */
  jsonMode?: boolean;
  anthropic?: boolean;
}

export const AI_PROVIDERS: Record<string, ProviderPreset> = {
  // Hosted
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: OPENROUTER_DEFAULT, envKeys: ['OPENROUTER_API_KEY'] },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: OPENAI_FAST, envKeys: ['OPENAI_API_KEY'], jsonMode: true },
  anthropic: { label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', model: ANTHROPIC_FAST, envKeys: ['ANTHROPIC_API_KEY'], anthropic: true },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: GROQ_DEFAULT, envKeys: ['GROQ_API_KEY'], jsonMode: true },
  gemini: { label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: GEMINI_DEFAULT, envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: DEEPSEEK_DEFAULT, envKeys: ['DEEPSEEK_API_KEY'], jsonMode: true },
  mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: MISTRAL_DEFAULT, envKeys: ['MISTRAL_API_KEY'], jsonMode: true },
  cerebras: { label: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', model: CEREBRAS_DEFAULT, envKeys: ['CEREBRAS_API_KEY'] },
  together: { label: 'Together', baseUrl: 'https://api.together.xyz/v1', model: TOGETHER_DEFAULT, envKeys: ['TOGETHER_API_KEY'] },
  fireworks: { label: 'Fireworks', baseUrl: 'https://api.fireworks.ai/inference/v1', model: FIREWORKS_DEFAULT, envKeys: ['FIREWORKS_API_KEY'] },
  // Local / self-hosted
  apple: { label: 'Apple Intelligence', model: 'on-device', envKeys: [], local: true },
  ollama: { label: 'Ollama', baseUrl: 'http://localhost:11434/v1', envKeys: [], local: true },
  lmstudio: { label: 'LM Studio', baseUrl: 'http://localhost:1234/v1', envKeys: [], local: true },
  llamacpp: { label: 'llama.cpp', baseUrl: 'http://localhost:8080/v1', envKeys: [], local: true },
  vllm: { label: 'vLLM', baseUrl: 'http://localhost:8000/v1', envKeys: [], local: true },
  custom: { label: 'OpenAI-compatible server', envKeys: [], local: true },
};

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS);

/** Env auto-detect order when --ai-provider is omitted: OpenRouter stays the preferred bridge. */
const DETECT_ORDER = ['openrouter', 'groq', 'gemini', 'deepseek', 'cerebras', 'mistral', 'together', 'fireworks', 'anthropic', 'openai'];

/** Every env var auto-detect looks at, for help text. */
export const AI_ENV_KEYS = DETECT_ORDER.flatMap(id => AI_PROVIDERS[id].envKeys);

export interface AIRequestOptions {
  aiProvider?: string;
  aiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
}

export interface ResolvedAI {
  provider: string;
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  jsonMode: boolean;
  anthropic: boolean;
  local: boolean;
  /** One-line notice to show the user (e.g. "using local Ollama"). */
  notice?: string;
  /** Apple Intelligence: the compiled on-device helper. */
  helper?: string;
}

export type AIResolution = { ok: true; ai: ResolvedAI } | { ok: false; error: string; hints: string[] };

type Env = Record<string, string | undefined>;

/** Key prefixes specific enough to identify the provider of a bare --ai-key. */
function providerFromKey(key: string): string | undefined {
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('csk-')) return 'cerebras';
  return undefined;
}

/** Ollama's own OLLAMA_HOST convention: "host:port", "host", or a full URL. */
export function ollamaBaseUrl(env: Env): string {
  const raw = env.OLLAMA_HOST?.trim();
  if (!raw) return AI_PROVIDERS.ollama.baseUrl!;
  try {
    const hasScheme = /^https?:\/\//i.test(raw);
    const u = new URL(hasScheme ? raw : `http://${raw}`);
    if (!hasScheme && !/:\d+$/.test(raw)) u.port = '11434';
    // 0.0.0.0 is a bind address (common in OLLAMA_HOST for serving), not a destination.
    if (u.hostname === '0.0.0.0') u.hostname = '127.0.0.1';
    return `${u.origin}/v1`;
  } catch {
    return AI_PROVIDERS.ollama.baseUrl!;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Is an Ollama server answering at this base URL? Returns its installed
 * model names (possibly empty), or null when nothing is listening. Short
 * timeout: this runs on every `--ai` audit that has no key configured.
 */
export async function probeOllama(baseUrl: string, timeoutMs = 800): Promise<string[] | null> {
  try {
    const origin = new URL(baseUrl).origin;
    const res = await fetchWithTimeout(`${origin}/api/tags`, {}, timeoutMs);
    if (!res.ok) return null;
    const data = await res.json() as { models?: Array<{ name?: string; model?: string }> };
    return (data.models || []).map(m => m.name || m.model || '').filter(Boolean);
  } catch {
    return null;
  }
}

/** First model an OpenAI-compatible server reports at GET {base}/models. */
async function firstServerModel(baseUrl: string, apiKey: string | undefined): Promise<{ model?: string; unreachable?: boolean }> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    }, 5000);
    if (!res.ok) return {};
    const data = await res.json() as { data?: Array<{ id?: string }> };
    return { model: data.data?.find(m => m.id)?.id };
  } catch {
    return { unreachable: true };
  }
}

function noProviderHints(): string[] {
  return [
    'On a Mac with Apple Intelligence (macOS 26+), the on-device model is used automatically',
    `Set one of ${AI_ENV_KEYS.join(', ')}, or pass --ai-key`,
    'Or run a local model: start Ollama (https://ollama.com) and `ollama pull llama3.2` - it is picked up automatically',
    'Or point at any OpenAI-compatible server: --ai-base-url http://localhost:8080/v1 --ai-model <name>',
  ];
}

function appleResolution(status: AppleAIStatus & { available: true }, notice?: string): AIResolution {
  const preset = AI_PROVIDERS.apple;
  return {
    ok: true,
    ai: {
      provider: 'apple',
      label: preset.label,
      baseUrl: '',
      model: preset.model!,
      jsonMode: false,
      anthropic: false,
      local: true,
      helper: status.helper,
      notice,
    },
  };
}

export async function resolveAIProvider(
  opts: AIRequestOptions,
  env: Env = process.env,
  probe: (baseUrl: string) => Promise<string[] | null> = probeOllama,
  probeApple: (env: Env) => Promise<AppleAIStatus> = checkAppleAI,
): Promise<AIResolution> {
  // --ai-provider, else a standing choice in RANKCLI_AI_PROVIDER.
  const requested = opts.aiProvider?.trim() || (!opts.aiKey && !opts.aiBaseUrl ? env.RANKCLI_AI_PROVIDER?.trim() : undefined);
  let provider = requested?.toLowerCase();
  let notice: string | undefined;
  let ollamaModels: string[] | null = null;

  if (provider && !AI_PROVIDERS[provider]) {
    return {
      ok: false,
      error: `Unknown AI provider "${requested}"`,
      hints: [`Choose one of: ${AI_PROVIDER_IDS.join(', ')}`],
    };
  }

  if (provider === 'apple') {
    const apple = await probeApple(env);
    if (!apple.available) {
      return {
        ok: false,
        error: `Apple Intelligence isn't available: ${apple.reason}`,
        hints: ['Choose another provider with --ai-provider (e.g. openrouter, ollama)'],
      };
    }
    return appleResolution(apple);
  }

  if (!provider) {
    if (opts.aiBaseUrl) {
      provider = 'custom';
    } else if (opts.aiKey) {
      // A bare --ai-key has always meant OpenAI; recognisable prefixes win.
      provider = providerFromKey(opts.aiKey) ?? 'openai';
    } else {
      // On a Mac with Apple Intelligence, the on-device model is the default: free, local
      // and no network round trip - ahead of any API key that happens to be in the env.
      const apple = await probeApple(env);
      if (apple.available) {
        return appleResolution(apple, 'Using Apple Intelligence on this Mac (on-device, free) - pass --ai-provider to use another');
      }
      provider = DETECT_ORDER.find(id => AI_PROVIDERS[id].envKeys.some(k => env[k]));
    }
  }

  if (!provider) {
    // No key anywhere: use a local Ollama if one is running.
    const base = ollamaBaseUrl(env);
    ollamaModels = await probe(base);
    if (ollamaModels === null) {
      return { ok: false, error: 'AI analysis requested but no AI provider is configured', hints: noProviderHints() };
    }
    provider = 'ollama';
    notice = `No AI key set - using local Ollama at ${base}`;
  }

  const preset = AI_PROVIDERS[provider];
  const baseUrl = (opts.aiBaseUrl || (provider === 'ollama' ? ollamaBaseUrl(env) : preset.baseUrl) || '').replace(/\/+$/, '');
  if (!baseUrl) {
    return {
      ok: false,
      error: 'The custom provider needs --ai-base-url',
      hints: ['e.g. --ai-base-url http://localhost:8080/v1 --ai-model <name>'],
    };
  }
  try {
    new URL(baseUrl);
  } catch {
    return { ok: false, error: `Invalid --ai-base-url "${opts.aiBaseUrl}"`, hints: ['Use a full URL such as http://localhost:11434/v1'] };
  }

  const apiKey = opts.aiKey || preset.envKeys.map(k => env[k]).find(Boolean) || undefined;
  if (!apiKey && !preset.local) {
    return {
      ok: false,
      error: `No API key for ${preset.label}`,
      hints: [`Set ${preset.envKeys.join(' or ')}, or pass --ai-key`],
    };
  }

  let model = opts.aiModel || preset.model;
  if (!model && provider === 'ollama') {
    ollamaModels ??= await probe(baseUrl);
    if (ollamaModels === null) {
      return { ok: false, error: `Could not reach Ollama at ${baseUrl}`, hints: ['Start it with `ollama serve`, or set OLLAMA_HOST'] };
    }
    // Embedding models (nomic-embed-text, mxbai-embed-large, ...) are
    // installed alongside chat models but can't answer a chat request.
    model = ollamaModels.find(name => !/embed/i.test(name));
    if (!model) {
      return { ok: false, error: 'Ollama is running but has no chat models installed', hints: ['Install one, e.g. `ollama pull llama3.2`, or pass --ai-model'] };
    }
  }
  if (!model) {
    const found = await firstServerModel(baseUrl, apiKey);
    if (found.unreachable) {
      return { ok: false, error: `Could not reach ${preset.label} at ${baseUrl}`, hints: ['Is the server running? Or pass a different --ai-base-url'] };
    }
    model = found.model;
    if (!model) {
      return { ok: false, error: `${preset.label} at ${baseUrl} did not report a loaded model`, hints: ['Pass --ai-model <name>'] };
    }
  }

  if (notice) notice += ` (model ${model})`;

  return {
    ok: true,
    ai: {
      provider,
      label: preset.label,
      baseUrl,
      model,
      apiKey,
      // A base-URL override may point anywhere; only trust JSON mode on the real endpoint.
      jsonMode: !!preset.jsonMode && !opts.aiBaseUrl,
      anthropic: !!preset.anthropic,
      local: !!preset.local,
      notice,
    },
  };
}

// ---------------------------------------------------------------------------
// Defensive JSON extraction
// ---------------------------------------------------------------------------

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    // Local models love trailing commas.
    try {
      return JSON.parse(text.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return undefined;
    }
  }
}

/** The balanced {...} starting at `start`, honouring strings and escapes. */
function balancedObjectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * The first JSON object in a model reply: strips <think> blocks and ```json
 * fences, skips leading prose, and tolerates trailing commas. Returns null
 * if there is no parseable object.
 */
export function extractJsonObject(content: string): Record<string, unknown> | null {
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const sources = fenced ? [fenced[1], text] : [text];
  for (const source of sources) {
    let from = source.indexOf('{');
    let attempts = 0;
    while (from !== -1 && attempts++ < 50) {
      const candidate = balancedObjectAt(source, from);
      if (candidate) {
        const parsed = tryParse(candidate);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      }
      from = source.indexOf('{', from + 1);
    }
  }
  return null;
}

/** Coerce a model's loosely-shaped reply into AIAnalysis, or null if it isn't one. */
export function normalizeAnalysis(raw: Record<string, unknown>): AIAnalysis | null {
  const score = Number(raw.contentScore);
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.map(s => (typeof s === 'string' ? s : JSON.stringify(s))).filter(Boolean)
    : [];
  const prioritizedFixes = Array.isArray(raw.prioritizedFixes)
    ? raw.prioritizedFixes
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && 'code' in f)
        .map(f => ({
          code: String(f.code),
          priority: Number(f.priority) || 3,
          rationale: String(f.rationale ?? ''),
        }))
    : [];
  if (!Number.isFinite(score) && suggestions.length === 0 && prioritizedFixes.length === 0) return null;
  return {
    contentScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    suggestions,
    prioritizedFixes,
  };
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = { critical: 0, error: 1, warning: 2, notice: 3, info: 3 };
// Local models often have small context windows; the top of the list is what matters anyway.
const MAX_ISSUES_IN_PROMPT = 60;
// Apple's on-device model has a 4,096-token window for prompt and reply together.
const APPLE_MAX_ISSUES = 25;
const APPLE_MAX_TOKENS = 1200;

export function buildPrompt(url: string, issues: AuditIssue[], maxIssues = MAX_ISSUES_IN_PROMPT): string {
  const ranked = [...issues].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));
  const shown = ranked.slice(0, maxIssues);
  const more = ranked.length > shown.length ? `\n(${ranked.length - shown.length} lower-severity issues omitted)` : '';
  return `Analyze these SEO audit results and provide prioritized recommendations:

URL: ${url}

Issues found:
${shown.map(i => `- [${i.severity.toUpperCase()}] ${i.code}: ${i.title}`).join('\n')}${more}

Respond with only this JSON object - no prose, no code fences:
{
  "contentScore": <0-100 overall content quality>,
  "suggestions": [<3-5 high-impact suggestions, as strings>],
  "prioritizedFixes": [
    {"code": "<issue code>", "priority": <1-5>, "rationale": "<why fix this first>"}
  ]
}`;
}

export async function runAIAnalysis(
  url: string,
  issues: AuditIssue[],
  ai: ResolvedAI,
): Promise<{ analysis: AIAnalysis } | { error: string }> {
  const system = 'You are an SEO expert. Respond with valid JSON only.';

  if (ai.provider === 'apple' && ai.helper) {
    const reply = await generateWithAppleAI(ai.helper, {
      system,
      prompt: buildPrompt(url, issues, APPLE_MAX_ISSUES),
      maxTokens: APPLE_MAX_TOKENS,
    });
    if ('error' in reply) return { error: `${ai.label} request failed: ${reply.error}` };
    return parseAnalysis(reply.text, ai);
  }

  const prompt = buildPrompt(url, issues);
  // Local models on a laptop CPU can take minutes; hosted ones shouldn't.
  const timeoutMs = ai.local ? 300_000 : 90_000;
  // Generous: reasoning models (gpt-oss, GPT-5.6, DeepSeek) spend part of
  // the budget thinking, and an exhausted budget returns empty content.
  const maxTokens = 4096;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let endpoint: string;
  let body: Record<string, unknown>;

  if (ai.anthropic) {
    endpoint = `${ai.baseUrl}/messages`;
    headers['x-api-key'] = ai.apiKey || '';
    headers['anthropic-version'] = '2023-06-01';
    body = { model: ai.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] };
  } else {
    endpoint = `${ai.baseUrl}/chat/completions`;
    if (ai.apiKey) headers['Authorization'] = `Bearer ${ai.apiKey}`;
    if (ai.provider === 'openrouter') {
      // Attributes usage to RankCLI in OpenRouter's dashboard.
      headers['HTTP-Referer'] = 'https://rankcli.dev';
      headers['X-Title'] = 'RankCLI';
    }
    body = {
      model: ai.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      // OpenAI's GPT-5.6 rejects max_tokens (and temperature); everyone else expects max_tokens.
      ...(ai.provider === 'openai' && !ai.local ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      ...(ai.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(endpoint, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs);
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? `timed out after ${Math.round(timeoutMs / 1000)}s`
      : error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error);
    return { error: `${ai.label} request failed: ${reason}` };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    return { error: `${ai.label} returned HTTP ${response.status}${detail ? `: ${detail}` : ''}` };
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    return { error: `${ai.label} returned a non-JSON response` };
  }

  const content = ai.anthropic
    ? (data.content as Array<{ type?: string; text?: string }> | undefined)?.filter(b => typeof b.text === 'string').map(b => b.text).join('')
    : (data.choices as Array<{ message?: { content?: string | null } }> | undefined)?.[0]?.message?.content;

  if (!content) {
    return { error: `${ai.label} returned no content (a reasoning model may have used its whole token budget - try another --ai-model)` };
  }

  return parseAnalysis(content, ai);
}

function parseAnalysis(content: string, ai: ResolvedAI): { analysis: AIAnalysis } | { error: string } {
  const parsed = extractJsonObject(content);
  const analysis = parsed ? normalizeAnalysis(parsed) : null;
  if (!analysis) {
    return { error: `${ai.label} (${ai.model}) did not return the requested JSON` };
  }
  return { analysis };
}
