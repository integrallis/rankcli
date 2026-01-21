// Tracker Bloat Detection - Excessive third-party scripts hurt page performance
// Reference: "Technical SEO for Developers - 17 Tips to Rank Higher"
// "Every single tracker that you put in hurts your page speed, hurts that first time to interactive"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface TrackerInfo {
  name: string;
  type: 'analytics' | 'advertising' | 'social' | 'marketing' | 'heatmap' | 'chat' | 'other';
  domain: string;
  impact: 'high' | 'medium' | 'low';
}

// Known trackers and their performance impact
const KNOWN_TRACKERS: TrackerInfo[] = [
  // Analytics
  { name: 'Google Analytics (GA4)', domain: 'googletagmanager.com', type: 'analytics', impact: 'medium' },
  { name: 'Google Analytics (Universal)', domain: 'google-analytics.com', type: 'analytics', impact: 'medium' },
  { name: 'Google Tag Manager', domain: 'googletagmanager.com', type: 'analytics', impact: 'medium' },
  { name: 'Segment', domain: 'segment.com', type: 'analytics', impact: 'medium' },
  { name: 'Mixpanel', domain: 'mixpanel.com', type: 'analytics', impact: 'medium' },
  { name: 'Amplitude', domain: 'amplitude.com', type: 'analytics', impact: 'medium' },
  { name: 'Heap', domain: 'heap.io', type: 'analytics', impact: 'medium' },
  { name: 'Plausible', domain: 'plausible.io', type: 'analytics', impact: 'low' },
  { name: 'Fathom', domain: 'usefathom.com', type: 'analytics', impact: 'low' },
  { name: 'Simple Analytics', domain: 'simpleanalytics.com', type: 'analytics', impact: 'low' },
  { name: 'PostHog', domain: 'posthog.com', type: 'analytics', impact: 'medium' },

  // Advertising pixels
  { name: 'Facebook Pixel', domain: 'connect.facebook.net', type: 'advertising', impact: 'high' },
  { name: 'Meta Pixel', domain: 'facebook.com/tr', type: 'advertising', impact: 'high' },
  { name: 'TikTok Pixel', domain: 'analytics.tiktok.com', type: 'advertising', impact: 'high' },
  { name: 'Twitter/X Pixel', domain: 'static.ads-twitter.com', type: 'advertising', impact: 'high' },
  { name: 'LinkedIn Insight', domain: 'snap.licdn.com', type: 'advertising', impact: 'high' },
  { name: 'Pinterest Tag', domain: 'pintrk', type: 'advertising', impact: 'high' },
  { name: 'Snapchat Pixel', domain: 'sc-static.net', type: 'advertising', impact: 'high' },
  { name: 'Google Ads', domain: 'googleadservices.com', type: 'advertising', impact: 'high' },
  { name: 'Google Ads Conversion', domain: 'googleads.g.doubleclick.net', type: 'advertising', impact: 'high' },
  { name: 'Microsoft/Bing Ads', domain: 'bat.bing.com', type: 'advertising', impact: 'high' },
  { name: 'Criteo', domain: 'criteo.com', type: 'advertising', impact: 'high' },
  { name: 'Taboola', domain: 'taboola.com', type: 'advertising', impact: 'high' },
  { name: 'Outbrain', domain: 'outbrain.com', type: 'advertising', impact: 'high' },

  // Marketing automation
  { name: 'HubSpot', domain: 'js.hs-scripts.com', type: 'marketing', impact: 'high' },
  { name: 'HubSpot Analytics', domain: 'js.hs-analytics.net', type: 'marketing', impact: 'high' },
  { name: 'Marketo', domain: 'munchkin.marketo.net', type: 'marketing', impact: 'high' },
  { name: 'Pardot', domain: 'pardot.com', type: 'marketing', impact: 'high' },
  { name: 'ActiveCampaign', domain: 'trackcmp.net', type: 'marketing', impact: 'medium' },
  { name: 'Klaviyo', domain: 'klaviyo.com', type: 'marketing', impact: 'medium' },
  { name: 'Mailchimp', domain: 'chimpstatic.com', type: 'marketing', impact: 'medium' },
  { name: 'Drip', domain: 'getdrip.com', type: 'marketing', impact: 'medium' },

  // Heatmaps & Session Recording
  { name: 'Hotjar', domain: 'hotjar.com', type: 'heatmap', impact: 'high' },
  { name: 'Crazy Egg', domain: 'crazyegg.com', type: 'heatmap', impact: 'high' },
  { name: 'FullStory', domain: 'fullstory.com', type: 'heatmap', impact: 'high' },
  { name: 'Lucky Orange', domain: 'luckyorange.com', type: 'heatmap', impact: 'high' },
  { name: 'Mouseflow', domain: 'mouseflow.com', type: 'heatmap', impact: 'high' },
  { name: 'Clarity', domain: 'clarity.ms', type: 'heatmap', impact: 'medium' },
  { name: 'LogRocket', domain: 'logrocket.com', type: 'heatmap', impact: 'high' },

  // Chat widgets
  { name: 'Intercom', domain: 'intercom.io', type: 'chat', impact: 'high' },
  { name: 'Drift', domain: 'drift.com', type: 'chat', impact: 'high' },
  { name: 'Zendesk Chat', domain: 'zopim.com', type: 'chat', impact: 'high' },
  { name: 'Crisp', domain: 'crisp.chat', type: 'chat', impact: 'medium' },
  { name: 'Tidio', domain: 'tidio.co', type: 'chat', impact: 'medium' },
  { name: 'LiveChat', domain: 'livechatinc.com', type: 'chat', impact: 'high' },
  { name: 'Freshchat', domain: 'freshchat.com', type: 'chat', impact: 'high' },

  // Social widgets
  { name: 'Twitter Widget', domain: 'platform.twitter.com', type: 'social', impact: 'medium' },
  { name: 'Facebook SDK', domain: 'connect.facebook.net/en_US/sdk.js', type: 'social', impact: 'high' },
  { name: 'Instagram Embed', domain: 'instagram.com/embed.js', type: 'social', impact: 'medium' },
  { name: 'LinkedIn Badge', domain: 'platform.linkedin.com', type: 'social', impact: 'medium' },
  { name: 'AddThis', domain: 'addthis.com', type: 'social', impact: 'high' },
  { name: 'ShareThis', domain: 'sharethis.com', type: 'social', impact: 'high' },

  // Other
  { name: 'Cloudflare Web Analytics', domain: 'cloudflareinsights.com', type: 'analytics', impact: 'low' },
  { name: 'Sentry', domain: 'sentry.io', type: 'other', impact: 'low' },
  { name: 'DataDog RUM', domain: 'datadoghq.com', type: 'other', impact: 'medium' },
  { name: 'New Relic', domain: 'newrelic.com', type: 'other', impact: 'medium' },
  { name: 'Optimizely', domain: 'optimizely.com', type: 'other', impact: 'high' },
  { name: 'VWO', domain: 'visualwebsiteoptimizer.com', type: 'other', impact: 'high' },
  { name: 'Google Optimize', domain: 'googleoptimize.com', type: 'other', impact: 'medium' },
];

export interface DetectedTracker extends TrackerInfo {
  scriptUrl?: string;
  loadMethod: 'sync' | 'async' | 'defer' | 'inline';
}

export interface TrackerAnalysis {
  trackers: DetectedTracker[];
  totalCount: number;
  byType: Record<string, number>;
  byImpact: Record<string, number>;
  estimatedImpactScore: number; // 0-100, higher is worse
  recommendations: string[];
}

/**
 * Detect third-party trackers and scripts in HTML
 */
export function detectTrackers(html: string): TrackerAnalysis {
  const $ = cheerio.load(html);
  const trackers: DetectedTracker[] = [];
  const scripts = $('script');

  scripts.each((_, el) => {
    const $script = $(el);
    const src = $script.attr('src') || '';
    const inlineContent = $script.html() || '';

    // Check external scripts
    if (src) {
      const tracker = identifyTracker(src);
      if (tracker) {
        trackers.push({
          ...tracker,
          scriptUrl: src,
          loadMethod: $script.attr('async') !== undefined ? 'async'
                    : $script.attr('defer') !== undefined ? 'defer'
                    : 'sync',
        });
      }
    }

    // Check inline scripts for tracker initialization
    if (inlineContent) {
      const inlineTrackers = identifyInlineTrackers(inlineContent);
      trackers.push(...inlineTrackers);
    }
  });

  // Also check for tracking pixels in img/iframe
  $('img[src], iframe[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    const tracker = identifyTracker(src);
    if (tracker) {
      trackers.push({
        ...tracker,
        scriptUrl: src,
        loadMethod: 'sync',
      });
    }
  });

  // Deduplicate trackers by name
  const uniqueTrackers = Array.from(
    new Map(trackers.map(t => [t.name, t])).values()
  );

  // Calculate stats
  const byType: Record<string, number> = {};
  const byImpact: Record<string, number> = {};

  for (const tracker of uniqueTrackers) {
    byType[tracker.type] = (byType[tracker.type] || 0) + 1;
    byImpact[tracker.impact] = (byImpact[tracker.impact] || 0) + 1;
  }

  // Estimate performance impact (0-100)
  const impactScore = calculateImpactScore(uniqueTrackers);

  // Generate recommendations
  const recommendations = generateRecommendations(uniqueTrackers, byType);

  return {
    trackers: uniqueTrackers,
    totalCount: uniqueTrackers.length,
    byType,
    byImpact,
    estimatedImpactScore: impactScore,
    recommendations,
  };
}

function identifyTracker(url: string): TrackerInfo | null {
  const urlLower = url.toLowerCase();

  for (const tracker of KNOWN_TRACKERS) {
    if (urlLower.includes(tracker.domain.toLowerCase())) {
      return tracker;
    }
  }

  return null;
}

function identifyInlineTrackers(content: string): DetectedTracker[] {
  const trackers: DetectedTracker[] = [];
  const contentLower = content.toLowerCase();

  // Facebook Pixel
  if (contentLower.includes('fbq(') || contentLower.includes('facebook-jssdk')) {
    trackers.push({
      name: 'Facebook Pixel (inline)',
      domain: 'facebook.com',
      type: 'advertising',
      impact: 'high',
      loadMethod: 'inline',
    });
  }

  // Google Analytics
  if (contentLower.includes('gtag(') && contentLower.includes('config')) {
    trackers.push({
      name: 'Google Analytics (inline)',
      domain: 'google-analytics.com',
      type: 'analytics',
      impact: 'medium',
      loadMethod: 'inline',
    });
  }

  // TikTok Pixel
  if (contentLower.includes('ttq.') || contentLower.includes('tiktok')) {
    trackers.push({
      name: 'TikTok Pixel (inline)',
      domain: 'tiktok.com',
      type: 'advertising',
      impact: 'high',
      loadMethod: 'inline',
    });
  }

  // LinkedIn
  if (contentLower.includes('_linkedin_partner_id') || contentLower.includes('linkedin')) {
    trackers.push({
      name: 'LinkedIn Insight (inline)',
      domain: 'linkedin.com',
      type: 'advertising',
      impact: 'high',
      loadMethod: 'inline',
    });
  }

  // Hotjar
  if (contentLower.includes('hotjar') || contentLower.includes('hjid')) {
    trackers.push({
      name: 'Hotjar (inline)',
      domain: 'hotjar.com',
      type: 'heatmap',
      impact: 'high',
      loadMethod: 'inline',
    });
  }

  // Intercom
  if (contentLower.includes('intercom') && contentLower.includes('app_id')) {
    trackers.push({
      name: 'Intercom (inline)',
      domain: 'intercom.io',
      type: 'chat',
      impact: 'high',
      loadMethod: 'inline',
    });
  }

  // HubSpot
  if (contentLower.includes('_hsq') || contentLower.includes('hubspot')) {
    trackers.push({
      name: 'HubSpot (inline)',
      domain: 'hubspot.com',
      type: 'marketing',
      impact: 'high',
      loadMethod: 'inline',
    });
  }

  return trackers;
}

function calculateImpactScore(trackers: DetectedTracker[]): number {
  let score = 0;

  for (const tracker of trackers) {
    // Base impact
    const baseImpact = tracker.impact === 'high' ? 15
                     : tracker.impact === 'medium' ? 8
                     : 3;

    // Load method penalty (sync is worst)
    const loadPenalty = tracker.loadMethod === 'sync' ? 1.5
                      : tracker.loadMethod === 'inline' ? 1.2
                      : 1.0;

    score += baseImpact * loadPenalty;
  }

  // Cap at 100
  return Math.min(100, Math.round(score));
}

function generateRecommendations(
  trackers: DetectedTracker[],
  byType: Record<string, number>
): string[] {
  const recommendations: string[] = [];

  // Too many trackers overall
  if (trackers.length > 5) {
    recommendations.push(
      `Reduce tracker count from ${trackers.length} to 5 or fewer for better page speed`
    );
  }

  // Too many advertising pixels
  if ((byType.advertising || 0) > 2) {
    recommendations.push(
      `Consider consolidating ${byType.advertising} advertising pixels - each one significantly impacts First Input Delay`
    );
  }

  // Multiple analytics tools
  if ((byType.analytics || 0) > 1) {
    recommendations.push(
      `You have ${byType.analytics} analytics tools - consider using just one comprehensive solution`
    );
  }

  // Session recording tools
  if ((byType.heatmap || 0) > 0) {
    recommendations.push(
      `Session recording tools (${byType.heatmap} found) significantly impact performance - use sparingly and only on specific pages`
    );
  }

  // Chat widgets
  if ((byType.chat || 0) > 1) {
    recommendations.push(
      `Multiple chat widgets detected (${byType.chat}) - consolidate to one solution`
    );
  }

  // Sync loading scripts
  const syncTrackers = trackers.filter(t => t.loadMethod === 'sync');
  if (syncTrackers.length > 0) {
    recommendations.push(
      `${syncTrackers.length} tracker(s) loaded synchronously - add async/defer to improve page load`
    );
  }

  // Suggest lightweight alternatives
  const heavyAnalytics = trackers.filter(
    t => t.type === 'analytics' && t.impact !== 'low'
  );
  if (heavyAnalytics.length > 0 && !trackers.some(t => t.impact === 'low')) {
    recommendations.push(
      'Consider privacy-friendly, lightweight analytics like Plausible, Fathom, or Simple Analytics'
    );
  }

  return recommendations;
}

/**
 * Main function: Analyze page for tracker bloat
 */
export function analyzeTrackerBloat(
  html: string,
  url: string
): { issues: AuditIssue[]; data: TrackerAnalysis } {
  const issues: AuditIssue[] = [];
  const analysis = detectTrackers(html);

  // Critical: Excessive trackers (>8)
  if (analysis.totalCount > 8) {
    issues.push({
      code: 'EXCESSIVE_TRACKERS',
      severity: 'error',
      category: 'performance',
      title: `Excessive third-party trackers (${analysis.totalCount} detected)`,
      description: `Found ${analysis.totalCount} third-party trackers/scripts. Each one adds to page weight and processing time.`,
      impact: `Estimated ${analysis.estimatedImpactScore}% negative impact on Core Web Vitals (First Input Delay, LCP).`,
      howToFix: 'Audit your trackers and remove any that are not providing value. Consolidate analytics tools and limit advertising pixels.',
      affectedUrls: [url],
      details: {
        trackers: analysis.trackers.map(t => t.name),
        byType: analysis.byType,
        impactScore: analysis.estimatedImpactScore,
      },
    });
  }
  // Warning: Many trackers (5-8)
  else if (analysis.totalCount > 5) {
    issues.push({
      code: 'MANY_TRACKERS',
      severity: 'warning',
      category: 'performance',
      title: `Many third-party trackers (${analysis.totalCount} detected)`,
      description: `Found ${analysis.totalCount} third-party trackers. This may be impacting page performance.`,
      impact: `Estimated ${analysis.estimatedImpactScore}% negative impact on page interactivity.`,
      howToFix: 'Review tracker necessity and consider removing underused ones. Prioritize essential analytics and business tools.',
      affectedUrls: [url],
      details: {
        trackers: analysis.trackers.map(t => t.name),
        byType: analysis.byType,
      },
    });
  }

  // High-impact trackers loading synchronously
  const syncHighImpact = analysis.trackers.filter(
    t => t.loadMethod === 'sync' && t.impact === 'high'
  );
  if (syncHighImpact.length > 0) {
    issues.push({
      code: 'SYNC_TRACKER_LOADING',
      severity: 'warning',
      category: 'performance',
      title: `High-impact trackers loading synchronously`,
      description: `${syncHighImpact.length} high-impact tracker(s) are loading synchronously, blocking page rendering.`,
      impact: 'Synchronous scripts block the parser and significantly delay First Contentful Paint.',
      howToFix: 'Add async or defer attributes to tracker scripts, or load them after user interaction.',
      affectedUrls: [url],
      details: {
        scripts: syncHighImpact.map(t => t.name),
      },
    });
  }

  // Multiple session recording tools
  if ((analysis.byType.heatmap || 0) > 1) {
    issues.push({
      code: 'MULTIPLE_SESSION_RECORDERS',
      severity: 'warning',
      category: 'performance',
      title: `Multiple session recording tools detected`,
      description: `Found ${analysis.byType.heatmap} session recording/heatmap tools. These are among the heaviest trackers.`,
      impact: 'Session recorders capture every user interaction and can add 100-500ms to page load time each.',
      howToFix: 'Use only one session recording tool, and consider enabling it only for specific pages or user segments.',
      affectedUrls: [url],
      details: {
        tools: analysis.trackers.filter(t => t.type === 'heatmap').map(t => t.name),
      },
    });
  }

  // Too many advertising pixels
  if ((analysis.byType.advertising || 0) > 3) {
    issues.push({
      code: 'TOO_MANY_AD_PIXELS',
      severity: 'warning',
      category: 'performance',
      title: `Too many advertising pixels (${analysis.byType.advertising} found)`,
      description: `Found ${analysis.byType.advertising} advertising/conversion pixels. Each one makes network requests and runs JavaScript.`,
      impact: 'Ad pixels are often the heaviest trackers. More than 3 can add 1-2 seconds to page load time.',
      howToFix: 'Consolidate pixels using a tag manager with server-side tracking, or prioritize only your most important ad platforms.',
      affectedUrls: [url],
      details: {
        pixels: analysis.trackers.filter(t => t.type === 'advertising').map(t => t.name),
      },
    });
  }

  return { issues, data: analysis };
}
