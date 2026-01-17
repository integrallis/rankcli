import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface SchemaItem {
  type: string;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

export interface StructuredDataData {
  schemas: SchemaItem[];
  hasSchema: boolean;
  schemaTypes: string[];
}

// Required properties for common schema types
const SCHEMA_REQUIRED_PROPERTIES: Record<string, string[]> = {
  'Organization': ['name', 'url'],
  'WebSite': ['name', 'url'],
  'WebPage': ['name'],
  'Article': ['headline', 'author', 'datePublished'],
  'BlogPosting': ['headline', 'author', 'datePublished'],
  'NewsArticle': ['headline', 'author', 'datePublished'],
  'Product': ['name', 'image'],
  'LocalBusiness': ['name', 'address'],
  'Person': ['name'],
  'Event': ['name', 'startDate', 'location'],
  'Recipe': ['name', 'image', 'recipeIngredient'],
  'FAQPage': ['mainEntity'],
  'HowTo': ['name', 'step'],
  'BreadcrumbList': ['itemListElement'],
  'SoftwareApplication': ['name', 'operatingSystem'],
  'VideoObject': ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  'ImageObject': ['contentUrl'],
  'Review': ['itemReviewed', 'author'],
  'AggregateRating': ['ratingValue', 'reviewCount'],
  'Offer': ['price', 'priceCurrency'],
};

// Recommended properties for common schema types
const SCHEMA_RECOMMENDED_PROPERTIES: Record<string, string[]> = {
  'Organization': ['logo', 'sameAs', 'contactPoint'],
  'Article': ['image', 'publisher', 'dateModified'],
  'Product': ['description', 'offers', 'brand', 'review', 'aggregateRating'],
  'LocalBusiness': ['telephone', 'openingHours', 'geo'],
  'SoftwareApplication': ['applicationCategory', 'offers', 'aggregateRating'],
  'VideoObject': ['duration', 'embedUrl'],
};

export function analyzeStructuredData(html: string, url: string): { issues: AuditIssue[]; data: StructuredDataData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const schemas: SchemaItem[] = [];

  // Find all JSON-LD scripts
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;

    try {
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item['@graph']) {
          // Handle @graph format
          for (const graphItem of item['@graph']) {
            const schemaItem = validateSchemaItem(graphItem);
            schemas.push(schemaItem);
          }
        } else {
          const schemaItem = validateSchemaItem(item);
          schemas.push(schemaItem);
        }
      }
    } catch (e) {
      issues.push({
        ...ISSUE_DEFINITIONS.SCHEMA_INVALID,
        affectedUrls: [url],
        details: {
          error: e instanceof Error ? e.message : 'Invalid JSON',
          content: content.substring(0, 200),
        },
      });
    }
  });

  // Check if any schema exists
  if (schemas.length === 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.SCHEMA_MISSING,
      affectedUrls: [url],
    });
  }

  // Check for required properties
  for (const schema of schemas) {
    if (schema.errors.length > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.SCHEMA_MISSING_REQUIRED,
        affectedUrls: [url],
        details: {
          type: schema.type,
          missingProperties: schema.errors,
        },
      });
    }
  }

  const schemaTypes = schemas.map(s => s.type).filter(Boolean);

  return {
    issues,
    data: {
      schemas,
      hasSchema: schemas.length > 0,
      schemaTypes,
    }
  };
}

function validateSchemaItem(item: Record<string, unknown>): SchemaItem {
  const type = (item['@type'] as string) || 'Unknown';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required properties
  const required = SCHEMA_REQUIRED_PROPERTIES[type] || [];
  for (const prop of required) {
    if (!item[prop]) {
      errors.push(`Missing required property: ${prop}`);
    }
  }

  // Check recommended properties
  const recommended = SCHEMA_RECOMMENDED_PROPERTIES[type] || [];
  for (const prop of recommended) {
    if (!item[prop]) {
      warnings.push(`Missing recommended property: ${prop}`);
    }
  }

  // Validate specific types
  if (type === 'BreadcrumbList') {
    const items = item['itemListElement'] as unknown[];
    if (items && Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const crumb = items[i] as Record<string, unknown>;
        if (!crumb['position']) {
          errors.push(`Breadcrumb item ${i + 1} missing position`);
        }
        if (!crumb['name'] && !crumb['item']) {
          errors.push(`Breadcrumb item ${i + 1} missing name or item`);
        }
      }
    }
  }

  if (type === 'FAQPage') {
    const mainEntity = item['mainEntity'] as unknown[];
    if (!mainEntity || !Array.isArray(mainEntity) || mainEntity.length === 0) {
      errors.push('FAQPage must have at least one question in mainEntity');
    } else {
      for (let i = 0; i < mainEntity.length; i++) {
        const qa = mainEntity[i] as Record<string, unknown>;
        if (!qa['name']) {
          errors.push(`FAQ item ${i + 1} missing question (name)`);
        }
        if (!qa['acceptedAnswer']) {
          errors.push(`FAQ item ${i + 1} missing answer (acceptedAnswer)`);
        }
      }
    }
  }

  if (type === 'Product' && item['offers']) {
    const offers = item['offers'] as Record<string, unknown>;
    if (!offers['price'] && !offers['lowPrice']) {
      warnings.push('Product offers should include price');
    }
    if (!offers['availability']) {
      warnings.push('Product offers should include availability');
    }
  }

  return {
    type,
    data: item,
    errors,
    warnings,
  };
}

// Suggest appropriate schema types based on page content
export function suggestSchemaTypes(html: string, url: string): string[] {
  const $ = cheerio.load(html);
  const suggestions: string[] = [];
  const path = new URL(url).pathname.toLowerCase();

  // Always suggest Organization and WebSite for homepage
  if (path === '/' || path === '') {
    suggestions.push('Organization', 'WebSite');
  }

  // Check for blog/article patterns
  if (path.includes('/blog') || path.includes('/article') || path.includes('/post') || path.includes('/news')) {
    suggestions.push('Article', 'BlogPosting');
  }

  // Check for product patterns
  if (path.includes('/product') || path.includes('/shop') || path.includes('/item')) {
    suggestions.push('Product');
  }

  // Check for FAQ patterns
  if (path.includes('/faq') || path.includes('/help') || $('h2:contains("FAQ"), h3:contains("FAQ")').length > 0) {
    suggestions.push('FAQPage');
  }

  // Check for contact/about patterns
  if (path.includes('/contact') || path.includes('/about')) {
    suggestions.push('Organization', 'LocalBusiness');
  }

  // Check for SaaS/software patterns
  if (path.includes('/pricing') || $('meta[name="application-name"]').length > 0) {
    suggestions.push('SoftwareApplication');
  }

  // Check for breadcrumbs
  if ($('[class*="breadcrumb"], nav[aria-label*="breadcrumb"]').length > 0) {
    suggestions.push('BreadcrumbList');
  }

  return [...new Set(suggestions)];
}
