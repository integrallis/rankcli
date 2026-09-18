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
