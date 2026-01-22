/**
 * Keyword Research Wizard
 *
 * Interactive wizard to reduce uncertainty in keyword research.
 * Works with CLI (inquirer-style) and Web (JSON responses).
 */

import OpenAI from 'openai';
import { crawlSite } from './site-crawler.js';
import { summarizeSite, type SiteSummary } from './ai-summarizer.js';

export interface WizardQuestion {
  id: string;
  question: string;
  description?: string;
  type: 'select' | 'multi-select' | 'text' | 'confirm';
  options?: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  required: boolean;
  impactOnConfidence: number;
  category: 'product' | 'audience' | 'competition' | 'goals' | 'constraints';
}

export interface WizardResponse {
  questionId: string;
  answer: string | string[];
  confidence: 'certain' | 'somewhat' | 'unsure';
}

export interface WizardSession {
  sessionId: string;
  url: string;
  siteSummary: SiteSummary;
  questions: WizardQuestion[];
  responses: WizardResponse[];
  currentQuestionIndex: number;
  isComplete: boolean;
  finalConfidence: number;
}

export interface WizardResult {
  session: WizardSession;
  canProceed: boolean;
  message: string;
  nextSteps: string[];
}

/**
 * Start a new wizard session
 */
export async function startWizardSession(
  url: string,
  options: {
    openaiApiKey?: string;
    existingResponses?: WizardResponse[];
  } = {}
): Promise<WizardSession> {
  // Crawl site first
  console.log('🔍 Analyzing your site...');
  const crawlResult = await crawlSite(url, { maxPages: 10 });

  // Get AI summary if API key available
  let siteSummary: SiteSummary;
  if (options.openaiApiKey) {
    siteSummary = await summarizeSite(crawlResult, {
      openaiApiKey: options.openaiApiKey,
    });
  } else {
    // Basic summary without AI
    siteSummary = {
      productName: crawlResult.domain,
      productDescription: 'Unable to determine - AI analysis required',
      targetAudience: 'Unknown',
      keyFeatures: crawlResult.uniqueHeadings.slice(0, 5),
      industry: 'Unknown',
      businessModel: 'other',
      valueProposition: '',
      useCases: [],
      problemsSolved: [],
      suggestedSeedKeywords: [],
      confidence: 0.2,
      uncertainties: [
        'Product description needs user input',
        'Target audience is unknown',
        'Industry classification needed',
        'Value proposition unclear',
      ],
    };
  }

  // Generate questions based on uncertainty
  const questions = generateWizardQuestions(siteSummary);

  // Apply any existing responses
  let responses: WizardResponse[] = [];
  let currentIndex = 0;

  if (options.existingResponses) {
    responses = options.existingResponses;
    currentIndex = responses.length;
  }

  return {
    sessionId: `wizard_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url,
    siteSummary,
    questions,
    responses,
    currentQuestionIndex: currentIndex,
    isComplete: currentIndex >= questions.length,
    finalConfidence: siteSummary.confidence,
  };
}

/**
 * Generate wizard questions based on site summary uncertainty
 */
export function generateWizardQuestions(summary: SiteSummary): WizardQuestion[] {
  const questions: WizardQuestion[] = [];

  // Question 1: Product Description (if unclear)
  if (summary.confidence < 0.8 || summary.productDescription.includes('Unable')) {
    questions.push({
      id: 'product_description',
      question: 'What does your product/service do?',
      description: 'Describe your product in 1-2 sentences',
      type: 'text',
      required: true,
      impactOnConfidence: 0.25,
      category: 'product',
    });
  }

  // Question 2: Target Audience
  if (summary.targetAudience === 'Unknown' || summary.confidence < 0.7) {
    questions.push({
      id: 'target_audience',
      question: 'Who is your primary target customer?',
      description: 'Select the option that best describes your ideal customer',
      type: 'select',
      options: [
        { value: 'small_business', label: 'Small Businesses', description: '1-50 employees' },
        { value: 'mid_market', label: 'Mid-Market Companies', description: '50-500 employees' },
        { value: 'enterprise', label: 'Enterprise', description: '500+ employees' },
        { value: 'developers', label: 'Developers/Technical Users', description: 'Individual devs or dev teams' },
        { value: 'marketers', label: 'Marketing Teams', description: 'Marketing professionals' },
        { value: 'consumers', label: 'Individual Consumers', description: 'B2C audience' },
        { value: 'freelancers', label: 'Freelancers/Agencies', description: 'Independent professionals' },
        { value: 'other', label: 'Other', description: 'Will specify below' },
      ],
      required: true,
      impactOnConfidence: 0.2,
      category: 'audience',
    });
  }

  // Question 3: Industry/Category
  if (summary.industry === 'Unknown') {
    questions.push({
      id: 'industry',
      question: 'What industry or category is your product in?',
      description: 'e.g., "Marketing Automation", "Project Management", "AI Tools"',
      type: 'text',
      required: true,
      impactOnConfidence: 0.15,
      category: 'product',
    });
  }

  // Question 4: Main Problem Solved
  if (summary.problemsSolved.length === 0) {
    questions.push({
      id: 'main_problem',
      question: 'What is the main problem your product solves?',
      description: 'Be specific about the pain point you address',
      type: 'text',
      required: true,
      impactOnConfidence: 0.2,
      category: 'product',
    });
  }

  // Question 5: Competitors
  questions.push({
    id: 'competitors',
    question: 'Who are your main competitors?',
    description: 'List 2-5 competitors (comma-separated)',
    type: 'text',
    required: false,
    impactOnConfidence: 0.1,
    category: 'competition',
  });

  // Question 6: Differentiator
  if (!summary.nicheFocus) {
    questions.push({
      id: 'differentiator',
      question: 'What makes your product different from competitors?',
      description: 'Your unique selling point or niche focus',
      type: 'text',
      required: false,
      impactOnConfidence: 0.15,
      category: 'competition',
    });
  }

  // Question 7: Business Goal
  questions.push({
    id: 'business_goal',
    question: 'What is your primary SEO goal?',
    type: 'select',
    options: [
      { value: 'signups', label: 'Get More Signups/Trials', description: 'SaaS, apps, services' },
      { value: 'leads', label: 'Generate Leads', description: 'Contact forms, demos' },
      { value: 'traffic', label: 'Drive Organic Traffic', description: 'Content, ad revenue' },
      { value: 'awareness', label: 'Build Brand Awareness', description: 'Thought leadership' },
      { value: 'sales', label: 'Direct Sales', description: 'E-commerce, purchases' },
    ],
    required: true,
    impactOnConfidence: 0.1,
    category: 'goals',
  });

  // Question 8: Content Capacity
  questions.push({
    id: 'content_capacity',
    question: 'How much content can you produce monthly?',
    type: 'select',
    options: [
      { value: 'low', label: '1-2 pages/month', description: 'Limited time or resources' },
      { value: 'medium', label: '3-5 pages/month', description: 'Moderate output' },
      { value: 'high', label: '6+ pages/month', description: 'Dedicated content team' },
    ],
    required: true,
    impactOnConfidence: 0.05,
    category: 'constraints',
  });

  // Question 9: Domain Authority (self-assessment)
  questions.push({
    id: 'domain_authority',
    question: 'How would you describe your website\'s current SEO standing?',
    type: 'select',
    options: [
      { value: 'new', label: 'New Site', description: 'Less than 6 months old, few/no backlinks' },
      { value: 'growing', label: 'Growing Site', description: '6-24 months, some backlinks' },
      { value: 'established', label: 'Established Site', description: '2+ years, decent backlinks' },
      { value: 'authority', label: 'Authority Site', description: 'Strong domain, many backlinks' },
    ],
    required: true,
    impactOnConfidence: 0.05,
    category: 'constraints',
  });

  // Sort by impact
  return questions.sort((a, b) => b.impactOnConfidence - a.impactOnConfidence);
}

/**
 * Process a wizard response and update session
 */
export function processWizardResponse(
  session: WizardSession,
  response: WizardResponse
): WizardSession {
  // Add response
  const responses = [...session.responses, response];

  // Calculate new confidence
  const question = session.questions.find((q) => q.id === response.questionId);
  let confidenceBoost = question?.impactOnConfidence || 0;

  // Reduce boost if user is unsure
  if (response.confidence === 'unsure') {
    confidenceBoost *= 0.5;
  } else if (response.confidence === 'somewhat') {
    confidenceBoost *= 0.75;
  }

  const newConfidence = Math.min(1, session.finalConfidence + confidenceBoost);

  // Update current index
  const currentIndex = session.currentQuestionIndex + 1;
  const isComplete = currentIndex >= session.questions.length;

  return {
    ...session,
    responses,
    currentQuestionIndex: currentIndex,
    isComplete,
    finalConfidence: newConfidence,
  };
}

/**
 * Get the next question in the wizard
 */
export function getNextQuestion(session: WizardSession): WizardQuestion | null {
  if (session.isComplete) return null;
  return session.questions[session.currentQuestionIndex] || null;
}

/**
 * Skip to a specific question
 */
export function skipToQuestion(session: WizardSession, questionId: string): WizardSession {
  const index = session.questions.findIndex((q) => q.id === questionId);
  if (index === -1) return session;

  return {
    ...session,
    currentQuestionIndex: index,
  };
}

/**
 * Complete the wizard and get result
 */
export function completeWizard(session: WizardSession): WizardResult {
  const canProceed = session.finalConfidence >= 0.6;

  let message: string;
  let nextSteps: string[] = [];

  if (canProceed) {
    message = `✅ Confidence level: ${Math.round(session.finalConfidence * 100)}%. Ready to generate keyword recommendations.`;
    nextSteps = [
      'Run keyword research with your responses',
      'Review and prioritize suggested keywords',
      'Start with low-difficulty, high-relevance keywords',
    ];
  } else {
    message = `⚠️ Confidence level: ${Math.round(session.finalConfidence * 100)}%. Consider providing more details for better recommendations.`;
    nextSteps = [
      'Answer any skipped questions',
      'Provide more specific details in text answers',
      'Run with lower confidence (results may be less accurate)',
    ];
  }

  return {
    session,
    canProceed,
    message,
    nextSteps,
  };
}

/**
 * Convert wizard responses to keyword research context
 */
export function wizardResponsesToContext(
  session: WizardSession
): {
  productDescription?: string;
  targetAudience?: string;
  competitors?: string[];
  mainProblem?: string;
  differentiator?: string;
  businessGoal?: string;
  contentCapacity?: string;
  domainAuthority?: string;
} {
  const context: Record<string, any> = {};

  for (const response of session.responses) {
    const answer = Array.isArray(response.answer) ? response.answer.join(', ') : response.answer;

    switch (response.questionId) {
      case 'product_description':
        context.productDescription = answer;
        break;
      case 'target_audience':
        context.targetAudience = answer;
        break;
      case 'competitors':
        context.competitors = answer.split(',').map((c: string) => c.trim()).filter(Boolean);
        break;
      case 'main_problem':
        context.mainProblem = answer;
        break;
      case 'differentiator':
        context.differentiator = answer;
        break;
      case 'business_goal':
        context.businessGoal = answer;
        break;
      case 'content_capacity':
        context.contentCapacity = answer;
        break;
      case 'domain_authority':
        context.domainAuthority = answer;
        break;
      case 'industry':
        context.industry = answer;
        break;
    }
  }

  return context;
}

/**
 * Format wizard session for CLI output
 */
export function formatWizardProgress(session: WizardSession): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('  KEYWORD RESEARCH WIZARD');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`  Site: ${session.url}`);
  lines.push(`  Progress: ${session.currentQuestionIndex}/${session.questions.length} questions`);
  lines.push(`  Confidence: ${Math.round(session.finalConfidence * 100)}%`);
  lines.push('');

  // Progress bar
  const progress = session.currentQuestionIndex / session.questions.length;
  const filled = Math.round(progress * 40);
  const empty = 40 - filled;
  lines.push(`  [${'█'.repeat(filled)}${'░'.repeat(empty)}]`);
  lines.push('');

  // Current question
  const current = getNextQuestion(session);
  if (current) {
    lines.push('─'.repeat(60));
    lines.push(`  Question ${session.currentQuestionIndex + 1}:`);
    lines.push(`  ${current.question}`);
    if (current.description) {
      lines.push(`  (${current.description})`);
    }
    lines.push('');

    if (current.options) {
      lines.push('  Options:');
      current.options.forEach((opt, i) => {
        lines.push(`    ${i + 1}. ${opt.label}`);
        if (opt.description) {
          lines.push(`       ${opt.description}`);
        }
      });
    }
  } else {
    lines.push('  ✅ All questions answered!');
  }

  lines.push('');
  lines.push('═'.repeat(60));

  return lines.join('\n');
}
