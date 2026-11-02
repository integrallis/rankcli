/**
 * The crawlers that matter for search and AI answers, grouped by what each one is for.
 *
 * The class is the point. OpenAI documents that GPTBot only collects training data and that
 * "sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers"
 * (https://developers.openai.com/api/docs/bots). Anthropic documents the same split between
 * ClaudeBot (training) and Claude-SearchBot (search), plus a third kind, Claude-User, that
 * fetches one page because a user asked about it. So refusing a training crawler is a choice
 * that costs no visibility (17 percent of Cloudflare zones make it), refusing a search crawler
 * removes the site from that engine's answers, and refusing a user-triggered fetcher means the
 * assistant cannot read the page a user just pasted. One finding per class, worded for that
 * consequence, is what a site owner can act on. One finding per bot, each saying "you will not
 * be cited", is what every robots.txt-only tool prints, and what this code used to print.
 *
 * Edge rules (Cloudflare, WAFs) match on the product token, so the user-agent strings carry
 * each vendor's published token; the boilerplate around it follows their documentation.
 */

export type BotClass = 'search' | 'ai-search' | 'user' | 'training';

export interface KnownBot {
  name: string;
  /** What the operator's documentation says the bot is for. */
  class: BotClass;
  /** The User-agent tokens robots.txt rules name for it, lower-case. */
  robotsTokens: readonly string[];
  /** The user-agent sent on a live fetch; null for tokens that exist only in robots.txt. */
  userAgent: string | null;
  /** What the site loses when this bot is refused. */
  loses: string;
}

export const KNOWN_BOTS: readonly KnownBot[] = [
  // Classic search indexes. 88 percent of ChatGPT citations come from the general search index
  // (Ahrefs, 2026), so these matter for AI answers as much as for organic traffic.
  {
    name: 'Googlebot',
    class: 'search',
    robotsTokens: ['googlebot'],
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    loses: 'Google Search and AI Overviews',
  },
  {
    name: 'bingbot',
    class: 'search',
    robotsTokens: ['bingbot'],
    userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    loses: 'Bing and Copilot',
  },
  // AI search crawlers: the index each assistant answers from.
  {
    name: 'OAI-SearchBot',
    class: 'ai-search',
    robotsTokens: ['oai-searchbot'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
    loses: 'ChatGPT search answers',
  },
  {
    name: 'Claude-SearchBot',
    class: 'ai-search',
    robotsTokens: ['claude-searchbot'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)',
    loses: 'Claude search results',
  },
  {
    name: 'PerplexityBot',
    class: 'ai-search',
    robotsTokens: ['perplexitybot'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    loses: 'Perplexity answers',
  },
  // User-triggered fetchers: retrieve one page because a user pasted its link or asked about it.
  {
    name: 'ChatGPT-User',
    class: 'user',
    robotsTokens: ['chatgpt-user'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
    loses: 'ChatGPT reading a page a user asks about',
  },
  {
    name: 'Claude-User',
    class: 'user',
    robotsTokens: ['claude-user'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
    loses: 'Claude reading a page a user asks about',
  },
  {
    name: 'Perplexity-User',
    class: 'user',
    robotsTokens: ['perplexity-user'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
    loses: 'Perplexity reading a page a user asks about',
  },
  // Training crawlers: model-training data, nothing a user sees. Both OpenAI and Anthropic
  // document that disallowing these has no effect on search answers.
  {
    name: 'GPTBot',
    class: 'training',
    robotsTokens: ['gptbot'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
    loses: "OpenAI's training corpus",
  },
  {
    name: 'ClaudeBot',
    class: 'training',
    // Claude-Web and anthropic-ai are the older tokens still found in robots.txt files.
    robotsTokens: ['claudebot', 'claude-web', 'anthropic-ai'],
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    loses: "Anthropic's training corpus",
  },
  {
    name: 'CCBot',
    class: 'training',
    robotsTokens: ['ccbot'],
    userAgent: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
    loses: 'Common Crawl, which several models train on',
  },
  {
    name: 'Google-Extended',
    class: 'training',
    robotsTokens: ['google-extended'],
    userAgent: null,
    loses: "Gemini's training data (Search is unaffected)",
  },
  {
    name: 'Bytespider',
    class: 'training',
    robotsTokens: ['bytespider'],
    userAgent: null,
    loses: "ByteDance's training corpus",
  },
];

export const BOT_CLASS_LABEL: Record<BotClass, string> = {
  search: 'search crawlers',
  'ai-search': 'AI search crawlers',
  user: 'user-triggered fetchers',
  training: 'AI training crawlers',
};

export function botsOfClass(cls: BotClass): KnownBot[] {
  return KNOWN_BOTS.filter((bot) => bot.class === cls);
}
