// Client-Side Rendering Detection - SSR/SSG is critical for SEO
// Reference: "Technical SEO for Developers - 17 Tips to Rank Higher"
// "The page should load its content even if I have JavaScript disabled"
// "Statically generating or server-side rendering is so much safer than rendering only on the client"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface RenderingAnalysis {
  renderingMethod: 'ssr' | 'ssg' | 'csr' | 'hybrid' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  signals: RenderingSignal[];
  frameworkDetected: string | null;
  hasContentInHTML: boolean;
  hasHydrationMarkers: boolean;
  hasClientOnlyIndicators: boolean;
  mainContentCharCount: number;
  recommendations: string[];
  metaManagement: string | null; // React Helmet, Vue Meta, etc.
  hasDynamicMetaTags: boolean;
  // AI-specific content accessibility metrics
  aiAccessibility: {
    htmlContentRatio: number; // % of content in raw HTML vs total expected
    hasSemanticStructure: boolean; // Proper heading hierarchy, landmarks
    keyContentInHTML: boolean; // Title, main headings, first paragraphs in HTML
    aiReadableScore: number; // 0-100 score for AI parsing ability
  };
}

export interface RenderingSignal {
  indicator: string;
  suggests: 'ssr' | 'ssg' | 'csr';
  weight: number;
}

// Framework detection patterns
const FRAMEWORK_PATTERNS: Record<string, RegExp[]> = {
  'Next.js': [/__NEXT_DATA__/, /next\//, /_next\//],
  'Nuxt': [/__NUXT__/, /nuxt/, /_nuxt\//],
  'Gatsby': [/___gatsby/, /gatsby-/, /gatsby-image/],
  'Remix': [/__remix/, /remix/],
  'SvelteKit': [/__sveltekit/, /svelte/],
  'Angular Universal': [/ng-version/, /angular/],
  'React': [/react-root/, /data-reactroot/, /__REACT/],
  'Vue': [/data-v-/, /Vue\./, /__VUE/],
  'Astro': [/astro-/, /astro:/],
};

// Meta tag management patterns (React Helmet, etc.)
const META_MANAGEMENT_PATTERNS = [
  { name: 'React Helmet', pattern: /data-react-helmet/i },
  { name: 'Next.js Head', pattern: /__NEXT_DATA__.*"head"/i },
  { name: 'Vue Meta', pattern: /data-vue-meta/i },
  { name: 'Nuxt Head', pattern: /__NUXT__.*"head"/i },
  { name: 'Remix Meta', pattern: /__remix_meta/i },
];

// Indicators of client-side only rendering (bad for SEO)
const CSR_INDICATORS = [
  // Empty root elements waiting for JS to populate
  { pattern: /<div id="root"><\/div>/i, weight: 3 },
  { pattern: /<div id="app"><\/div>/i, weight: 3 },
  { pattern: /<div id="__next"><\/div>/i, weight: 2 }, // Empty Next.js (should have content)
  { pattern: /<div id="__nuxt"><\/div>/i, weight: 2 }, // Empty Nuxt
  { pattern: /<main><\/main>/i, weight: 2 },
  { pattern: /<article><\/article>/i, weight: 2 },

  // Noscript warnings indicating JS dependency
  { pattern: /<noscript>.*(?:enable|require|need).*javascript/i, weight: 3 },
  { pattern: /<noscript>.*(?:won't work|doesn't work)/i, weight: 3 },

  // Very minimal HTML body
  { pattern: /<body[^>]*>\s*<(?:div|script)[^>]*>\s*<\/(?:div|script)>\s*<\/body>/i, weight: 4 },

  // Loading spinners/states in initial HTML
  { pattern: /class="[^"]*loading[^"]*"/i, weight: 1 },
  { pattern: /Loading\.\.\./i, weight: 1 },

  // Client-only component indicators
  { pattern: /data-client-only/i, weight: 2 },
  { pattern: /client:only/i, weight: 2 }, // Astro client:only
];

// Indicators of server-side rendering (good for SEO)
const SSR_INDICATORS = [
  // Hydration markers (content was rendered server-side)
  { pattern: /__NEXT_DATA__/, weight: 3 },
  { pattern: /__NUXT__/, weight: 3 },
  { pattern: /data-reactroot/, weight: 2 },
  { pattern: /data-server-rendered/, weight: 3 },

  // Pre-rendered content indicators
  { pattern: /<h1[^>]*>[^<]+<\/h1>/i, weight: 2 },
  { pattern: /<article[^>]*>[^<]{100,}/i, weight: 3 },
  { pattern: /<main[^>]*>[^<]{100,}/i, weight: 3 },

  // Meta content (usually server-rendered)
  { pattern: /<meta property="og:title"[^>]*content="[^"]+"/, weight: 1 },
  { pattern: /<meta name="description"[^>]*content="[^"]+"/, weight: 1 },

  // Structured data
  { pattern: /<script type="application\/ld\+json">/, weight: 2 },
];

/**
 * Detect framework from HTML
 */
export function detectFramework(html: string): string | null {
  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(html)) {
        return framework;
      }
    }
  }
  return null;
}

/**
 * Analyze HTML to determine rendering method
 */
export function analyzeRendering(html: string): RenderingAnalysis {
  const $ = cheerio.load(html);
  const signals: RenderingSignal[] = [];

  // Detect framework
  const frameworkDetected = detectFramework(html);

  // Check for CSR indicators
  let csrScore = 0;
  for (const indicator of CSR_INDICATORS) {
    if (indicator.pattern.test(html)) {
      csrScore += indicator.weight;
      signals.push({
        indicator: indicator.pattern.toString(),
        suggests: 'csr',
        weight: indicator.weight,
      });
    }
  }

  // Check for SSR indicators
  let ssrScore = 0;
  for (const indicator of SSR_INDICATORS) {
    if (indicator.pattern.test(html)) {
      ssrScore += indicator.weight;
      signals.push({
        indicator: indicator.pattern.toString(),
        suggests: 'ssr',
        weight: indicator.weight,
      });
    }
  }

  // Analyze main content
  const mainContent = $('main, article, [role="main"], .content, #content').text();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const mainContentCharCount = mainContent.length || bodyText.length;

  // Very little text content is a red flag
  const hasContentInHTML = mainContentCharCount > 200;
  if (!hasContentInHTML) {
    csrScore += 4;
    signals.push({
      indicator: `Body text only ${mainContentCharCount} chars`,
      suggests: 'csr',
      weight: 4,
    });
  } else {
    ssrScore += 2;
  }

  // Check for hydration markers
  const hasHydrationMarkers =
    /__NEXT_DATA__|__NUXT__|data-reactroot|data-server-rendered/.test(html);

  // Check for client-only indicators
  const hasClientOnlyIndicators = $('[data-client-only], [client\\:only]').length > 0;

  // Detect meta tag management library
  let metaManagement: string | null = null;
  for (const { name, pattern } of META_MANAGEMENT_PATTERNS) {
    if (pattern.test(html)) {
      metaManagement = name;
      break;
    }
  }

  // Check if meta tags appear to be dynamically managed
  const hasDynamicMetaTags = metaManagement !== null ||
    $('meta[data-react-helmet]').length > 0 ||
    $('meta[data-vue-meta]').length > 0;

  // === AI ACCESSIBILITY ANALYSIS ===
  // AI systems (ChatGPT, Claude, etc.) primarily read raw HTML
  // Content hidden behind JavaScript may not be indexed by AI

  // Check semantic structure
  const hasH1 = $('h1').length > 0 && $('h1').text().trim().length > 0;
  const hasH2 = $('h2').length > 0;
  const hasMain = $('main, [role="main"]').length > 0;
  const hasArticle = $('article').length > 0;
  const hasSemanticStructure = hasH1 && (hasMain || hasArticle);

  // Check if key content is in HTML
  const title = $('title').text().trim();
  const h1Text = $('h1').first().text().trim();
  // Any paragraph of real length, not only the first <p>: sive.rs opens with a one-line
  // paragraph and was reported as having no key content in 1,287 words of static HTML.
  const hasSubstantialParagraph = $('p').toArray().some((p) => $(p).text().trim().length > 50);

  const keyContentInHTML =
    title.length > 0 &&
    h1Text.length > 0 &&
    hasSubstantialParagraph;

  // Calculate HTML content ratio
  // Compare actual content to expected minimum for a meaningful page
  const EXPECTED_MIN_CONTENT = 1000; // Minimum expected chars for a content page
  const htmlContentRatio = Math.min(100, (mainContentCharCount / EXPECTED_MIN_CONTENT) * 100);

  // Calculate AI readable score
  let aiReadableScore = 50; // Base score

  // Content amount
  if (mainContentCharCount > 2000) aiReadableScore += 20;
  else if (mainContentCharCount > 1000) aiReadableScore += 15;
  else if (mainContentCharCount > 500) aiReadableScore += 10;
  else if (mainContentCharCount < 200) aiReadableScore -= 20;

  // Semantic structure
  if (hasSemanticStructure) aiReadableScore += 15;
  if (hasH1 && hasH2) aiReadableScore += 5;

  // Key content in HTML
  if (keyContentInHTML) aiReadableScore += 15;
  else aiReadableScore -= 10;

  // SSR/SSG bonus
  if (hasHydrationMarkers || ssrScore > csrScore) aiReadableScore += 10;

  // CSR penalty
  if (csrScore > ssrScore + 3) aiReadableScore -= 20;

  aiReadableScore = Math.max(0, Math.min(100, aiReadableScore));

  const aiAccessibility = {
    htmlContentRatio: Math.round(htmlContentRatio),
    hasSemanticStructure,
    keyContentInHTML,
    aiReadableScore,
  };

  // Determine rendering method
  let renderingMethod: 'ssr' | 'ssg' | 'csr' | 'hybrid' | 'unknown';
  let confidence: 'high' | 'medium' | 'low';

  if (csrScore > ssrScore + 3) {
    renderingMethod = 'csr';
    confidence = csrScore - ssrScore > 6 ? 'high' : 'medium';
  } else if (ssrScore > csrScore + 3) {
    // Distinguish SSG from SSR (static has specific patterns)
    const isLikelyStatic =
      html.includes('data-gatsby') ||
      html.includes('astro-') ||
      (!html.includes('__NEXT_DATA__') && !html.includes('__NUXT__'));

    renderingMethod = isLikelyStatic ? 'ssg' : 'ssr';
    confidence = ssrScore - csrScore > 6 ? 'high' : 'medium';
  } else if (hasHydrationMarkers && hasClientOnlyIndicators) {
    renderingMethod = 'hybrid';
    confidence = 'medium';
  } else {
    renderingMethod = 'unknown';
    confidence = 'low';
  }

  // Generate recommendations
  const recommendations = generateRecommendations(
    renderingMethod,
    hasContentInHTML,
    mainContentCharCount,
    frameworkDetected
  );

  return {
    renderingMethod,
    confidence,
    signals,
    frameworkDetected,
    hasContentInHTML,
    hasHydrationMarkers,
    hasClientOnlyIndicators,
    mainContentCharCount,
    recommendations,
    metaManagement,
    hasDynamicMetaTags,
    aiAccessibility,
  };
}

function generateRecommendations(
  renderingMethod: string,
  hasContentInHTML: boolean,
  charCount: number,
  framework: string | null
): string[] {
  const recommendations: string[] = [];

  if (renderingMethod === 'csr') {
    recommendations.push(
      'Critical: Pre-render your pages so crawlers see actual content in the HTML'
    );

    if (framework === 'React') {
      recommendations.push(
        'Quick fix: Use Vike (vike.dev) for SSR/SSG - works with Vite, minimal config needed'
      );
      recommendations.push(
        'Alternative: Migrate to Next.js or Remix for built-in SSR/SSG support'
      );
    } else if (framework === 'Vue') {
      recommendations.push(
        'Quick fix: Use Vike (vike.dev) for SSR/SSG - works with Vite, minimal config needed'
      );
      recommendations.push(
        'Alternative: Migrate to Nuxt for built-in SSR/SSG support'
      );
    } else if (framework === 'Angular Universal') {
      recommendations.push(
        'Enable Angular Universal for server-side rendering'
      );
    } else {
      recommendations.push(
        'Quick fix: Use Vike (vike.dev) for SSR/SSG with any Vite-based framework'
      );
    }

    recommendations.push(
      'Google can render JavaScript, but pre-rendered HTML is more reliable and faster to index'
    );
  }

  if (!hasContentInHTML) {
    recommendations.push(
      `Very little content in initial HTML (${charCount} chars). Search engines may not see your content.`
    );
  }

  if (renderingMethod === 'hybrid') {
    recommendations.push(
      'Hybrid rendering detected. Ensure critical SEO content is server-rendered, not client-only.'
    );
  }

  return recommendations;
}

/**
 * Main function: Analyze page rendering method for SEO
 */
export function analyzeClientRendering(
  html: string,
  url: string
): { issues: AuditIssue[]; data: RenderingAnalysis } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];
  const analysis = analyzeRendering(html);

  // Critical: Client-side only rendering
  if (analysis.renderingMethod === 'csr' && analysis.confidence !== 'low') {
    const howToFixByFramework = analysis.frameworkDetected === 'React'
      ? 'Use Vike (vike.dev) to add SSR/SSG to your Vite React app: npm install vike vike-react, then follow the setup guide. Alternatively, migrate to Next.js or Remix.'
      : analysis.frameworkDetected === 'Vue'
      ? 'Use Vike (vike.dev) to add SSR/SSG to your Vite Vue app: npm install vike vike-vue, then follow the setup guide. Alternatively, migrate to Nuxt.'
      : 'Use Vike (vike.dev) for SSR/SSG with Vite-based frameworks, or use a framework with built-in SSR support (Next.js, Nuxt, Remix, SvelteKit).';

    issues.push({
      code: 'CLIENT_SIDE_RENDERING',
      severity: 'error',
      category: 'crawlability',
      title: 'Page relies on client-side rendering',
      description:
        'This page appears to render content primarily via JavaScript. Search engines may not see your content.',
      impact:
        'Google can execute JavaScript but it\'s slower and less reliable. Content may not be indexed properly.',
      howToFix: howToFixByFramework,
      affectedUrls: [url],
      details: {
        confidence: analysis.confidence,
        framework: analysis.frameworkDetected,
        signals: analysis.signals.filter(s => s.suggests === 'csr').slice(0, 5),
      },
    });
  }

  // Warning: Very little content in HTML
  if (!analysis.hasContentInHTML) {
    issues.push({
      code: 'EMPTY_BODY_CONTENT',
      severity: 'error',
      category: 'content',
      title: 'Very little content in initial HTML',
      description:
        `Only ${analysis.mainContentCharCount} characters of text found in the HTML. Content may be loaded via JavaScript.`,
      impact:
        'Search engines prioritize content in the initial HTML response. JavaScript-loaded content may be missed or delayed.',
      howToFix:
        'Ensure main page content is present in the server-rendered HTML, not loaded via JavaScript after page load.',
      affectedUrls: [url],
      details: {
        charCount: analysis.mainContentCharCount,
        renderingMethod: analysis.renderingMethod,
      },
    });
  }

  // Notice: Framework without SSR evidence
  if (
    analysis.frameworkDetected &&
    ['React', 'Vue'].includes(analysis.frameworkDetected) &&
    !analysis.hasHydrationMarkers &&
    analysis.mainContentCharCount < 500
  ) {
    issues.push({
      code: 'SPA_WITHOUT_SSR',
      severity: 'warning',
      category: 'crawlability',
      title: `${analysis.frameworkDetected} detected without SSR markers`,
      description:
        `This appears to be a ${analysis.frameworkDetected} SPA without server-side rendering enabled.`,
      impact:
        'Single Page Applications without SSR have slower time-to-content for search crawlers.',
      howToFix:
        analysis.frameworkDetected === 'React'
          ? 'Add SSR/SSG using Vike (vike.dev): npm install vike vike-react. Alternative: migrate to Next.js or Remix.'
          : 'Add SSR/SSG using Vike (vike.dev): npm install vike vike-vue. Alternative: migrate to Nuxt.',
      affectedUrls: [url],
      details: {
        framework: analysis.frameworkDetected,
        hasHydrationMarkers: analysis.hasHydrationMarkers,
      },
    });
  }

  // Notice: Static generation recommended
  if (
    analysis.renderingMethod === 'ssr' &&
    analysis.confidence !== 'low'
  ) {
    // Not an issue, but we could suggest SSG for better performance
    // This is informational only
  }

  // Warning: React/Vue without meta management library
  if (
    analysis.frameworkDetected &&
    ['React', 'Vue'].includes(analysis.frameworkDetected) &&
    !analysis.hasDynamicMetaTags &&
    analysis.renderingMethod !== 'csr' // Don't double-warn for CSR
  ) {
    const helmetLib = analysis.frameworkDetected === 'React' ? 'React Helmet' : 'Vue Meta';
    const metaTagsPresent = $('meta[name="description"], meta[property="og:title"]').length > 0;

    if (!metaTagsPresent) {
      issues.push({
        code: 'SPA_NO_META_MANAGEMENT',
        severity: 'warning',
        category: 'on-page',
        title: `${analysis.frameworkDetected} app may lack dynamic meta tag management`,
        description:
          `No ${helmetLib} or similar library detected for managing meta tags in this SPA.`,
        impact:
          'SPAs need dynamic meta tag management for proper page-specific titles, descriptions, and social tags.',
        howToFix:
          analysis.frameworkDetected === 'React'
            ? 'Use React Helmet, Next.js Head, or Remix meta exports for dynamic meta tags.'
            : 'Use Vue Meta, Nuxt Head, or vue-head for dynamic meta tags.',
        affectedUrls: [url],
        details: {
          framework: analysis.frameworkDetected,
          metaManagement: analysis.metaManagement,
        },
      });
    }
  }

  // === AI-SPECIFIC CONTENT ACCESSIBILITY CHECKS ===

  // Low AI readable score
  if (analysis.aiAccessibility.aiReadableScore < 50) {
    issues.push({
      code: 'AI_LOW_HTML_READABILITY',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Content not optimally accessible to AI systems',
      description: `AI readability score: ${analysis.aiAccessibility.aiReadableScore}/100. AI systems like ChatGPT primarily read raw HTML and may miss JavaScript-rendered content.`,
      impact: 'Content may not be properly indexed by AI search systems (ChatGPT, Perplexity, etc.), reducing AI citation likelihood.',
      howToFix: 'Ensure key content is in the initial HTML response: 1) Use SSR/SSG, 2) Include title, H1, and main content in HTML, 3) Don\'t hide content behind JavaScript interactions.',
      affectedUrls: [url],
      details: {
        aiReadableScore: analysis.aiAccessibility.aiReadableScore,
        htmlContentRatio: analysis.aiAccessibility.htmlContentRatio,
        hasSemanticStructure: analysis.aiAccessibility.hasSemanticStructure,
        keyContentInHTML: analysis.aiAccessibility.keyContentInHTML,
      },
    });
  }

  // Missing semantic structure for AI
  if (!analysis.aiAccessibility.hasSemanticStructure && analysis.mainContentCharCount > 500) {
    issues.push({
      code: 'AI_NO_SEMANTIC_STRUCTURE',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Content lacks semantic HTML structure for AI parsing',
      description: 'Missing semantic landmarks (<main>, <article>) or heading hierarchy. AI systems use these to identify and extract key content.',
      impact: 'AI may not correctly identify the main content area, potentially extracting navigation or footer text instead.',
      howToFix: 'Add semantic HTML: wrap main content in <main> or <article>, ensure H1 exists and heading hierarchy is logical (H1 → H2 → H3).',
      affectedUrls: [url],
    });
  }

  // Key content not in initial HTML
  if (!analysis.aiAccessibility.keyContentInHTML && analysis.renderingMethod !== 'csr') {
    issues.push({
      code: 'AI_KEY_CONTENT_NOT_IN_HTML',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Key content elements missing from initial HTML',
      description: 'Title, H1, or opening paragraph content is missing or too short in the HTML. AI systems extract these first.',
      impact: 'AI may not have access to your primary message, reducing chances of accurate citation.',
      howToFix: 'Ensure the initial HTML contains: meaningful <title>, descriptive <h1>, and a substantial first paragraph with your key message.',
      affectedUrls: [url],
      details: {
        hasTitle: $('title').text().trim().length > 0,
        hasH1: $('h1').text().trim().length > 0,
        hasSubstantialParagraph: $('p').toArray().some((p) => $(p).text().trim().length > 50),
      },
    });
  }

  return { issues, data: analysis };
}
