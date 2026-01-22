// Additional SEO Checks
// AMP detection, ads.txt, DMARC, email privacy, and more

import { httpGet } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

/**
 * Isomorphic DNS TXT record lookup using DNS-over-HTTPS (Cloudflare)
 * Works in both Node.js and Deno/browser environments
 */
async function resolveTxtDoH(domain: string): Promise<string[][]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/dns-json'
    }
  });

  if (!response.ok) {
    throw new Error(`DNS lookup failed: ${response.status}`);
  }

  const data = await response.json() as { Answer?: Array<{ data: string }> };

  if (!data.Answer || data.Answer.length === 0) {
    return [];
  }

  // Parse TXT records - they come with quotes that need to be removed
  return data.Answer.map(record => {
    const txt = record.data.replace(/^"|"$/g, '');
    return [txt];
  });
}

export interface AdsTxtData {
  exists: boolean;
  valid: boolean;
  entries: number;
  errors: string[];
}

export interface DMARCData {
  exists: boolean;
  policy: string | null;
  record: string | null;
}

export interface SPFData {
  exists: boolean;
  record: string | null;
}

export interface AMPData {
  hasAmpLink: boolean;
  ampUrl: string | null;
  ampValid: boolean | null;
}

export interface AdditionalChecksData {
  adsTxt: AdsTxtData;
  dmarc: DMARCData;
  spf: SPFData;
  amp: AMPData;
  plaintextEmails: string[];
  hasAppleTouchIcon: boolean;
  faviconFormat: string | null;
}

/**
 * Check for ads.txt file
 */
export async function checkAdsTxt(baseUrl: string): Promise<{ issues: AuditIssue[]; data: AdsTxtData }> {
  const issues: AuditIssue[] = [];
  const url = new URL('/ads.txt', baseUrl).href;

  try {
    const response = await httpGet<string>(url, {
      
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 404 || response.status >= 400) {
      // Not an error for most sites - only relevant for publishers
      return {
        issues,
        data: { exists: false, valid: false, entries: 0, errors: [] },
      };
    }

    const content = response.data as string;
    const lines = content.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#'));

    // Basic validation
    const errors: string[] = [];
    let validEntries = 0;

    for (const line of lines) {
      // ads.txt format: domain, publisher-account-id, account-type, certification-authority-id
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 3) {
        validEntries++;
      } else if (line.trim()) {
        errors.push(`Invalid line format: ${line.substring(0, 50)}`);
      }
    }

    const valid = errors.length === 0 && validEntries > 0;

    if (!valid && validEntries > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.ADS_TXT_INVALID,
        affectedUrls: [url],
        details: { errors, validEntries },
      });
    }

    return {
      issues,
      data: { exists: true, valid, entries: validEntries, errors },
    };
  } catch {
    return {
      issues,
      data: { exists: false, valid: false, entries: 0, errors: ['Failed to fetch'] },
    };
  }
}

/**
 * Check DMARC DNS record
 */
export async function checkDMARC(domain: string): Promise<{ issues: AuditIssue[]; data: DMARCData }> {
  const issues: AuditIssue[] = [];

  try {
    // Extract domain from URL if needed
    let cleanDomain = domain;
    try {
      cleanDomain = new URL(domain).hostname;
    } catch {
      // Already a domain
    }

    // Remove www prefix
    cleanDomain = cleanDomain.replace(/^www\./, '');

    // Query DMARC record using DNS-over-HTTPS
    const dmarcDomain = `_dmarc.${cleanDomain}`;
    const records = await resolveTxtDoH(dmarcDomain);

    // Find DMARC record
    const dmarcRecord = records.flat().find((r) => r.startsWith('v=DMARC1'));

    if (dmarcRecord) {
      // Parse policy
      const policyMatch = dmarcRecord.match(/p=(\w+)/);
      const policy = policyMatch ? policyMatch[1] : null;

      return {
        issues,
        data: { exists: true, policy, record: dmarcRecord },
      };
    } else {
      issues.push({
        ...ISSUE_DEFINITIONS.DMARC_MISSING,
        affectedUrls: [domain],
      });
      return {
        issues,
        data: { exists: false, policy: null, record: null },
      };
    }
  } catch {
    issues.push({
      ...ISSUE_DEFINITIONS.DMARC_MISSING,
      affectedUrls: [domain],
    });
    return {
      issues,
      data: { exists: false, policy: null, record: null },
    };
  }
}

/**
 * Check SPF DNS record
 */
export async function checkSPF(domain: string): Promise<{ issues: AuditIssue[]; data: SPFData }> {
  const issues: AuditIssue[] = [];

  try {
    let cleanDomain = domain;
    try {
      cleanDomain = new URL(domain).hostname;
    } catch {
      // Already a domain
    }
    cleanDomain = cleanDomain.replace(/^www\./, '');

    const records = await resolveTxtDoH(cleanDomain);
    const spfRecord = records.flat().find((r) => r.startsWith('v=spf1'));

    if (spfRecord) {
      return {
        issues,
        data: { exists: true, record: spfRecord },
      };
    } else {
      issues.push({
        ...ISSUE_DEFINITIONS.SPF_MISSING,
        affectedUrls: [domain],
      });
      return {
        issues,
        data: { exists: false, record: null },
      };
    }
  } catch {
    // DNS lookup failed - could be many reasons
    return {
      issues,
      data: { exists: false, record: null },
    };
  }
}

/**
 * Check for AMP version
 */
export function checkAMP(html: string, url: string): { issues: AuditIssue[]; data: AMPData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Check for amphtml link
  const ampLink = $('link[rel="amphtml"]').attr('href');

  if (ampLink) {
    return {
      issues,
      data: {
        hasAmpLink: true,
        ampUrl: ampLink,
        ampValid: null, // Would need to validate the AMP page
      },
    };
  }

  // Check if current page is AMP
  const isAmpPage = $('html[amp]').length > 0 || $('html[⚡]').length > 0;

  if (isAmpPage) {
    return {
      issues,
      data: {
        hasAmpLink: false,
        ampUrl: url,
        ampValid: null,
      },
    };
  }

  // Only flag AMP missing for content-heavy pages (articles, news)
  const isArticle =
    $('article').length > 0 ||
    $('meta[property="og:type"][content="article"]').length > 0 ||
    html.toLowerCase().includes('blog') ||
    html.toLowerCase().includes('news');

  if (isArticle) {
    issues.push({
      ...ISSUE_DEFINITIONS.AMP_MISSING,
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      hasAmpLink: false,
      ampUrl: null,
      ampValid: null,
    },
  };
}

/**
 * Check for plaintext email addresses
 */
export function checkPlaintextEmails(html: string, url: string): { issues: AuditIssue[]; emails: string[] } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Remove script and style content
  $('script, style').remove();
  const text = $('body').text();

  // Email regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];

  // Filter out common false positives
  const filteredEmails = emails.filter((email) => {
    const lowerEmail = email.toLowerCase();
    return (
      !lowerEmail.includes('example.com') &&
      !lowerEmail.includes('yoursite.com') &&
      !lowerEmail.includes('yourdomain') &&
      !lowerEmail.endsWith('.png') &&
      !lowerEmail.endsWith('.jpg')
    );
  });

  // Deduplicate
  const uniqueEmails = [...new Set(filteredEmails)];

  if (uniqueEmails.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.PLAINTEXT_EMAIL,
      affectedUrls: [url],
      details: {
        emails: uniqueEmails,
        count: uniqueEmails.length,
      },
    });
  }

  return { issues, emails: uniqueEmails };
}

/**
 * Check for Apple Touch Icon
 */
export function checkAppleTouchIcon(html: string, url: string): { issues: AuditIssue[]; exists: boolean } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  const hasAppleTouchIcon =
    $('link[rel="apple-touch-icon"]').length > 0 || $('link[rel="apple-touch-icon-precomposed"]').length > 0;

  if (!hasAppleTouchIcon) {
    issues.push({
      ...ISSUE_DEFINITIONS.APPLE_TOUCH_ICON_MISSING,
      affectedUrls: [url],
    });
  }

  return { issues, exists: hasAppleTouchIcon };
}

/**
 * Check favicon format
 */
export function checkFaviconFormat(html: string, url: string): { issues: AuditIssue[]; format: string | null } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Check for favicon links
  const faviconLink =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    null;

  if (!faviconLink) {
    return { issues, format: null };
  }

  // Determine format
  let format: string | null = null;
  const lowerHref = faviconLink.toLowerCase();

  if (lowerHref.endsWith('.ico')) {
    format = 'ico';
  } else if (lowerHref.endsWith('.png')) {
    format = 'png';
  } else if (lowerHref.endsWith('.svg')) {
    format = 'svg';
  } else if (lowerHref.includes('data:image/')) {
    format = 'inline';
  } else {
    format = 'unknown';
  }

  // Note: Not having .ico is just a notice, not a critical issue
  // Modern browsers support PNG/SVG favicons well

  return { issues, format };
}

/**
 * Run all additional checks
 */
export async function runAdditionalChecks(
  url: string,
  html: string
): Promise<{ issues: AuditIssue[]; data: AdditionalChecksData }> {
  const allIssues: AuditIssue[] = [];

  // Run parallel checks
  const [adsTxtResult, dmarcResult, spfResult] = await Promise.all([
    checkAdsTxt(url),
    checkDMARC(url),
    checkSPF(url),
  ]);

  allIssues.push(...adsTxtResult.issues);
  allIssues.push(...dmarcResult.issues);
  allIssues.push(...spfResult.issues);

  // Run HTML-based checks
  const ampResult = checkAMP(html, url);
  allIssues.push(...ampResult.issues);

  const emailResult = checkPlaintextEmails(html, url);
  allIssues.push(...emailResult.issues);

  const touchIconResult = checkAppleTouchIcon(html, url);
  allIssues.push(...touchIconResult.issues);

  const faviconResult = checkFaviconFormat(html, url);
  allIssues.push(...faviconResult.issues);

  return {
    issues: allIssues,
    data: {
      adsTxt: adsTxtResult.data,
      dmarc: dmarcResult.data,
      spf: spfResult.data,
      amp: ampResult.data,
      plaintextEmails: emailResult.emails,
      hasAppleTouchIcon: touchIconResult.exists,
      faviconFormat: faviconResult.format,
    },
  };
}
