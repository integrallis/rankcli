// Entity SEO & Knowledge Graph Optimization
// Reference: "Entity-first SEO: How to align content with Google's Knowledge Graph"
// Google's Knowledge Graph understands entities better than keywords
// Three pillars: Precision, Coverage, Connectivity

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface EntitySEOData {
  entitySignals: {
    hasOrganizationSchema: boolean;
    hasPersonSchema: boolean;
    hasProductSchema: boolean;
    hasSameAsReferences: boolean;
    sameAsUrls: string[];
    hasMainEntityOfPage: boolean;
    hasAboutReference: boolean;
  };
  entityClarity: {
    primaryEntityType: string | null;
    entityNameConsistency: boolean;
    hasEntityDefinition: boolean;
    hasWikipediaStyleIntro: boolean;
    entityMentionCount: number;
  };
  topicalCoverage: {
    hasRelatedEntities: boolean;
    relatedEntityCount: number;
    hasEntityRelationships: boolean;
    topicalDepthScore: number; // 0-100
  };
  knowledgePanelSignals: {
    hasCompanyInfo: boolean;
    hasFounderInfo: boolean;
    hasHeadquarters: boolean;
    hasIndustryMention: boolean;
    hasDateFounded: boolean;
  };
  entitySEOScore: number; // 0-100
  recommendations: string[];
}

/**
 * Extract entity signals from structured data
 */
function extractEntitySignals($: cheerio.CheerioAPI, html: string): EntitySEOData['entitySignals'] {
  let hasOrganizationSchema = false;
  let hasPersonSchema = false;
  let hasProductSchema = false;
  let hasSameAsReferences = false;
  let hasMainEntityOfPage = false;
  let hasAboutReference = false;
  const sameAsUrls: string[] = [];

  // Parse JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html() || '';
      const data = JSON.parse(content);

      const processSchema = (schema: Record<string, unknown>) => {
        const type = schema['@type'];

        if (type === 'Organization' || type === 'Corporation' || type === 'LocalBusiness') {
          hasOrganizationSchema = true;
        }
        if (type === 'Person') {
          hasPersonSchema = true;
        }
        if (type === 'Product' || type === 'SoftwareApplication') {
          hasProductSchema = true;
        }

        if (schema.sameAs) {
          hasSameAsReferences = true;
          if (Array.isArray(schema.sameAs)) {
            sameAsUrls.push(...(schema.sameAs as string[]));
          } else if (typeof schema.sameAs === 'string') {
            sameAsUrls.push(schema.sameAs);
          }
        }

        if (schema.mainEntityOfPage) {
          hasMainEntityOfPage = true;
        }

        if (schema.about) {
          hasAboutReference = true;
        }
      };

      if (Array.isArray(data)) {
        data.forEach(item => processSchema(item as Record<string, unknown>));
      } else if (data['@graph']) {
        (data['@graph'] as Record<string, unknown>[]).forEach(processSchema);
      } else {
        processSchema(data);
      }
    } catch {
      // Invalid JSON
    }
  });

  return {
    hasOrganizationSchema,
    hasPersonSchema,
    hasProductSchema,
    hasSameAsReferences,
    sameAsUrls,
    hasMainEntityOfPage,
    hasAboutReference,
  };
}

/**
 * Analyze entity clarity on the page
 */
function analyzeEntityClarity($: cheerio.CheerioAPI, html: string): EntitySEOData['entityClarity'] {
  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const firstParagraph = $('p').first().text().trim();

  // Detect primary entity type
  let primaryEntityType: string | null = null;
  const bodyText = $('body').text().toLowerCase();

  if (/company|corporation|business|agency|firm/i.test(bodyText)) {
    primaryEntityType = 'Organization';
  } else if (/product|software|tool|app|service/i.test(h1 + ' ' + title)) {
    primaryEntityType = 'Product/Software';
  } else if (/person|author|founder|ceo|expert/i.test(bodyText)) {
    primaryEntityType = 'Person';
  }

  // Check for entity name consistency
  // The entity name should appear consistently in title, H1, and first paragraph
  const titleWords = title.split(/[\s|—-]+/).filter(w => w.length > 3);
  const h1Words = h1.split(/[\s|—-]+/).filter(w => w.length > 3);

  // Find common proper nouns (capitalized words)
  const properNouns = [...title.matchAll(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g)].map(m => m[0]);
  const entityNameConsistency = properNouns.length > 0 &&
    properNouns.some(name => h1.includes(name) || firstParagraph.includes(name));

  // Wikipedia-style intro (entity + "is a" definition)
  const hasWikipediaStyleIntro =
    /is (a|an|the)\s+\w+/i.test(firstParagraph) ||
    /\w+ is (a|an) (software|company|tool|platform|service|agency)/i.test(firstParagraph);

  // Entity definition present
  const hasEntityDefinition =
    hasWikipediaStyleIntro ||
    firstParagraph.length > 100;

  // Count entity mentions
  const brandName = properNouns[0] || title.split(/[|—-]/)[0].trim();
  const entityMentionCount = brandName ?
    (bodyText.match(new RegExp(brandName.toLowerCase(), 'g')) || []).length : 0;

  return {
    primaryEntityType,
    entityNameConsistency,
    hasEntityDefinition,
    hasWikipediaStyleIntro,
    entityMentionCount,
  };
}

/**
 * Analyze topical coverage and entity relationships
 */
function analyzeTopicalCoverage($: cheerio.CheerioAPI, html: string): EntitySEOData['topicalCoverage'] {
  // Look for related entity mentions (competitors, partners, integrations)
  const bodyText = $('body').text();

  // Common relationship patterns
  const relationshipPatterns = [
    /integrates? with/i,
    /works? with/i,
    /similar to/i,
    /alternative to/i,
    /compared to/i,
    /partner(s|ship)? with/i,
    /competitor/i,
    /used by/i,
    /trusted by/i,
  ];

  const hasEntityRelationships = relationshipPatterns.some(p => p.test(bodyText));

  // Count related entities (look for proper nouns that aren't the main entity)
  const allProperNouns = bodyText.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  const uniqueEntities = [...new Set(allProperNouns)].filter(e => e.length > 3);
  const relatedEntityCount = Math.min(uniqueEntities.length, 50); // Cap at 50

  const hasRelatedEntities = relatedEntityCount > 5;

  // Topical depth score
  let topicalDepthScore = 0;
  if (hasEntityRelationships) topicalDepthScore += 30;
  if (relatedEntityCount >= 10) topicalDepthScore += 30;
  else if (relatedEntityCount >= 5) topicalDepthScore += 15;
  if ($('h2, h3').length >= 5) topicalDepthScore += 20;
  if (bodyText.length > 5000) topicalDepthScore += 20;

  return {
    hasRelatedEntities,
    relatedEntityCount,
    hasEntityRelationships,
    topicalDepthScore: Math.min(topicalDepthScore, 100),
  };
}

/**
 * Analyze Knowledge Panel signals
 */
function analyzeKnowledgePanelSignals($: cheerio.CheerioAPI, html: string): EntitySEOData['knowledgePanelSignals'] {
  const bodyText = $('body').text().toLowerCase();
  const schemaText = $('script[type="application/ld+json"]').text();

  return {
    hasCompanyInfo: /about us|about the company|our story|who we are/i.test(bodyText) ||
      /Organization|Corporation/i.test(schemaText),
    hasFounderInfo: /founder|founded by|ceo|chief executive/i.test(bodyText),
    hasHeadquarters: /headquarters|based in|located in|office/i.test(bodyText) ||
      /address/i.test(schemaText),
    hasIndustryMention: /industry|sector|market|specializ/i.test(bodyText),
    hasDateFounded: /founded in|established in|since \d{4}|founded \d{4}/i.test(bodyText) ||
      /foundingDate/i.test(schemaText),
  };
}

/**
 * Calculate overall Entity SEO score
 */
function calculateEntitySEOScore(
  signals: EntitySEOData['entitySignals'],
  clarity: EntitySEOData['entityClarity'],
  coverage: EntitySEOData['topicalCoverage'],
  kpSignals: EntitySEOData['knowledgePanelSignals']
): number {
  let score = 0;

  // Entity signals (max 30)
  if (signals.hasOrganizationSchema || signals.hasPersonSchema) score += 10;
  if (signals.hasSameAsReferences) score += 10;
  if (signals.hasMainEntityOfPage) score += 5;
  if (signals.hasAboutReference) score += 5;

  // Entity clarity (max 30)
  if (clarity.primaryEntityType) score += 10;
  if (clarity.entityNameConsistency) score += 10;
  if (clarity.hasWikipediaStyleIntro) score += 10;

  // Topical coverage (max 20)
  score += Math.round(coverage.topicalDepthScore * 0.2);

  // Knowledge panel signals (max 20)
  const kpCount = Object.values(kpSignals).filter(Boolean).length;
  score += kpCount * 4;

  return Math.min(score, 100);
}

/**
 * Main function: Analyze Entity SEO optimization
 */
export function analyzeEntitySEO(
  html: string,
  url: string
): { issues: AuditIssue[]; data: EntitySEOData } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];

  // Run all analyses
  const entitySignals = extractEntitySignals($, html);
  const entityClarity = analyzeEntityClarity($, html);
  const topicalCoverage = analyzeTopicalCoverage($, html);
  const knowledgePanelSignals = analyzeKnowledgePanelSignals($, html);

  // Calculate score
  const entitySEOScore = calculateEntitySEOScore(
    entitySignals,
    entityClarity,
    topicalCoverage,
    knowledgePanelSignals
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (!entitySignals.hasOrganizationSchema && !entitySignals.hasPersonSchema) {
    recommendations.push('Add Organization or Person schema to establish entity identity');
  }
  if (!entitySignals.hasSameAsReferences) {
    recommendations.push('Add sameAs references to official social profiles and Wikipedia/Wikidata');
  }
  if (!entityClarity.hasWikipediaStyleIntro) {
    recommendations.push('Add a Wikipedia-style definition in the first paragraph (Entity is a...)');
  }
  if (!entitySignals.hasMainEntityOfPage) {
    recommendations.push('Specify mainEntityOfPage in schema to clarify what the page is about');
  }

  // Generate issues

  // No entity schema
  if (!entitySignals.hasOrganizationSchema && !entitySignals.hasPersonSchema && !entitySignals.hasProductSchema) {
    issues.push({
      code: 'NO_ENTITY_SCHEMA',
      severity: 'warning',
      category: 'structured-data',
      title: 'Missing entity schema (Organization/Person/Product)',
      description: 'No schema markup defining the primary entity on this page.',
      impact: 'Entity schema helps Google understand what/who this page is about for Knowledge Graph.',
      howToFix: 'Add Organization, Person, or Product schema with complete properties.',
      affectedUrls: [url],
    });
  }

  // No sameAs references
  if (!entitySignals.hasSameAsReferences && (entitySignals.hasOrganizationSchema || entitySignals.hasPersonSchema)) {
    issues.push({
      code: 'NO_SAMEAS_REFERENCES',
      severity: 'notice',
      category: 'structured-data',
      title: 'Entity schema missing sameAs references',
      description: 'Entity schema found but no sameAs links to authoritative sources.',
      impact: 'sameAs helps Google connect your entity to Knowledge Graph entries (Wikipedia, social profiles).',
      howToFix: 'Add sameAs array with links to Wikipedia, Wikidata, LinkedIn, Twitter, Crunchbase, etc.',
      affectedUrls: [url],
      details: {
        hasOrganization: entitySignals.hasOrganizationSchema,
        hasPerson: entitySignals.hasPersonSchema,
      },
    });
  }

  // No Wikipedia-style intro
  if (!entityClarity.hasWikipediaStyleIntro) {
    issues.push({
      code: 'NO_ENTITY_DEFINITION',
      severity: 'notice',
      category: 'content',
      title: 'Missing entity definition in content',
      description: 'First paragraph lacks a clear definition of the primary entity.',
      impact: 'Clear entity definitions help AI systems extract and cite your content correctly.',
      howToFix: 'Start content with "[Entity Name] is a [type] that [does what]" pattern.',
      affectedUrls: [url],
    });
  }

  // Low entity consistency
  if (!entityClarity.entityNameConsistency && entityClarity.entityMentionCount < 3) {
    issues.push({
      code: 'LOW_ENTITY_CONSISTENCY',
      severity: 'notice',
      category: 'content',
      title: 'Entity name not consistently used',
      description: 'The primary entity name doesn\'t appear consistently across title, H1, and content.',
      impact: 'Consistent entity naming strengthens topical signals for Knowledge Graph.',
      howToFix: 'Ensure the exact entity name appears in title, H1, and first paragraph.',
      affectedUrls: [url],
      details: {
        entityMentionCount: entityClarity.entityMentionCount,
      },
    });
  }

  // No mainEntityOfPage
  if (!entitySignals.hasMainEntityOfPage && entitySignals.hasOrganizationSchema) {
    issues.push({
      code: 'NO_MAIN_ENTITY_OF_PAGE',
      severity: 'notice',
      category: 'structured-data',
      title: 'Schema missing mainEntityOfPage property',
      description: 'Entity schema doesn\'t specify what the page is primarily about.',
      impact: 'mainEntityOfPage helps Google understand the primary topic of each page.',
      howToFix: 'Add mainEntityOfPage property pointing to the current URL or a @id reference.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      entitySignals,
      entityClarity,
      topicalCoverage,
      knowledgePanelSignals,
      entitySEOScore,
      recommendations,
    },
  };
}
