// Keyword Research Types

export interface SiteProfile {
  domain: string;
  domainAge: 'new' | 'established' | 'authority';
  backlinkCount: 'none' | 'few' | 'some' | 'many';
  businessGoal: 'signups' | 'purchases' | 'leads' | 'awareness';
  contentCapacity: 'low' | 'medium' | 'high';
  targetGeo: string;
}

export interface KeywordData {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc?: number;
  trafficPotential?: number;
  intent?: 'informational' | 'commercial' | 'transactional' | 'navigational';
  trend?: 'up' | 'down' | 'stable';
  source: 'gsc' | 'dataforseo' | 'autocomplete' | 'manual' | 'competitor';
}

export interface KeywordOpportunity extends KeywordData {
  priorityScore: number;
  category: 'quick-win' | 'medium-term' | 'long-term';
  suggestedAction: KeywordAction;
  currentRanking?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
}

export interface KeywordAction {
  type: 'add-to-title' | 'add-to-h1' | 'add-to-meta' | 'create-content' | 'optimize-existing';
  description: string;
  targetElement?: string;
  currentValue?: string;
  suggestedValue?: string;
  file?: string;
  line?: number;
}

export interface KeywordResearchResult {
  siteProfile: SiteProfile;
  keywords: KeywordOpportunity[];
  quickWins: KeywordOpportunity[];
  mediumTerm: KeywordOpportunity[];
  longTerm: KeywordOpportunity[];
  recommendations: string[];
  maxKdThreshold: number;
}

export interface GSCQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Questions to ask the user
export const SITE_PROFILE_QUESTIONS = [
  {
    id: 'domainAge',
    question: 'How old is your domain?',
    options: [
      { value: 'new', label: 'New (< 6 months)', description: 'Just started, building from scratch' },
      { value: 'established', label: 'Established (6 months - 2 years)', description: 'Has some history and content' },
      { value: 'authority', label: 'Authority (2+ years)', description: 'Well-established with backlinks' },
    ],
    impact: 'Determines the maximum keyword difficulty you should target',
  },
  {
    id: 'backlinkCount',
    question: 'How many backlinks does your site have?',
    options: [
      { value: 'none', label: 'None or very few (0-10)', description: 'Just starting link building' },
      { value: 'few', label: 'Some (10-50)', description: 'A few quality backlinks' },
      { value: 'some', label: 'Moderate (50-200)', description: 'Decent backlink profile' },
      { value: 'many', label: 'Many (200+)', description: 'Strong backlink profile' },
    ],
    impact: 'Affects your ability to rank for competitive keywords',
  },
  {
    id: 'businessGoal',
    question: 'What is your primary business goal?',
    options: [
      { value: 'signups', label: 'Get signups/registrations', description: 'SaaS, apps, newsletters' },
      { value: 'purchases', label: 'Generate purchases', description: 'E-commerce, products' },
      { value: 'leads', label: 'Capture leads', description: 'B2B, services, consulting' },
      { value: 'awareness', label: 'Build brand awareness', description: 'Content, community, thought leadership' },
    ],
    impact: 'Weights commercial vs informational keywords',
  },
  {
    id: 'contentCapacity',
    question: 'How much content can you produce monthly?',
    options: [
      { value: 'low', label: '1-2 pages/month', description: 'Limited time or resources' },
      { value: 'medium', label: '3-5 pages/month', description: 'Moderate content output' },
      { value: 'high', label: '5+ pages/month', description: 'Dedicated content team' },
    ],
    impact: 'Determines how many keywords to suggest',
  },
  {
    id: 'targetGeo',
    question: 'Where are your target customers?',
    options: [
      { value: 'us', label: 'United States', description: 'Primary US audience' },
      { value: 'uk', label: 'United Kingdom', description: 'Primary UK audience' },
      { value: 'global', label: 'Global', description: 'Worldwide audience' },
      { value: 'other', label: 'Other', description: 'Specific country or region' },
    ],
    impact: 'Determines which search volume data to use',
  },
] as const;

// KD thresholds based on site profile
export function getMaxKdThreshold(profile: SiteProfile): number {
  const ageMultiplier = {
    new: 1,
    established: 2,
    authority: 3,
  };

  const backlinkMultiplier = {
    none: 1,
    few: 1.2,
    some: 1.5,
    many: 2,
  };

  const baseKd = 10;
  const maxKd = baseKd * ageMultiplier[profile.domainAge] * backlinkMultiplier[profile.backlinkCount];

  return Math.min(Math.round(maxKd), 50); // Cap at 50
}

// Priority weights
export const PRIORITY_WEIGHTS = {
  businessValue: 0.40,
  difficulty: 0.35,
  trafficPotential: 0.25,
};
