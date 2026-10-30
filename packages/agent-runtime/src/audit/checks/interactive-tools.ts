// Interactive Tools & Dwell Time Detection
// Reference: "6 Advanced SEO Tips for 2026"
// "Adding free tools on your website is a fantastic way to attract target customers"
// "Increase the dwell time on your website because people are using the free tools"
// "Generate backlinks - free tools are link magnets"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface InteractiveElement {
  type: 'calculator' | 'quiz' | 'form' | 'widget' | 'embed' | 'tool' | 'interactive';
  description: string;
  location: string;
  hasUserInput: boolean;
}

export interface InteractiveToolsData {
  hasInteractiveTools: boolean;
  tools: InteractiveElement[];
  dwellTimeSignals: {
    hasCalculator: boolean;
    hasQuiz: boolean;
    hasInteractiveWidget: boolean;
    hasVideoEmbed: boolean;
    hasCodePlayground: boolean;
    hasConfigurator: boolean;
    hasChatWidget: boolean;
  };
  toolCount: number;
  dwellTimeScore: number; // 0-100
  recommendations: string[];
}

// Patterns for detecting interactive tools
const CALCULATOR_PATTERNS = [
  /calculator/i,
  /estimator/i,
  /cost-calc/i,
  /price-calc/i,
  /roi-calc/i,
  /savings/i,
  /compute/i,
];

const QUIZ_PATTERNS = [
  /quiz/i,
  /assessment/i,
  /survey/i,
  /questionnaire/i,
  /test-your/i,
  /find-out/i,
];

const WIDGET_PATTERNS = [
  /widget/i,
  /tool/i,
  /generator/i,
  /builder/i,
  /creator/i,
  /converter/i,
  /checker/i,
  /analyzer/i,
  /finder/i,
];

const CONFIGURATOR_PATTERNS = [
  /configurator/i,
  /customizer/i,
  /designer/i,
  /planner/i,
  /selector/i,
  /picker/i,
];

/**
 * Detect calculators on the page
 */
export function detectCalculators($: cheerio.CheerioAPI): InteractiveElement[] {
  const calculators: InteractiveElement[] = [];

  // Check for calculator-related elements by class/id
  const calcElements = $('[class*="calc"], [id*="calc"], [class*="estimat"], [id*="estimat"], [data-tool="calculator"]');
  calcElements.each((_, el) => {
    const $el = $(el);
    const hasInputs = $el.find('input, select, [type="range"]').length > 0;
    if (hasInputs) {
      calculators.push({
        type: 'calculator',
        description: $el.attr('aria-label') || $el.find('h2, h3, h4').first().text().trim() || 'Calculator widget',
        location: $el.attr('id') || $el.attr('class')?.split(' ')[0] || 'unknown',
        hasUserInput: true,
      });
    }
  });

  // Check for form elements that look like calculators
  $('form').each((_, form) => {
    const $form = $(form);
    const formText = ($form.attr('class') || '') + ($form.attr('id') || '') + $form.text();
    if (CALCULATOR_PATTERNS.some(p => p.test(formText))) {
      const hasInputs = $form.find('input[type="number"], input[type="range"], select').length > 0;
      if (hasInputs) {
        calculators.push({
          type: 'calculator',
          description: $form.attr('aria-label') || $form.find('h2, h3, h4').first().text().trim() || 'Calculator form',
          location: $form.attr('id') || 'form',
          hasUserInput: true,
        });
      }
    }
  });

  return calculators;
}

/**
 * Detect quizzes and assessments
 */
export function detectQuizzes($: cheerio.CheerioAPI): InteractiveElement[] {
  const quizzes: InteractiveElement[] = [];

  // Check for quiz-related elements
  const quizElements = $('[class*="quiz"], [id*="quiz"], [class*="assessment"], [data-component="quiz"]');
  quizElements.each((_, el) => {
    const $el = $(el);
    quizzes.push({
      type: 'quiz',
      description: $el.attr('aria-label') || $el.find('h2, h3').first().text().trim() || 'Quiz/Assessment',
      location: $el.attr('id') || $el.attr('class')?.split(' ')[0] || 'unknown',
      hasUserInput: true,
    });
  });

  // Check for question patterns
  const questionContainers = $('[class*="question"], [data-question]');
  if (questionContainers.length >= 3) {
    quizzes.push({
      type: 'quiz',
      description: 'Multi-question assessment',
      location: 'multiple-questions',
      hasUserInput: true,
    });
  }

  return quizzes;
}

/**
 * Detect interactive widgets
 */
export function detectWidgets($: cheerio.CheerioAPI, html: string): InteractiveElement[] {
  const widgets: InteractiveElement[] = [];

  // Check for widget patterns in classes/ids
  WIDGET_PATTERNS.forEach(pattern => {
    const elements = $(`[class*="${pattern.source.replace(/\\i$/, '').toLowerCase()}"], [id*="${pattern.source.replace(/\\i$/, '').toLowerCase()}"]`);
    elements.each((_, el) => {
      const $el = $(el);
      const hasInteraction = $el.find('input, button, select, [onclick], [role="button"]').length > 0;
      if (hasInteraction) {
        widgets.push({
          type: 'widget',
          description: $el.attr('aria-label') || $el.attr('title') || pattern.source,
          location: $el.attr('id') || $el.attr('class')?.split(' ')[0] || 'unknown',
          hasUserInput: hasInteraction,
        });
      }
    });
  });

  // Check for configurators
  CONFIGURATOR_PATTERNS.forEach(pattern => {
    if (pattern.test(html)) {
      const elements = $(`[class*="${pattern.source.replace(/\\i$/, '').toLowerCase()}"]`);
      elements.each((_, el) => {
        const $el = $(el);
        widgets.push({
          type: 'tool',
          description: 'Product configurator/customizer',
          location: $el.attr('id') || 'configurator',
          hasUserInput: true,
        });
      });
    }
  });

  return widgets;
}

/**
 * Detect code playgrounds and sandboxes
 */
export function detectCodePlaygrounds($: cheerio.CheerioAPI, html: string): InteractiveElement[] {
  const playgrounds: InteractiveElement[] = [];

  // Check for common code playground embeds
  const playgroundPatterns = [
    { name: 'CodePen', pattern: /codepen\.io\/.*\/embed/i },
    { name: 'CodeSandbox', pattern: /codesandbox\.io\/embed/i },
    { name: 'JSFiddle', pattern: /jsfiddle\.net.*\/embed/i },
    { name: 'Replit', pattern: /replit\.com.*embed/i },
    { name: 'StackBlitz', pattern: /stackblitz\.com\/edit/i },
  ];

  for (const { name, pattern } of playgroundPatterns) {
    if (pattern.test(html)) {
      playgrounds.push({
        type: 'interactive',
        description: `${name} code playground`,
        location: 'embed',
        hasUserInput: true,
      });
    }
  }

  // Check for Monaco editor or CodeMirror
  if (html.includes('monaco-editor') || html.includes('CodeMirror')) {
    playgrounds.push({
      type: 'interactive',
      description: 'Code editor widget',
      location: 'embedded',
      hasUserInput: true,
    });
  }

  return playgrounds;
}

/**
 * Detect chat widgets
 */
export function detectChatWidgets(html: string): InteractiveElement[] {
  const chatWidgets: InteractiveElement[] = [];

  const chatPatterns = [
    { name: 'Intercom', pattern: /intercom\.com|intercomcdn/i },
    { name: 'Drift', pattern: /drift\.com|js\.driftt/i },
    { name: 'Zendesk', pattern: /zendesk\.com|zdassets/i },
    { name: 'Crisp', pattern: /crisp\.chat/i },
    { name: 'LiveChat', pattern: /livechat\.com|livechatinc/i },
    { name: 'Tawk.to', pattern: /tawk\.to/i },
    { name: 'HubSpot Chat', pattern: /hs-scripts\.com.*chat/i },
    { name: 'Freshdesk', pattern: /freshdesk\.com/i },
  ];

  for (const { name, pattern } of chatPatterns) {
    if (pattern.test(html)) {
      chatWidgets.push({
        type: 'widget',
        description: `${name} chat widget`,
        location: 'global',
        hasUserInput: true,
      });
    }
  }

  return chatWidgets;
}

/**
 * Detect video embeds (for dwell time)
 */
export function detectVideoEmbeds($: cheerio.CheerioAPI, html: string): InteractiveElement[] {
  const videos: InteractiveElement[] = [];

  // YouTube
  if (html.includes('youtube.com/embed') || html.includes('youtube-nocookie.com/embed')) {
    const youtubeEmbeds = $('iframe[src*="youtube"]');
    videos.push({
      type: 'embed',
      description: `${youtubeEmbeds.length} YouTube video(s) embedded`,
      location: 'content',
      hasUserInput: false,
    });
  }

  // Vimeo
  if (html.includes('player.vimeo.com')) {
    videos.push({
      type: 'embed',
      description: 'Vimeo video embedded',
      location: 'content',
      hasUserInput: false,
    });
  }

  // Wistia
  if (html.includes('wistia.com') || html.includes('wistia.net')) {
    videos.push({
      type: 'embed',
      description: 'Wistia video embedded',
      location: 'content',
      hasUserInput: false,
    });
  }

  // Loom
  if (html.includes('loom.com/embed')) {
    videos.push({
      type: 'embed',
      description: 'Loom video embedded',
      location: 'content',
      hasUserInput: false,
    });
  }

  // HTML5 video
  const html5Videos = $('video');
  if (html5Videos.length > 0) {
    videos.push({
      type: 'embed',
      description: `${html5Videos.length} HTML5 video(s)`,
      location: 'content',
      hasUserInput: false,
    });
  }

  return videos;
}

/**
 * Calculate dwell time score based on interactive elements
 */
function calculateDwellTimeScore(data: Omit<InteractiveToolsData, 'dwellTimeScore' | 'recommendations'>): number {
  let score = 0;

  // Interactive tools (high value)
  if (data.dwellTimeSignals.hasCalculator) score += 25;
  if (data.dwellTimeSignals.hasQuiz) score += 20;
  if (data.dwellTimeSignals.hasConfigurator) score += 25;
  if (data.dwellTimeSignals.hasCodePlayground) score += 15;

  // Video embeds (medium value)
  if (data.dwellTimeSignals.hasVideoEmbed) score += 15;

  // Widgets (lower value)
  if (data.dwellTimeSignals.hasInteractiveWidget) score += 10;
  if (data.dwellTimeSignals.hasChatWidget) score += 5;

  return Math.min(score, 100);
}

/**
 * Main function: Analyze interactive tools on the page
 */
export function analyzeInteractiveTools(
  html: string,
  url: string
): { issues: AuditIssue[]; data: InteractiveToolsData } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];

  // Detect all interactive elements
  const calculators = detectCalculators($);
  const quizzes = detectQuizzes($);
  const widgets = detectWidgets($, html);
  const codePlaygrounds = detectCodePlaygrounds($, html);
  const chatWidgets = detectChatWidgets(html);
  const videoEmbeds = detectVideoEmbeds($, html);

  // Combine all tools
  const allTools: InteractiveElement[] = [
    ...calculators,
    ...quizzes,
    ...widgets,
    ...codePlaygrounds,
    ...chatWidgets,
    ...videoEmbeds,
  ];

  // Deduplicate by location
  const uniqueTools = allTools.filter((tool, index, self) =>
    index === self.findIndex(t => t.location === tool.location && t.type === tool.type)
  );

  // Build dwell time signals
  const dwellTimeSignals = {
    hasCalculator: calculators.length > 0,
    hasQuiz: quizzes.length > 0,
    hasInteractiveWidget: widgets.length > 0,
    hasVideoEmbed: videoEmbeds.length > 0,
    hasCodePlayground: codePlaygrounds.length > 0,
    hasConfigurator: widgets.some(w => w.description.toLowerCase().includes('configurator')),
    hasChatWidget: chatWidgets.length > 0,
  };

  // Calculate dwell time score
  const partialData = {
    hasInteractiveTools: uniqueTools.length > 0,
    tools: uniqueTools,
    dwellTimeSignals,
    toolCount: uniqueTools.length,
  };
  const dwellTimeScore = calculateDwellTimeScore(partialData);

  // Generate recommendations
  const recommendations: string[] = [];

  if (!dwellTimeSignals.hasCalculator && !dwellTimeSignals.hasQuiz) {
    recommendations.push('Add an interactive calculator or quiz to boost dwell time and generate backlinks');
  }

  if (!dwellTimeSignals.hasVideoEmbed) {
    recommendations.push('Embed a YouTube video to increase engagement and dwell time');
  }

  if (!dwellTimeSignals.hasInteractiveWidget && !dwellTimeSignals.hasConfigurator) {
    recommendations.push('Consider adding a free tool (generator, checker, converter) as a link magnet');
  }

  // Generate issues

  // Check if page type suggests it should have interactive tools
  const isServicePage = /services?|pricing|product/i.test(url) ||
    $('h1').text().toLowerCase().match(/service|pricing|product/);
  const isBlogPage = /blog|article|post/i.test(url);

  // No interactive elements on service page
  if (isServicePage && uniqueTools.length === 0) {
    issues.push({
      code: 'NO_INTERACTIVE_TOOLS',
      severity: 'notice',
      category: 'content',
      title: 'Service page lacks interactive tools',
      description: 'This service/product page has no interactive elements like calculators or configurators.',
      impact: 'Interactive tools increase dwell time by 2-3x and are powerful link magnets for backlink acquisition.',
      howToFix: 'Add a relevant calculator (ROI, cost estimator, savings) or product configurator to the page.',
      affectedUrls: [url],
      details: {
        pageType: 'service/product',
        recommendation: 'Consider adding a pricing calculator, ROI estimator, or product configurator',
      },
    });
  }

  // Blog page without video
  if (isBlogPage && !dwellTimeSignals.hasVideoEmbed) {
    issues.push({
      code: 'BLOG_NO_VIDEO',
      severity: 'notice',
      category: 'content',
      title: 'Blog post lacks video content',
      description: 'This blog post has no embedded video content.',
      impact: 'Embedded YouTube videos increase dwell time and can appear in video search results.',
      howToFix: 'Create and embed a YouTube video that summarizes or expands on the blog content.',
      affectedUrls: [url],
    });
  }

  // Low dwell time signals overall
  if (dwellTimeScore < 20 && uniqueTools.length === 0) {
    issues.push({
      code: 'LOW_DWELL_TIME_SIGNALS',
      severity: 'notice',
      category: 'content',
      title: 'Page lacks dwell time optimization',
      description: 'No interactive tools, calculators, quizzes, or video embeds detected.',
      impact: 'Interactive content significantly increases time on page, a user engagement signal.',
      howToFix: 'Add at least one interactive element: calculator, quiz, embedded video, or free tool.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      hasInteractiveTools: uniqueTools.length > 0,
      tools: uniqueTools,
      dwellTimeSignals,
      toolCount: uniqueTools.length,
      dwellTimeScore,
      recommendations,
    },
  };
}
