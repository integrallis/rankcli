/**
 * Structured Data / Schema.org Analyzer
 * 
 * Validates JSON-LD structured data for SEO and AI search optimization.
 * Checks for common schema types, required properties, and best practices.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../audit/types.js';

export interface StructuredDataResult {
  score: number;
  schemas: SchemaItem[];
  hasOrganization: boolean;
  hasWebSite: boolean;
  hasWebPage: boolean;
  hasBreadcrumb: boolean;
  hasArticle: boolean;
  hasProduct: boolean;
  hasFAQ: boolean;
  hasHowTo: boolean;
  hasLocalBusiness: boolean;
  hasEvent: boolean;
  hasReview: boolean;
  issues: AuditIssue[];
  recommendations: string[];
}

export interface SchemaItem {
  type: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  properties: string[];
}

// Required and recommended properties for common schema types
const SCHEMA_REQUIREMENTS: Record<string, { required: string[]; recommended: string[] }> = {
  'Organization': {
    required: ['name', 'url'],
    recommended: ['logo', 'sameAs', 'contactPoint', 'address'],
  },
  'WebSite': {
    required: ['name', 'url'],
    recommended: ['potentialAction', 'publisher'],
  },
  'WebPage': {
    required: ['name'],
    recommended: ['description', 'url', 'breadcrumb', 'mainEntity'],
  },
  'Article': {
    required: ['headline', 'author', 'datePublished'],
    recommended: ['image', 'dateModified', 'publisher', 'description', 'mainEntityOfPage'],
  },
  'BlogPosting': {
    required: ['headline', 'author', 'datePublished'],
    recommended: ['image', 'dateModified', 'publisher', 'description'],
  },
  'NewsArticle': {
    required: ['headline', 'author', 'datePublished', 'image'],
    recommended: ['dateModified', 'publisher', 'description'],
  },
  'Product': {
    required: ['name'],
    recommended: ['image', 'description', 'offers', 'brand', 'sku', 'aggregateRating', 'review'],
  },
  'Offer': {
    required: ['price', 'priceCurrency'],
    recommended: ['availability', 'url', 'priceValidUntil'],
  },
  'FAQPage': {
    required: ['mainEntity'],
    recommended: [],
  },
  'Question': {
    required: ['name', 'acceptedAnswer'],
    recommended: [],
  },
  'HowTo': {
    required: ['name', 'step'],
    recommended: ['image', 'totalTime', 'estimatedCost', 'supply', 'tool'],
  },
  'BreadcrumbList': {
    required: ['itemListElement'],
    recommended: [],
  },
  'LocalBusiness': {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHours', 'geo', 'image', 'priceRange'],
  },
  'Event': {
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'description', 'image', 'offers', 'performer', 'organizer'],
  },
  'Review': {
    required: ['itemReviewed', 'reviewRating', 'author'],
    recommended: ['reviewBody', 'datePublished'],
  },
  'AggregateRating': {
    required: ['ratingValue', 'reviewCount'],
    recommended: ['bestRating', 'worstRating'],
  },
  'Person': {
    required: ['name'],
    recommended: ['url', 'image', 'jobTitle', 'sameAs'],
  },
  'VideoObject': {
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    recommended: ['description', 'contentUrl', 'duration', 'embedUrl'],
  },
  'ImageObject': {
    required: ['contentUrl'],
    recommended: ['caption', 'creditText', 'creator'],
  },
  'SoftwareApplication': {
    required: ['name'],
    recommended: ['operatingSystem', 'applicationCategory', 'offers', 'aggregateRating'],
  },
  'Recipe': {
    required: ['name', 'recipeIngredient', 'recipeInstructions'],
    recommended: ['image', 'author', 'prepTime', 'cookTime', 'totalTime', 'nutrition'],
  },
  'Course': {
    required: ['name', 'provider'],
    recommended: ['description', 'offers'],
  },
};

/**
 * Parse and validate JSON-LD structured data
 */
function parseJsonLd(script: string): { data: any; error?: string } {
  try {
    const data = JSON.parse(script);
    return { data };
  } catch (e) {
    return { data: null, error: `Invalid JSON: ${(e as Error).message}` };
  }
}

/**
 * Get all types from a schema object (handles @graph and nested types)
 */
function extractTypes(data: any): string[] {
  const types: string[] = [];
  
  if (!data) return types;
  
  if (Array.isArray(data)) {
    for (const item of data) {
      types.push(...extractTypes(item));
    }
  } else if (typeof data === 'object') {
    if (data['@type']) {
      const schemaType = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
      types.push(...schemaType);
    }
    if (data['@graph']) {
      types.push(...extractTypes(data['@graph']));
    }
  }
  
  return types;
}

/**
 * Validate a schema object against requirements
 */
function validateSchema(data: any, type: string): SchemaItem {
  const errors: string[] = [];
  const warnings: string[] = [];
  const properties: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { type, isValid: false, errors: ['Invalid schema object'], warnings, properties };
  }
  
  // Extract properties
  for (const key of Object.keys(data)) {
    if (!key.startsWith('@')) {
      properties.push(key);
    }
  }
  
  // Check requirements
  const requirements = SCHEMA_REQUIREMENTS[type];
  if (requirements) {
    // Check required properties
    for (const prop of requirements.required) {
      if (!data[prop]) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
    
    // Check recommended properties
    for (const prop of requirements.recommended) {
      if (!data[prop]) {
        warnings.push(`Missing recommended property: ${prop}`);
      }
    }
  }
  
  // Type-specific validations
  if (type === 'Article' || type === 'BlogPosting' || type === 'NewsArticle') {
    // Check for proper author format
    if (data.author && typeof data.author === 'string') {
      warnings.push('author should be a Person or Organization object, not a string');
    }
    // Check for proper publisher format
    if (data.publisher && typeof data.publisher === 'string') {
      warnings.push('publisher should be an Organization object, not a string');
    }
    // Check date format
    if (data.datePublished && !/^\d{4}-\d{2}-\d{2}/.test(data.datePublished)) {
      warnings.push('datePublished should be in ISO 8601 format (YYYY-MM-DD)');
    }
  }
  
  if (type === 'Product') {
    // Check for offers
    if (!data.offers) {
      warnings.push('Product without offers/price - may not show rich results');
    }
  }
  
  if (type === 'FAQPage') {
    // Check for valid Q&A structure
    if (data.mainEntity) {
      const questions = Array.isArray(data.mainEntity) ? data.mainEntity : [data.mainEntity];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.name && !q['@type']?.includes('Question')) {
          errors.push(`FAQ item ${i + 1} is not a valid Question`);
        }
        if (!q.acceptedAnswer) {
          errors.push(`FAQ item ${i + 1} missing acceptedAnswer`);
        }
      }
    }
  }
  
  if (type === 'BreadcrumbList') {
    // Check for proper item list
    if (data.itemListElement) {
      const items = Array.isArray(data.itemListElement) ? data.itemListElement : [data.itemListElement];
      items.forEach((item: Record<string, unknown>, i: number) => {
        if (!item.position) {
          errors.push(`Breadcrumb item ${i + 1} missing position`);
        }
        if (!item.name && !(item.item as Record<string, unknown>)?.name) {
          errors.push(`Breadcrumb item ${i + 1} missing name`);
        }
      });
    }
  }
  
  if (type === 'LocalBusiness') {
    // Check for geo coordinates
    if (data.geo) {
      if (!data.geo.latitude || !data.geo.longitude) {
        warnings.push('geo should include latitude and longitude');
      }
    }
    // Check opening hours format
    if (data.openingHours && typeof data.openingHours === 'string') {
      warnings.push('openingHours should be an array of OpeningHoursSpecification objects for rich results');
    }
  }
  
  return {
    type,
    isValid: errors.length === 0,
    errors,
    warnings,
    properties,
  };
}

/**
 * Analyze all structured data on a page
 */
export function analyzeStructuredData(html: string, url: string): StructuredDataResult {
  const $ = cheerio.load(html);
  const schemas: SchemaItem[] = [];
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Track schema types
  const foundTypes = new Set<string>();
  
  // Parse all JSON-LD scripts
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    
    const { data, error } = parseJsonLd(content);
    
    if (error) {
      issues.push({
        code: 'SCHEMA_INVALID_JSON',
        severity: 'critical',
        category: 'technical',
        title: 'Invalid JSON-LD syntax',
        description: error,
        impact: 'Schema will not be parsed by search engines',
        howToFix: 'Fix JSON syntax errors. Use a JSON validator.',
        affectedUrls: [url],
      });
      score -= 20;
      return;
    }
    
    // Extract and validate all types
    const types = extractTypes(data);
    
    // Process each schema item
    const processItem = (item: any) => {
      if (!item || typeof item !== 'object') return;
      
      let itemType = item['@type'];
      if (Array.isArray(itemType)) itemType = itemType[0];
      
      if (itemType) {
        foundTypes.add(itemType);
        const validation = validateSchema(item, itemType);
        schemas.push(validation);
        
        if (!validation.isValid) {
          for (const err of validation.errors) {
            issues.push({
              code: 'SCHEMA_VALIDATION_ERROR',
              severity: 'warning',
              category: 'technical',
              title: `${itemType} schema error: ${err}`,
              description: `The ${itemType} schema is missing required properties or has invalid data.`,
              impact: 'May not qualify for rich results',
              howToFix: `Add the missing property: ${err.replace('Missing required property: ', '')}`,
              affectedUrls: [url],
            });
            score -= 5;
          }
        }
      }
      
      // Process @graph
      if (item['@graph'] && Array.isArray(item['@graph'])) {
        item['@graph'].forEach(processItem);
      }
    };
    
    if (Array.isArray(data)) {
      data.forEach(processItem);
    } else {
      processItem(data);
    }
  });
  
  // Check for essential schemas
  const hasOrganization = foundTypes.has('Organization');
  const hasWebSite = foundTypes.has('WebSite');
  const hasWebPage = foundTypes.has('WebPage');
  const hasBreadcrumb = foundTypes.has('BreadcrumbList');
  const hasArticle = foundTypes.has('Article') || foundTypes.has('BlogPosting') || foundTypes.has('NewsArticle');
  const hasProduct = foundTypes.has('Product');
  const hasFAQ = foundTypes.has('FAQPage');
  const hasHowTo = foundTypes.has('HowTo');
  const hasLocalBusiness = foundTypes.has('LocalBusiness');
  const hasEvent = foundTypes.has('Event');
  const hasReview = foundTypes.has('Review') || foundTypes.has('AggregateRating');
  
  // Generate recommendations
  if (!hasOrganization) {
    recommendations.push('Add Organization schema for brand knowledge panel');
    score -= 5;
  }
  
  if (!hasWebSite) {
    recommendations.push('Add WebSite schema with SearchAction for sitelinks search box');
    score -= 3;
  }
  
  if (!hasBreadcrumb) {
    recommendations.push('Add BreadcrumbList schema for breadcrumb rich results');
    score -= 3;
  }
  
  // Check for page-type specific schemas
  if (!hasArticle && !hasProduct && !hasFAQ && !hasHowTo && !hasLocalBusiness && !hasEvent) {
    recommendations.push('Add page-specific schema (Article, Product, FAQ, HowTo, etc.)');
    score -= 10;
    
    issues.push({
      code: 'SCHEMA_NO_RICH_RESULT_TYPE',
      severity: 'warning',
      category: 'technical',
      title: 'No rich result schema found',
      description: 'Page lacks schema types that enable rich results (Article, Product, FAQ, etc.)',
      impact: 'Missing opportunity for enhanced search results',
      howToFix: 'Add appropriate schema type for your content (e.g., Article for blog posts, Product for products, FAQ for Q&A)',
      affectedUrls: [url],
    });
  }
  
  // Check for no schema at all
  if (schemas.length === 0) {
    score -= 20;
    issues.push({
      code: 'SCHEMA_NONE_FOUND',
      severity: 'warning',
      category: 'technical',
      title: 'No structured data found',
      description: 'No JSON-LD structured data detected on the page.',
      impact: 'Missing rich results, reduced AI understanding, lower search visibility',
      howToFix: 'Add JSON-LD structured data. At minimum, include Organization and WebPage schemas.',
      affectedUrls: [url],
    });
  }
  
  // AI-specific recommendations
  if (schemas.length > 0 && !hasFAQ) {
    recommendations.push('Consider adding FAQPage schema - excellent for AI search citations');
  }
  
  if (!foundTypes.has('Person') && hasArticle) {
    recommendations.push('Use Person schema for authors to improve E-E-A-T signals');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    schemas,
    hasOrganization,
    hasWebSite,
    hasWebPage,
    hasBreadcrumb,
    hasArticle,
    hasProduct,
    hasFAQ,
    hasHowTo,
    hasLocalBusiness,
    hasEvent,
    hasReview,
    issues,
    recommendations,
  };
}

/**
 * Generate recommended schema for a page type
 */
export function generateSchemaTemplate(pageType: 'article' | 'product' | 'faq' | 'local-business' | 'website', options: {
  siteName: string;
  siteUrl: string;
  authorName?: string;
  organizationName?: string;
}): string {
  const { siteName, siteUrl, authorName, organizationName } = options;
  
  const baseSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: organizationName || siteName,
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: siteUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ];
  
  const pageSchemas: Record<string, object> = {
    article: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: '{{title}}',
      description: '{{description}}',
      image: '{{image_url}}',
      datePublished: '{{date_published}}',
      dateModified: '{{date_modified}}',
      author: {
        '@type': 'Person',
        name: authorName || '{{author_name}}',
        url: '{{author_url}}',
      },
      publisher: {
        '@type': 'Organization',
        name: organizationName || siteName,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo.png`,
        },
      },
    },
    product: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: '{{product_name}}',
      description: '{{product_description}}',
      image: '{{product_image}}',
      brand: {
        '@type': 'Brand',
        name: '{{brand_name}}',
      },
      sku: '{{sku}}',
      offers: {
        '@type': 'Offer',
        price: '{{price}}',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: '{{product_url}}',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '{{rating}}',
        reviewCount: '{{review_count}}',
      },
    },
    faq: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: '{{question_1}}',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '{{answer_1}}',
          },
        },
        {
          '@type': 'Question',
          name: '{{question_2}}',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '{{answer_2}}',
          },
        },
      ],
    },
    'local-business': {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: '{{business_name}}',
      description: '{{description}}',
      url: siteUrl,
      telephone: '{{phone}}',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '{{street}}',
        addressLocality: '{{city}}',
        addressRegion: '{{state}}',
        postalCode: '{{zip}}',
        addressCountry: '{{country}}',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: '{{latitude}}',
        longitude: '{{longitude}}',
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '17:00',
        },
      ],
    },
    website: baseSchemas[1],
  };
  
  const result: object[] = [...baseSchemas];
  if (pageType !== 'website' && pageSchemas[pageType]) {
    result.push(pageSchemas[pageType]);
  }
  
  return JSON.stringify(result, null, 2);
}
