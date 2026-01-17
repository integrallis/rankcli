// Keyword Prioritization Algorithm

import type {
  SiteProfile,
  KeywordData,
  KeywordOpportunity,
  KeywordAction,
  KeywordResearchResult,
} from './types.js';
import { getMaxKdThreshold, PRIORITY_WEIGHTS } from './types.js';

export function prioritizeKeywords(
  keywords: KeywordData[],
  siteProfile: SiteProfile,
  existingMeta?: { title?: string; description?: string; h1?: string }
): KeywordResearchResult {
  const maxKd = getMaxKdThreshold(siteProfile);

  // Score and categorize each keyword
  const opportunities: KeywordOpportunity[] = keywords.map((kw) => {
    const priorityScore = calculatePriorityScore(kw, siteProfile, maxKd);
    const category = categorizeKeyword(kw.keywordDifficulty, maxKd);
    const suggestedAction = suggestAction(kw, existingMeta, category);

    return {
      ...kw,
      priorityScore,
      category,
      suggestedAction,
    };
  });

  // Sort by priority score
  opportunities.sort((a, b) => b.priorityScore - a.priorityScore);

  // Categorize into buckets
  const quickWins = opportunities.filter((kw) => kw.category === 'quick-win');
  const mediumTerm = opportunities.filter((kw) => kw.category === 'medium-term');
  const longTerm = opportunities.filter((kw) => kw.category === 'long-term');

  // Generate recommendations
  const recommendations = generateRecommendations(siteProfile, quickWins, mediumTerm);

  return {
    siteProfile,
    keywords: opportunities,
    quickWins,
    mediumTerm,
    longTerm,
    recommendations,
    maxKdThreshold: maxKd,
  };
}

function calculatePriorityScore(
  keyword: KeywordData,
  profile: SiteProfile,
  maxKd: number
): number {
  // Business value score (0-100)
  const businessScore = calculateBusinessValue(keyword, profile.businessGoal);

  // Difficulty score (inverse - lower KD = higher score)
  let difficultyScore = 0;
  if (keyword.keywordDifficulty <= maxKd) {
    difficultyScore = 100 - (keyword.keywordDifficulty / maxKd) * 100;
  }

  // Traffic score (normalized, capped at 100)
  const trafficScore = Math.min((keyword.searchVolume / 1000) * 100, 100);

  // Weighted sum
  const score =
    businessScore * PRIORITY_WEIGHTS.businessValue +
    difficultyScore * PRIORITY_WEIGHTS.difficulty +
    trafficScore * PRIORITY_WEIGHTS.trafficPotential;

  return Math.round(score);
}

function calculateBusinessValue(keyword: KeywordData, goal: SiteProfile['businessGoal']): number {
  const intent = keyword.intent || inferIntent(keyword.keyword);

  // Intent weights based on business goal
  const intentWeights: Record<SiteProfile['businessGoal'], Record<string, number>> = {
    signups: {
      transactional: 100,
      commercial: 80,
      informational: 40,
      navigational: 20,
    },
    purchases: {
      transactional: 100,
      commercial: 90,
      informational: 30,
      navigational: 20,
    },
    leads: {
      commercial: 100,
      transactional: 80,
      informational: 60,
      navigational: 20,
    },
    awareness: {
      informational: 100,
      commercial: 60,
      navigational: 40,
      transactional: 30,
    },
  };

  return intentWeights[goal][intent] || 50;
}

function inferIntent(keyword: string): 'informational' | 'commercial' | 'transactional' | 'navigational' {
  const kw = keyword.toLowerCase();

  // Transactional indicators
  if (/\b(buy|purchase|order|subscribe|download|get|try|free trial)\b/.test(kw)) {
    return 'transactional';
  }

  // Commercial investigation
  if (/\b(best|top|review|compare|vs|versus|alternative|pricing|cost)\b/.test(kw)) {
    return 'commercial';
  }

  // Navigational
  if (/\b(login|sign in|website|official|app)\b/.test(kw)) {
    return 'navigational';
  }

  // Default to informational
  return 'informational';
}

function categorizeKeyword(kd: number, maxKd: number): 'quick-win' | 'medium-term' | 'long-term' {
  const quickWinThreshold = Math.min(maxKd * 0.5, 15);
  const mediumThreshold = maxKd;

  if (kd <= quickWinThreshold) return 'quick-win';
  if (kd <= mediumThreshold) return 'medium-term';
  return 'long-term';
}

function suggestAction(
  keyword: KeywordData,
  existingMeta: { title?: string; description?: string; h1?: string } | undefined,
  category: 'quick-win' | 'medium-term' | 'long-term'
): KeywordAction {
  const kw = keyword.keyword;

  // Check if keyword is already in existing meta
  const inTitle = existingMeta?.title?.toLowerCase().includes(kw.toLowerCase());
  const inDescription = existingMeta?.description?.toLowerCase().includes(kw.toLowerCase());
  const inH1 = existingMeta?.h1?.toLowerCase().includes(kw.toLowerCase());

  // Quick wins: optimize existing elements
  if (category === 'quick-win') {
    if (!inTitle && existingMeta?.title) {
      return {
        type: 'add-to-title',
        description: `Add "${kw}" to your title tag`,
        targetElement: 'title',
        currentValue: existingMeta.title,
        suggestedValue: generateTitleWithKeyword(existingMeta.title, kw),
      };
    }

    if (!inH1) {
      return {
        type: 'add-to-h1',
        description: `Include "${kw}" in your H1 heading`,
        targetElement: 'h1',
        currentValue: existingMeta?.h1,
        suggestedValue: generateH1WithKeyword(existingMeta?.h1, kw),
      };
    }

    if (!inDescription && existingMeta?.description) {
      return {
        type: 'add-to-meta',
        description: `Add "${kw}" to your meta description`,
        targetElement: 'meta[name="description"]',
        currentValue: existingMeta.description,
        suggestedValue: generateDescriptionWithKeyword(existingMeta.description, kw),
      };
    }

    return {
      type: 'optimize-existing',
      description: `Optimize existing content for "${kw}"`,
    };
  }

  // Medium-term: may need content creation
  if (category === 'medium-term') {
    return {
      type: 'create-content',
      description: `Create dedicated content targeting "${kw}"`,
    };
  }

  // Long-term: need authority building first
  return {
    type: 'create-content',
    description: `Build authority first, then target "${kw}" (high competition)`,
  };
}

function generateTitleWithKeyword(currentTitle: string, keyword: string): string {
  // If title is short, prepend keyword
  if (currentTitle.length < 30) {
    return `${capitalizeFirst(keyword)} - ${currentTitle}`;
  }

  // Otherwise, try to incorporate naturally
  const parts = currentTitle.split(' - ');
  if (parts.length >= 2) {
    return `${capitalizeFirst(keyword)} | ${parts[parts.length - 1]}`;
  }

  return `${capitalizeFirst(keyword)} | ${currentTitle}`.substring(0, 60);
}

function generateH1WithKeyword(currentH1: string | undefined, keyword: string): string {
  if (!currentH1) {
    return capitalizeFirst(keyword);
  }

  // Try to incorporate keyword naturally
  return `${capitalizeFirst(keyword)} - ${currentH1}`;
}

function generateDescriptionWithKeyword(currentDesc: string, keyword: string): string {
  // If description doesn't start with keyword concept, prepend it
  if (!currentDesc.toLowerCase().includes(keyword.toLowerCase().split(' ')[0])) {
    const newDesc = `${capitalizeFirst(keyword)}: ${currentDesc}`;
    return newDesc.substring(0, 160);
  }

  return currentDesc;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateRecommendations(
  profile: SiteProfile,
  quickWins: KeywordOpportunity[],
  mediumTerm: KeywordOpportunity[]
): string[] {
  const recommendations: string[] = [];

  // Domain age specific recommendations
  if (profile.domainAge === 'new') {
    recommendations.push(
      'Focus on quick-win keywords (KD < 15) first to build initial traffic and authority.'
    );
    recommendations.push(
      'Consider creating long-form, comprehensive content to establish topical authority.'
    );
  }

  // Backlink recommendations
  if (profile.backlinkCount === 'none' || profile.backlinkCount === 'few') {
    recommendations.push(
      'Prioritize building quality backlinks to increase your ranking potential for competitive keywords.'
    );
  }

  // Content recommendations based on capacity
  if (profile.contentCapacity === 'low' && quickWins.length > 2) {
    recommendations.push(
      `Focus on your top ${Math.min(2, quickWins.length)} quick-win keywords first, then expand.`
    );
  }

  // Quick wins available
  if (quickWins.length > 0) {
    recommendations.push(
      `You have ${quickWins.length} quick-win keyword opportunities that you can rank for relatively quickly.`
    );
  }

  // Medium-term opportunities
  if (mediumTerm.length > 0 && profile.domainAge !== 'new') {
    recommendations.push(
      `${mediumTerm.length} medium-difficulty keywords are within reach with focused content and some link building.`
    );
  }

  return recommendations;
}
