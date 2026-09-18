/**
 * THE MODELS THIS RUNTIME ASKS, IN ONE PLACE.
 *
 * Only the ids that are DEAD live here so far. Anthropic retired `claude-3-haiku-20240307` on
 * 2026-04-20; `gemini-pro` and the `llama-3.1-sonar-*` line went with it and nothing noticed,
 * because each id was a literal at its call site and no list said which were still served.
 *
 * The gpt-4o family this package uses elsewhere is OLD but still served, and those calls are
 * internal analysis rather than the visibility measurement, so they are deliberately left where
 * they are: moving them is a judgement about cost and about parameters (`temperature`) that no test
 * here can settle.
 */

/** Gemini — replaces `gemini-pro`, which no longer resolves. Named in the URL, not the body, and on
 *  `v1beta`: the `v1` path this used does not serve the current models. */
export const GOOGLE_FAST = 'gemini-3.7-flash';

export const GOOGLE_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_FAST}:generateContent`;

/* GPT-5.6 is a reasoning family: on chat/completions it rejects `temperature` (and `top_p`) at any
 * value and takes `max_completion_tokens`, not `max_tokens`. A rejected call looks like "not
 * mentioned" wherever the caller swallows !response.ok, so send neither. */

/** ChatGPT — the visibility tracker asks the flagship, because what a person is answered by is what
 *  the tracker claims to measure. */
export const OPENAI_FLAGSHIP = 'gpt-5.6';
