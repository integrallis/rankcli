/**
 * Is the metadata where a crawler reads it: in the <head> of the initial HTML?
 *
 * The most reproducible SEO failure in developer write-ups is Next.js streaming metadata.
 * The app router waits for `generateMetadata` only for user agents on its own bot list, so
 * Googlebot gets a complete <head> while a plain fetch, a link preview, OAI-SearchBot or
 * Claude-SearchBot gets a page whose canonical "literally doesn't exist yet" and arrives
 * later in the body: "Duplicate without user-selected canonical", "a flat line, zero
 * impressions" for weeks (dev.to; vercel/next.js#80868, #98748). Google documents that it
 * ignores a <link rel="canonical"> outside <head>, and an HTML parser closes <head> at the
 * first body content, so a tag emitted late lands in the body whether or not the framework
 * meant it to. Neither a browser nor a full-render crawler shows this; the initial HTML does,
 * which is what this audit reads anyway.
 *
 * Two findings. METADATA_STREAMED_FOR_BOTS: fetched as Googlebot the tags are in <head>,
 * fetched as this audit (not on anyone's bot list) they are not. METADATA_OUTSIDE_HEAD: the
 * page has them inside <body> for everyone. The second request is made only when something
 * is missing or misplaced in the page as fetched, so a well-formed page costs nothing extra.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { httpGet } from '../../utils/http.js';
import { KNOWN_BOTS } from './ai-bots.js';

const TAGS = [
  { label: '<title>', select: 'title' },
  { label: 'the meta description', select: 'meta[name="description"]' },
  { label: 'the canonical link', select: 'link[rel="canonical"]' },
  { label: 'the robots meta', select: 'meta[name="robots"]' },
] as const;

export interface Placement {
  inHead: string[];
  inBody: string[];
}

/**
 * Which of the tags that matter sit in <head>, and which ended up in <body> instead. A tag in
 * the body counts only when <head> has none of it: a second copy is the duplicate-title
 * check's business, and an inline icon's <svg><title> is not a page title at all (that one
 * reported 41 of 367 well-built sites in the first corpus run).
 */
export function metadataPlacement(html: string): Placement {
  const $ = cheerio.load(html);
  const inHead: string[] = [];
  const inBody: string[] = [];
  for (const tag of TAGS) {
    const inHeadCount = $(`head ${tag.select}`).length;
    if (inHeadCount > 0) inHead.push(tag.label);
    const bodyMatches = $(`body ${tag.select}`).filter((_, el) => $(el).closest('svg').length === 0);
    if (inHeadCount === 0 && bodyMatches.length > 0) inBody.push(tag.label);
  }
  return { inHead, inBody };
}

const GOOGLEBOT_UA = KNOWN_BOTS.find((bot) => bot.name === 'Googlebot')!.userAgent!;

async function fetchAs(url: string, userAgent: string): Promise<string | null> {
  try {
    const response = await httpGet<string>(url, {
      headers: { 'User-Agent': userAgent },
      timeout: 8000,
      validateStatus: () => true,
    });
    return response.status === 200 && typeof response.data === 'string' ? response.data : null;
  } catch {
    return null;
  }
}

function list(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export interface MetadataPlacementResult {
  issues: AuditIssue[];
  data: { page: Placement; googlebot?: Placement; streamed: string[] };
}

export async function analyzeMetadataPlacement(
  html: string,
  url: string,
  options: { compareAsGooglebot?: boolean } = {}
): Promise<MetadataPlacementResult> {
  const page = metadataPlacement(html);
  const data: MetadataPlacementResult['data'] = { page, streamed: [] };
  const issues: AuditIssue[] = [];

  // A robots meta is optional, so its absence alone is no reason to ask Googlebot; a missing
  // title, description or canonical, or anything in <body>, is.
  const essential = TAGS.slice(0, 3).map((t) => t.label);
  const suspicious = essential.some((label) => !page.inHead.includes(label)) || page.inBody.length > 0;
  if (options.compareAsGooglebot !== false && suspicious) {
    const asGooglebot = await fetchAs(url, GOOGLEBOT_UA);
    if (asGooglebot) {
      data.googlebot = metadataPlacement(asGooglebot);
      data.streamed = data.googlebot.inHead.filter((label) => !page.inHead.includes(label));
    }
  }

  if (data.streamed.length > 0) {
    const labels = list(data.streamed);
    const inBody = data.streamed.filter((label) => page.inBody.includes(label));
    const where = inBody.length === data.streamed.length ? 'they arrive later, inside <body>' : inBody.length > 0 ? 'some arrive later inside <body> and the rest not at all' : 'they are absent';
    issues.push({
      code: 'METADATA_STREAMED_FOR_BOTS',
      severity: 'warning',
      category: 'indexability',
      title: `${labels} reach Googlebot but not other agents`,
      description: `Fetched as Googlebot, this page has ${labels} in <head>. Fetched as this audit, which is on no framework's bot list, ${where}. Next.js app router streams metadata this way: it waits for it only for user agents it recognises, so OAI-SearchBot, Claude-SearchBot, PerplexityBot, link previews and any crawler it does not list read the page without it.`,
      impact:
        'Google may still index the page correctly; every other reader gets it without a canonical or a description. That is the "Duplicate without user-selected canonical" and zero-impressions failure in the Next.js reports, and for AI search a page with nothing to cite.',
      howToFix:
        'Serve the metadata in the initial HTML to everyone. Next.js: list the AI crawlers in `htmlLimitedBots` in next.config (OAI-SearchBot, Claude-SearchBot, PerplexityBot, ChatGPT-User, Claude-User), or make the route’s metadata synchronous so nothing is streamed. Other frameworks: emit <title>, the description and the canonical before any body content.',
      affectedUrls: [url],
      details: { streamed: data.streamed, page, googlebot: data.googlebot },
    });
  } else if (page.inBody.length > 0) {
    const labels = list(page.inBody);
    issues.push({
      code: 'METADATA_OUTSIDE_HEAD',
      severity: 'warning',
      category: 'indexability',
      title: `${labels} sit inside <body>, where crawlers do not read them`,
      description: `${labels} appear after the first body content. The HTML parser closes <head> at that point, so they land in <body>; Google documents that a canonical outside <head> is ignored, and a description there is not used as a snippet.`,
      impact: 'The page can be indexed under a URL you did not choose and shown without its description.',
      howToFix:
        'Emit the metadata before any body content: from the server-rendered <head>, not from a component that renders late or a script that injects tags after load.',
      affectedUrls: [url],
      details: { inBody: page.inBody, inHead: page.inHead },
    });
  }

  return { issues, data };
}
