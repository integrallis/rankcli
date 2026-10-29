import type { AuditIssue } from './types.js';

/**
 * One condition, one finding.
 *
 * The checks grew up independently and several report the same missing thing under their own
 * codes: a page with no viewport tag got VIEWPORT_MISSING (error), HTML_NO_VIEWPORT (warning)
 * and RESPONSIVE_NO_VIEWPORT (error); a site with no testimonials got six findings from four
 * checks; a client-rendered shell got the same diagnosis five times. The issue count is the
 * number people quote, and padding it teaches them the list is noise.
 *
 * Each rule names the code that stays and the codes it makes redundant whenever it is present.
 * A code is only dropped when its primary is in the same report, so a check that fires alone is
 * untouched. The rules are read against the report as the checks produced it, so a code dropped
 * by one rule still triggers its own.
 */
export const REDUNDANT_WHEN_PRESENT: ReadonlyArray<{ keep: string | RegExp; drop: readonly string[] }> = [
  // The same tag, reported by three checks.
  { keep: 'VIEWPORT_MISSING', drop: ['HTML_NO_VIEWPORT', 'RESPONSIVE_NO_VIEWPORT'] },
  { keep: 'LANG_ATTR_MISSING', drop: ['HTML_NO_LANG'] },
  { keep: 'APPLE_TOUCH_ICON_MISSING', drop: ['HTML_NO_APPLE_TOUCH_ICON'] },
  { keep: 'LLMS_TXT_MISSING', drop: ['AI_NO_LLMS_TXT'] },
  { keep: 'INDEXNOW_NOT_IMPLEMENTED', drop: ['BING_NO_INDEXNOW'] },
  { keep: 'BING_VERIFICATION_MISSING', drop: ['BING_NOT_VERIFIED'] },
  { keep: 'SITEMAP_MISSING', drop: ['BING_SITEMAP_MISSING', 'SITEMAP_NOT_IN_ROBOTS'] },
  { keep: 'ROBOTS_TXT_MISSING', drop: ['SITEMAP_NOT_IN_ROBOTS'] },
  { keep: 'IMAGES_MISSING_DIMENSIONS', drop: ['IMG_NO_DIMENSIONS'] },
  { keep: 'NO_MODERN_IMAGE_FORMATS', drop: ['IMAGE_NOT_WEBP_AVIF'] },
  { keep: 'SOCIAL_PROFILES_NOT_LINKED', drop: ['NO_SOCIAL_PROFILES'] },
  { keep: 'NO_EXPERIENCE_SIGNALS', drop: ['AI_NO_EXPERIENCE_SIGNALS'] },

  // No structured data at all makes every "your schema lacks X" finding moot.
  {
    keep: 'SCHEMA_MISSING',
    drop: [
      'SCHEMA_ORG_MISSING', 'NO_ORGANIZATION_SCHEMA', 'ORGANIZATION_SCHEMA_MISSING', 'NO_ENTITY_SCHEMA',
      'NO_DATE_MODIFIED_SCHEMA', 'NO_MAIN_ENTITY_OF_PAGE', 'AUTHOR_NO_SCHEMA', 'AI_NO_REVIEW_SCHEMA', 'NO_SCHEMA_SAMEAS',
    ],
  },
  { keep: 'NO_ORGANIZATION_SCHEMA', drop: ['ORGANIZATION_SCHEMA_MISSING'] },

  // No title, no H1: the findings about their wording are implied.
  { keep: 'TITLE_MISSING', drop: ['LOW_CTR_POTENTIAL', 'NO_KEYWORDS_IN_TITLE', 'TITLE_TOO_SHORT'] },
  { keep: 'META_DESC_MISSING', drop: ['LOW_CTR_POTENTIAL'] },
  { keep: 'H1_MISSING', drop: ['NO_VISIBLE_HEADLINE', 'NO_KEYWORDS_IN_H1', 'H1_MISSING_KEYWORD'] },

  // Client-side rendering, diagnosed once. CLIENT_SIDE_RENDERING carries the per-framework fix.
  {
    keep: 'CLIENT_SIDE_RENDERING',
    drop: [
      'REACT_CSR_DETECTED', 'VUE_CSR_DETECTED', 'ANGULAR_NO_UNIVERSAL', 'SPA_WITHOUT_SSR',
      'EMPTY_BODY_CONTENT', 'HIGH_JS_RENDERING_RATIO', 'AI_LOW_HTML_READABILITY',
    ],
  },
  // An empty body has no vocabulary to be undiverse.
  { keep: 'EMPTY_BODY_CONTENT', drop: ['THIN_CONTENT', 'LOW_CONTENT_ENTROPY', 'HIGH_CONTENT_REPETITION', 'LOW_DWELL_TIME_CONTENT', 'LOW_TEXT_HTML_RATIO'] },
  { keep: 'THIN_CONTENT', drop: ['LOW_DWELL_TIME_CONTENT'] },

  { keep: 'NO_INTERNAL_LINKS', drop: ['NO_CONTENT_INTERNAL_LINKS', 'HIGH_ORPHAN_RISK', 'LINKS_NO_INTERNAL'] },

  // No testimonials on the page, said once instead of six times.
  { keep: 'NO_SOCIAL_PROOF', drop: ['BOFU_NO_SOCIAL_PROOF', 'AI_NO_TESTIMONIALS', 'AI_NO_REVIEW_INTEGRATION', 'AI_NO_REVIEW_PLATFORMS', 'AI_WEAK_REVIEW_ECOSYSTEM'] },
  { keep: 'AI_NO_TESTIMONIALS', drop: ['AI_NO_REVIEW_INTEGRATION', 'AI_NO_REVIEW_PLATFORMS', 'AI_WEAK_REVIEW_ECOSYSTEM'] },
  // The brand-score composite restates the brand-definition finding it is built from.
  { keep: 'AI_NO_BRAND_DEFINITION', drop: ['AI_LOW_BRAND_SCORE', 'NO_ENTITY_DEFINITION'] },
];

/**
 * Drop the findings that another finding in the same list already covers, and collapse any
 * code reported twice (its affected URLs are merged into the first).
 */
export function dedupeIssues(issues: AuditIssue[]): AuditIssue[] {
  const present = new Set(issues.map((i) => i.code));
  const redundant = new Set<string>();
  for (const rule of REDUNDANT_WHEN_PRESENT) {
    const fires = typeof rule.keep === 'string'
      ? present.has(rule.keep)
      : [...present].some((code) => (rule.keep as RegExp).test(code));
    if (!fires) continue;
    for (const code of rule.drop) redundant.add(code);
  }

  const kept = new Map<string, AuditIssue>();
  const out: AuditIssue[] = [];
  for (const issue of issues) {
    if (redundant.has(issue.code)) continue;
    const earlier = kept.get(issue.code);
    if (earlier) {
      const urls = new Set([...(earlier.affectedUrls || []), ...(issue.affectedUrls || [])]);
      earlier.affectedUrls = [...urls];
      continue;
    }
    const copy = { ...issue };
    kept.set(issue.code, copy);
    out.push(copy);
  }
  return out;
}
