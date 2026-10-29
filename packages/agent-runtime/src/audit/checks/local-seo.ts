// Local SEO Checks
// Checks for LocalBusiness schema, NAP consistency, address/phone detection

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

// Phone number patterns
const PHONE_PATTERNS = [
  /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, // US/Canada
  /\+?[0-9]{1,3}[-.\s]?[0-9]{2,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}/g, // International
  /\b[0-9]{3}[-.\s][0-9]{3}[-.\s][0-9]{4}\b/g, // Simple US format
];

// Address patterns (simplified)
const ADDRESS_PATTERNS = [
  /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|circle|cir|place|pl)[\s,]+[\w\s]+,?\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*\d{5}/gi,
  /\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}/gi, // Generic US address
];

export interface LocalSEOData {
  hasLocalBusinessSchema: boolean;
  hasOrganizationSchema: boolean;
  detectedPhones: string[];
  detectedAddresses: string[];
  schemaData: {
    name?: string;
    address?: string;
    phone?: string;
    hours?: string[];
    geo?: { lat: number; lng: number };
  } | null;
  socialProfiles: string[];
}

/**
 * Extract and validate LocalBusiness/Organization schema
 */
function extractSchema(html: string): {
  hasLocalBusiness: boolean;
  hasOrganization: boolean;
  schemaData: LocalSEOData['schemaData'];
} {
  const $ = cheerio.load(html);
  let hasLocalBusiness = false;
  let hasOrganization = false;
  let schemaData: LocalSEOData['schemaData'] = null;

  // Find JSON-LD scripts
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (!content) return;

      const jsonData = JSON.parse(content);
      const schemas = Array.isArray(jsonData) ? jsonData : [jsonData];

      for (const schema of schemas) {
        // Handle @graph structure
        const items = schema['@graph'] || [schema];

        for (const item of items) {
          const type = item['@type'];

          // Check for LocalBusiness and its subtypes
          const localBusinessTypes = [
            'LocalBusiness',
            'Restaurant',
            'Store',
            'MedicalBusiness',
            'FinancialService',
            'FoodEstablishment',
            'HealthAndBeautyBusiness',
            'HomeAndConstructionBusiness',
            'LegalService',
            'RealEstateAgent',
            'SportsActivityLocation',
          ];

          if (localBusinessTypes.some((t) => type === t || (Array.isArray(type) && type.includes(t)))) {
            hasLocalBusiness = true;
            schemaData = {
              name: item.name,
              address: formatAddress(item.address),
              phone: item.telephone,
              hours: item.openingHours,
              geo: item.geo ? { lat: item.geo.latitude, lng: item.geo.longitude } : undefined,
            };
          }

          if (type === 'Organization' || type === 'Corporation' || type === 'Person') {
            hasOrganization = true;
            if (!schemaData) {
              schemaData = {
                name: item.name,
                address: formatAddress(item.address),
                phone: item.telephone,
              };
            }
          }
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return { hasLocalBusiness, hasOrganization, schemaData };
}

/**
 * Format address from schema
 */
function formatAddress(address: unknown): string | undefined {
  if (!address) return undefined;
  if (typeof address === 'string') return address;
  if (typeof address === 'object' && address !== null) {
    const a = address as Record<string, string>;
    return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean).join(', ');
  }
  return undefined;
}

/**
 * Detect phone numbers in page content
 */
export function detectPhones(html: string): string[] {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const phones = new Set<string>();

  // Find tel: links
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      phones.add(href.replace('tel:', '').trim());
    }
  });

  // Find phone patterns in text
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => phones.add(m.trim()));
    }
  }

  // Filter out obviously invalid numbers
  return Array.from(phones).filter((phone) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  });
}

/**
 * Detect addresses in page content
 */
export function detectAddresses(html: string): string[] {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const addresses = new Set<string>();

  // Find address patterns
  for (const pattern of ADDRESS_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => addresses.add(m.trim()));
    }
  }

  // Check for schema addresses
  $('[itemprop="address"]').each((_, el) => {
    const addr = $(el).text().trim();
    if (addr) addresses.add(addr);
  });

  return Array.from(addresses);
}

/**
 * Detect linked social profiles
 */
function detectSocialProfiles(html: string): string[] {
  const $ = cheerio.load(html);
  const profiles: string[] = [];

  const socialDomains = [
    'facebook.com',
    'twitter.com',
    'x.com',
    'linkedin.com',
    'instagram.com',
    'youtube.com',
    'tiktok.com',
    'pinterest.com',
    'github.com',
  ];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    for (const domain of socialDomains) {
      if (href.includes(domain)) {
        // Normalize the URL
        try {
          const url = new URL(href);
          if (!profiles.includes(url.href)) {
            profiles.push(url.href);
          }
        } catch {
          // Invalid URL, skip
        }
        break;
      }
    }
  });

  return profiles;
}

/**
 * Analyze local SEO elements
 */
export function analyzeLocalSEO(html: string, url: string): { issues: AuditIssue[]; data: LocalSEOData } {
  const issues: AuditIssue[] = [];

  // Extract schema
  const { hasLocalBusiness, hasOrganization, schemaData } = extractSchema(html);

  // Detect phones and addresses
  const detectedPhones = detectPhones(html);
  const detectedAddresses = detectAddresses(html);

  // Detect social profiles
  const socialProfiles = detectSocialProfiles(html);

  // Generate issues. LocalBusiness schema is for a business with a place: only a page that
  // shows a phone number or a street address is missing it (it used to fire on every site).
  if (!hasLocalBusiness && (detectedPhones.length > 0 || detectedAddresses.length > 0)) {
    issues.push({
      ...ISSUE_DEFINITIONS.LOCAL_BUSINESS_SCHEMA_MISSING,
      affectedUrls: [url],
    });
  }

  if (!hasOrganization && !hasLocalBusiness) {
    issues.push({
      ...ISSUE_DEFINITIONS.ORGANIZATION_SCHEMA_MISSING,
      affectedUrls: [url],
    });
  }

  // Only flag missing address/phone for pages that appear to be business pages
  const $ = cheerio.load(html);
  const isBusinessPage =
    $('a[href^="tel:"]').length > 0 ||
    $('a[href^="mailto:"]').length > 0 ||
    html.toLowerCase().includes('contact') ||
    html.toLowerCase().includes('about us');

  if (isBusinessPage) {
    if (detectedAddresses.length === 0 && !schemaData?.address) {
      issues.push({
        ...ISSUE_DEFINITIONS.ADDRESS_NOT_DETECTED,
        affectedUrls: [url],
      });
    }

    if (detectedPhones.length === 0 && !schemaData?.phone) {
      issues.push({
        ...ISSUE_DEFINITIONS.PHONE_NOT_DETECTED,
        affectedUrls: [url],
      });
    }
  }

  // Check for social profiles
  if (socialProfiles.length === 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.SOCIAL_PROFILES_NOT_LINKED,
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      hasLocalBusinessSchema: hasLocalBusiness,
      hasOrganizationSchema: hasOrganization,
      detectedPhones,
      detectedAddresses,
      schemaData,
      socialProfiles,
    },
  };
}
