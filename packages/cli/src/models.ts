/**
 * THE MODELS THE CLI ASKS, IN ONE PLACE.
 *
 * The ids were literals inline in the request bodies, so a provider retirement meant grepping.
 * Anthropic retired `claude-3-haiku-20240307` on 2026-04-20 and this kept sending it until the
 * failure notice arrived. Each id below sits in the same price tier as the one it replaces.
 */

/* GPT-5.6 is a reasoning family: on chat/completions it rejects `temperature` (and `top_p`) at any
 * value and takes `max_completion_tokens`, not `max_tokens`. A rejected call looks like "not
 * mentioned" wherever the caller swallows !response.ok, so send neither. */

/** ChatGPT — replaces `gpt-4o-mini`, the fast tier this has always used. */
export const OPENAI_FAST = 'gpt-5.6-luna';

/** Claude — replaces the retired `claude-3-haiku-20240307`. */
export const ANTHROPIC_FAST = 'claude-haiku-4-5-20251001';

/* Defaults for `rankcli audit --ai` on the other OpenAI-compatible providers (see lib/ai.ts).
 * Each is that provider's cheap general-purpose tier as of 2026-09; `--ai-model` overrides any of
 * them. Local servers (ollama, lmstudio, llamacpp, vllm, custom) have no default here - the CLI
 * asks the server which models it has loaded. */

/** OpenRouter's free router - picks a currently-free model per request. */
export const OPENROUTER_DEFAULT = 'openrouter/free';

/** Groq — still a production model on Groq's list (2026-09). */
export const GROQ_DEFAULT = 'llama-3.3-70b-versatile';

/** Gemini via its OpenAI-compatibility endpoint - same id the rest of the repo pins. */
export const GEMINI_DEFAULT = 'gemini-3.7-flash';

/** DeepSeek — `deepseek-chat` was retired 2026-07-24; `deepseek-flash` is V4.1 Flash. */
export const DEEPSEEK_DEFAULT = 'deepseek-flash';

/** Mistral — alias for their current small model. */
export const MISTRAL_DEFAULT = 'mistral-small-latest';

/* gpt-oss-120b is served by Together, Fireworks and Cerebras alike at ~$0.15/M input, so the
 * three share one model and differ only in id format. */
export const TOGETHER_DEFAULT = 'openai/gpt-oss-120b';
export const FIREWORKS_DEFAULT = 'accounts/fireworks/models/gpt-oss-120b';
export const CEREBRAS_DEFAULT = 'gpt-oss-120b';
