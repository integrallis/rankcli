// Platform Presence Check - Search Everywhere Optimization
// Reference: "The New Rules of SEO (2026)" by Neil Patel
// "It's not just about Google anymore"
// "Search Everywhere Optimization - You need to be on TikTok, Reddit, Amazon, YouTube, ChatGPT"
// "Cross-platform trust network - being mentioned on multiple platforms validates your brand"
// "RICE framework: Reach, Impact, Confidence, Effort for platform prioritization"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface PlatformLink {
  platform: string;
  url: string;
  type: 'profile' | 'content' | 'mention' | 'embed';
  location: 'header' | 'footer' | 'content' | 'sidebar' | 'schema';
}

export interface PlatformPresenceData {
  detectedPlatforms: string[];
  platformLinks: PlatformLink[];
  socialProfiles: {
    platform: string;
    url: string;
    hasSchemaMarkup: boolean;
  }[];
  embeddedContent: {
    platform: string;
    count: number;
  }[];
  metrics: {
    totalPlatforms: number;
    hasYouTube: boolean;
    hasTikTok: boolean;
    hasTwitter: boolean;
    hasLinkedIn: boolean;
    hasReddit: boolean;
    hasFacebook: boolean;
    hasInstagram: boolean;
    hasPinterest: boolean;
    hasPodcast: boolean;
    hasGitHub: boolean;
  };
  schemaPresence: {
    hasSameAs: boolean;
    sameAsUrls: string[];
    hasOrganizationSchema: boolean;
    hasPersonSchema: boolean;
  };
  crossPlatformScore: number; // 0-100
  recommendations: string[];
}

// Platform detection patterns
const PLATFORM_PATTERNS: {
  name: string;
  urlPatterns: RegExp[];
  embedPatterns?: RegExp[];
  priority: 'high' | 'medium' | 'low'; // RICE-based priority
}[] = [
  {
    name: 'YouTube',
    urlPatterns: [/youtube\.com/, /youtu\.be/],
    embedPatterns: [/youtube\.com\/embed/, /youtube-nocookie\.com/],
    priority: 'high',
  },
  {
    name: 'TikTok',
    urlPatterns: [/tiktok\.com/],
    embedPatterns: [/tiktok\.com\/embed/],
    priority: 'high',
  },
  {
    name: 'Twitter/X',
    urlPatterns: [/twitter\.com/, /x\.com/],
    embedPatterns: [/platform\.twitter\.com/],
    priority: 'high',
  },
  {
    name: 'LinkedIn',
    urlPatterns: [/linkedin\.com/],
    priority: 'high',
  },
  {
    name: 'Reddit',
    urlPatterns: [/reddit\.com/, /redd\.it/],
    priority: 'high',
  },
  {
    name: 'Facebook',
    urlPatterns: [/facebook\.com/, /fb\.com/, /fb\.me/],
    embedPatterns: [/facebook\.com\/plugins/],
    priority: 'medium',
  },
  {
    name: 'Instagram',
    urlPatterns: [/instagram\.com/, /instagr\.am/],
    embedPatterns: [/instagram\.com\/embed/],
    priority: 'medium',
  },
  {
    name: 'Pinterest',
    urlPatterns: [/pinterest\.com/, /pin\.it/],
    priority: 'medium',
  },
  {
    name: 'GitHub',
    urlPatterns: [/github\.com/],
    priority: 'medium',
  },
  {
    name: 'Medium',
    urlPatterns: [/medium\.com/],
    priority: 'low',
  },
  {
    name: 'Spotify',
    urlPatterns: [/spotify\.com/, /open\.spotify\.com/],
    embedPatterns: [/open\.spotify\.com\/embed/],
    priority: 'medium',
  },
  {
    name: 'Apple Podcasts',
    urlPatterns: [/podcasts\.apple\.com/],
    priority: 'medium',
  },
  {
    name: 'Discord',
    urlPatterns: [/discord\.gg/, /discord\.com/],
    priority: 'low',
  },
  {
    name: 'Twitch',
    urlPatterns: [/twitch\.tv/],
    embedPatterns: [/player\.twitch\.tv/],
    priority: 'low',
  },
  {
    name: 'Vimeo',
    urlPatterns: [/vimeo\.com/],
    embedPatterns: [/player\.vimeo\.com/],
    priority: 'low',
  },
  {
    name: 'ProductHunt',
    urlPatterns: [/producthunt\.com/],
    priority: 'medium',
  },
  {
    name: 'Substack',
    urlPatterns: [/substack\.com/],
    priority: 'low',
  },
  {
    name: 'Amazon',
    urlPatterns: [/amazon\.com/, /amzn\.to/],
    priority: 'medium',
  },
];

/**
 * Determine link location on page
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLinkLocation($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): PlatformLink['location'] {
  const parents = element.parents().toArray();

  for (const parent of parents) {
    const tagName = parent.tagName?.toLowerCase();
    const className = ($(parent).attr('class') || '').toLowerCase();

    if (tagName === 'header' || className.includes('header')) return 'header';
    if (tagName === 'footer' || className.includes('footer')) return 'footer';
    if (tagName === 'aside' || className.includes('sidebar')) return 'sidebar';
    if (tagName === 'main' || tagName === 'article' || className.includes('content')) return 'content';
  }

  return 'content';
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): string | null {
  const urlLower = url.toLowerCase();

  for (const platform of PLATFORM_PATTERNS) {
    if (platform.urlPatterns.some(p => p.test(urlLower))) {
      return platform.name;
    }
  }

  return null;
}

/**
 * Determine link type (profile, content, embed)
 */
function getLinkType(url: string, platform: string): PlatformLink['type'] {
  const urlLower = url.toLowerCase();

  // Profile patterns
  const profilePatterns = [
    /youtube\.com\/@/,
    /youtube\.com\/c\//,
    /youtube\.com\/channel\//,
    /twitter\.com\/[^/]+$/,
    /x\.com\/[^/]+$/,
    /linkedin\.com\/company\//,
    /linkedin\.com\/in\//,
    /instagram\.com\/[^/]+\/?$/,
    /tiktok\.com\/@/,
    /facebook\.com\/[^/]+\/?$/,
    /github\.com\/[^/]+\/?$/,
    /reddit\.com\/user\//,
    /reddit\.com\/r\/[^/]+\/?$/,
    /pinterest\.com\/[^/]+\/?$/,
  ];

  if (profilePatterns.some(p => p.test(urlLower))) {
    return 'profile';
  }

  // Embed detection
  const embedPatterns = [
    /embed/,
    /player\./,
    /plugins/,
  ];

  if (embedPatterns.some(p => p.test(urlLower))) {
    return 'embed';
  }

  return 'content';
}

/**
 * Extract platform links from HTML
 */
export function extractPlatformLinks(html: string): PlatformLink[] {
  const $ = cheerio.load(html);
  const links: PlatformLink[] = [];

  $('a[href]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href') || '';
    const platform = detectPlatform(href);

    if (platform) {
      links.push({
        platform,
        url: href,
        type: getLinkType(href, platform),
        location: getLinkLocation($, $el),
      });
    }
  });

  return links;
}

/**
 * Detect embedded content (iframes, embeds)
 */
export function detectEmbeddedContent(html: string): { platform: string; count: number }[] {
  const $ = cheerio.load(html);
  const embeds: Map<string, number> = new Map();

  // Check iframes
  $('iframe[src]').each((_, element) => {
    const src = $(element).attr('src') || '';
    const platform = detectPlatform(src);
    if (platform) {
      embeds.set(platform, (embeds.get(platform) || 0) + 1);
    }
  });

  // Check embed tags
  $('embed[src]').each((_, element) => {
    const src = $(element).attr('src') || '';
    const platform = detectPlatform(src);
    if (platform) {
      embeds.set(platform, (embeds.get(platform) || 0) + 1);
    }
  });

  // Check Twitter/X widgets
  if (html.includes('twitter-tweet') || html.includes('twitter-timeline')) {
    embeds.set('Twitter/X', (embeds.get('Twitter/X') || 0) + 1);
  }

  // Check TikTok embeds
  if (html.includes('tiktok-embed')) {
    embeds.set('TikTok', (embeds.get('TikTok') || 0) + 1);
  }

  return Array.from(embeds.entries()).map(([platform, count]) => ({ platform, count }));
}

/**
 * Extract schema.org social profiles
 */
export function extractSchemaProfiles(html: string): {
  sameAsUrls: string[];
  hasOrganizationSchema: boolean;
  hasPersonSchema: boolean;
} {
  const $ = cheerio.load(html);
  const sameAsUrls: string[] = [];
  let hasOrganizationSchema = false;
  let hasPersonSchema = false;

  // Find JSON-LD scripts
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const content = $(element).html() || '';
      const jsonData = JSON.parse(content);

      const processSchema = (schema: Record<string, unknown>) => {
        if (schema['@type'] === 'Organization') {
          hasOrganizationSchema = true;
        }
        if (schema['@type'] === 'Person') {
          hasPersonSchema = true;
        }

        // Extract sameAs URLs
        if (schema.sameAs) {
          if (Array.isArray(schema.sameAs)) {
            sameAsUrls.push(...(schema.sameAs as string[]));
          } else if (typeof schema.sameAs === 'string') {
            sameAsUrls.push(schema.sameAs);
          }
        }
      };

      if (Array.isArray(jsonData)) {
        jsonData.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            processSchema(item as Record<string, unknown>);
          }
        });
      } else if (typeof jsonData === 'object' && jsonData !== null) {
        processSchema(jsonData);

        // Check @graph
        if (Array.isArray(jsonData['@graph'])) {
          jsonData['@graph'].forEach((item: Record<string, unknown>) => {
            if (typeof item === 'object' && item !== null) {
              processSchema(item);
            }
          });
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  });

  return { sameAsUrls, hasOrganizationSchema, hasPersonSchema };
}

/**
 * Calculate cross-platform score
 */
function calculateCrossPlatformScore(
  platformCount: number,
  hasHighPriorityPlatforms: boolean,
  hasSchemaProfiles: boolean,
  hasEmbeddedContent: boolean
): number {
  let score = 0;

  // Platform count (max 50 points)
  score += Math.min(platformCount * 10, 50);

  // High priority platforms (max 30 points)
  if (hasHighPriorityPlatforms) {
    score += 30;
  }

  // Schema markup (10 points)
  if (hasSchemaProfiles) {
    score += 10;
  }

  // Embedded content (10 points)
  if (hasEmbeddedContent) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Main function: Analyze platform presence
 */
export function analyzePlatformPresence(
  html: string,
  url: string
): { issues: AuditIssue[]; data: PlatformPresenceData } {
  const issues: AuditIssue[] = [];

  // Extract platform links
  const platformLinks = extractPlatformLinks(html);

  // Get unique platforms
  const detectedPlatforms = [...new Set(platformLinks.map(l => l.platform))];

  // Extract social profiles (profile type links)
  const socialProfiles = platformLinks
    .filter(l => l.type === 'profile')
    .map(l => ({
      platform: l.platform,
      url: l.url,
      hasSchemaMarkup: false, // Updated below
    }));

  // Detect embedded content
  const embeddedContent = detectEmbeddedContent(html);

  // Extract schema profiles
  const schemaData = extractSchemaProfiles(html);

  // Mark profiles with schema markup
  socialProfiles.forEach(profile => {
    profile.hasSchemaMarkup = schemaData.sameAsUrls.some(schemaUrl =>
      schemaUrl.toLowerCase().includes(profile.platform.toLowerCase())
    );
  });

  // Calculate metrics
  const hasHighPriority = (name: string) => detectedPlatforms.includes(name);

  const metrics = {
    totalPlatforms: detectedPlatforms.length,
    hasYouTube: hasHighPriority('YouTube'),
    hasTikTok: hasHighPriority('TikTok'),
    hasTwitter: hasHighPriority('Twitter/X'),
    hasLinkedIn: hasHighPriority('LinkedIn'),
    hasReddit: hasHighPriority('Reddit'),
    hasFacebook: hasHighPriority('Facebook'),
    hasInstagram: hasHighPriority('Instagram'),
    hasPinterest: hasHighPriority('Pinterest'),
    hasPodcast: hasHighPriority('Spotify') || hasHighPriority('Apple Podcasts'),
    hasGitHub: hasHighPriority('GitHub'),
  };

  // High priority platforms present
  const highPriorityPlatforms = PLATFORM_PATTERNS
    .filter(p => p.priority === 'high')
    .map(p => p.name);
  const hasHighPriorityPlatforms = highPriorityPlatforms.some(p => detectedPlatforms.includes(p));

  // Calculate cross-platform score
  const crossPlatformScore = calculateCrossPlatformScore(
    detectedPlatforms.length,
    hasHighPriorityPlatforms,
    schemaData.sameAsUrls.length > 0,
    embeddedContent.length > 0
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (!metrics.hasYouTube) {
    recommendations.push('Add YouTube presence - video content ranks on both YouTube and Google');
  }
  if (!metrics.hasTikTok) {
    recommendations.push('Consider TikTok for short-form video discovery (high reach for B2C)');
  }
  if (!metrics.hasTwitter) {
    recommendations.push('Create Twitter/X presence for real-time engagement and brand visibility');
  }
  if (!metrics.hasLinkedIn) {
    recommendations.push('LinkedIn is essential for B2B - add company page link');
  }
  if (schemaData.sameAsUrls.length === 0) {
    recommendations.push('Add sameAs property to your Organization schema with social profile URLs');
  }

  // Generate issues

  // No social profiles detected
  if (socialProfiles.length === 0) {
    issues.push({
      code: 'NO_SOCIAL_PROFILES',
      severity: 'warning',
      category: 'social',
      title: 'No social media profile links detected',
      description: 'Page has no visible links to social media profiles.',
      impact: 'Cross-platform presence builds brand trust and provides additional discovery channels.',
      howToFix: 'Add links to your social media profiles in the header, footer, or contact section.',
      affectedUrls: [url],
    });
  }

  // No high-priority platforms
  if (!hasHighPriorityPlatforms && detectedPlatforms.length > 0) {
    issues.push({
      code: 'NO_HIGH_PRIORITY_PLATFORMS',
      severity: 'notice',
      category: 'social',
      title: 'Missing high-priority platform links',
      description: 'No links to YouTube, TikTok, Twitter/X, LinkedIn, or Reddit detected.',
      impact: 'These platforms have the highest reach and impact for SEO diversification.',
      howToFix: 'Prioritize creating presence on YouTube, Twitter/X, and LinkedIn (using RICE framework).',
      affectedUrls: [url],
      details: {
        currentPlatforms: detectedPlatforms,
        recommendedPlatforms: highPriorityPlatforms,
      },
    });
  }

  // No schema sameAs
  if (schemaData.sameAsUrls.length === 0 && socialProfiles.length > 0) {
    issues.push({
      code: 'NO_SCHEMA_SAMEAS',
      severity: 'notice',
      category: 'social',
      title: 'Social profiles not in schema.org markup',
      description: 'Social media links found but not included in Organization/Person schema.',
      impact: 'Schema sameAs helps search engines understand your brand\'s official social presence.',
      howToFix: 'Add sameAs array to your Organization or Person schema with all social profile URLs.',
      affectedUrls: [url],
      details: {
        profilesFound: socialProfiles.map(p => p.platform),
        schemaUrls: schemaData.sameAsUrls,
      },
    });
  }

  // No YouTube (critical for video SEO)
  if (!metrics.hasYouTube && detectedPlatforms.length >= 2) {
    issues.push({
      code: 'NO_YOUTUBE_PRESENCE',
      severity: 'notice',
      category: 'social',
      title: 'No YouTube channel linked',
      description: 'Multiple social platforms linked but YouTube is missing.',
      impact: 'YouTube is the second largest search engine. Video content ranks in both YouTube and Google.',
      howToFix: 'Create a YouTube channel and link to it from your website.',
      affectedUrls: [url],
    });
  }

  // No embedded content
  if (embeddedContent.length === 0 && detectedPlatforms.length > 0) {
    issues.push({
      code: 'NO_EMBEDDED_SOCIAL',
      severity: 'notice',
      category: 'social',
      title: 'No embedded social content',
      description: 'Social profiles linked but no embedded videos, tweets, or posts.',
      impact: 'Embedded content increases engagement time and shows fresh, active social presence.',
      howToFix: 'Embed relevant YouTube videos, Twitter feeds, or TikTok videos in your content.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      detectedPlatforms,
      platformLinks,
      socialProfiles,
      embeddedContent,
      metrics,
      schemaPresence: {
        hasSameAs: schemaData.sameAsUrls.length > 0,
        sameAsUrls: schemaData.sameAsUrls,
        hasOrganizationSchema: schemaData.hasOrganizationSchema,
        hasPersonSchema: schemaData.hasPersonSchema,
      },
      crossPlatformScore,
      recommendations,
    },
  };
}
