// SERP Client - Check keyword rankings via API or scraping

import type { RankCheckOptions, RankCheckResult, SerpFeature, CompetitorUrl } from './types.js';

export interface SerpClientConfig {
  provider: 'valueserp' | 'serpapi' | 'direct';
  apiKey?: string;
  proxyUrl?: string;
}

export class SerpClient {
  private config: SerpClientConfig;

  constructor(config: SerpClientConfig) {
    this.config = config;
  }

  /**
   * Check ranking for a single keyword
   */
  async checkRank(options: RankCheckOptions): Promise<RankCheckResult[]> {
    const results: RankCheckResult[] = [];

    for (const keyword of options.keywords) {
      try {
        const result = await this.checkSingleKeyword({
          ...options,
          keyword,
        });
        results.push(result);
      } catch (error) {
        // Log error but continue with other keywords
        console.error(`Error checking rank for "${keyword}":`, error);
        results.push({
          keyword,
          position: null,
          url: null,
          serpFeatures: [],
          topResults: [],
          checkedAt: new Date(),
        });
      }
    }

    return results;
  }

  private async checkSingleKeyword(options: RankCheckOptions & { keyword: string }): Promise<RankCheckResult> {
    switch (this.config.provider) {
      case 'valueserp':
        return this.checkViaValueSerp(options);
      case 'serpapi':
        return this.checkViaSerpApi(options);
      case 'direct':
      default:
        return this.checkViaDirect(options);
    }
  }

  /**
   * ValueSERP API implementation
   * Docs: https://www.valueserp.com/docs
   */
  private async checkViaValueSerp(options: RankCheckOptions & { keyword: string }): Promise<RankCheckResult> {
    if (!this.config.apiKey) {
      throw new Error('ValueSERP API key required');
    }

    const params = new URLSearchParams({
      api_key: this.config.apiKey,
      q: options.keyword,
      location: options.country || 'United States',
      google_domain: options.country === 'US' ? 'google.com' : `google.${options.country?.toLowerCase() || 'com'}`,
      gl: options.country || 'us',
      hl: options.language || 'en',
      device: options.device || 'desktop',
      num: '100', // Get top 100 results
    });

    const response = await fetch(`https://api.valueserp.com/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`ValueSERP API error: ${response.status}`);
    }

    const data = await response.json() as ValueSerpResponse;
    
    return this.parseValueSerpResponse(data, options.domain, options.keyword);
  }

  /**
   * SerpAPI implementation (alternative)
   * Docs: https://serpapi.com/search-api
   */
  private async checkViaSerpApi(options: RankCheckOptions & { keyword: string }): Promise<RankCheckResult> {
    if (!this.config.apiKey) {
      throw new Error('SerpAPI key required');
    }

    const params = new URLSearchParams({
      api_key: this.config.apiKey,
      q: options.keyword,
      location: options.country === 'US' ? 'United States' : options.country || 'United States',
      gl: options.country?.toLowerCase() || 'us',
      hl: options.language || 'en',
      device: options.device || 'desktop',
      num: '100',
    });

    const response = await fetch(`https://serpapi.com/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const data = await response.json() as SerpApiResponse;
    
    return this.parseSerpApiResponse(data, options.domain, options.keyword);
  }

  /**
   * Direct scraping fallback (rate-limited, use with caution)
   */
  private async checkViaDirect(options: RankCheckOptions & { keyword: string }): Promise<RankCheckResult> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(options.keyword)}&num=100`;
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': options.language || 'en-US,en;q=0.9',
    };

    const response = await fetch(searchUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`Direct search failed: ${response.status}`);
    }

    const html = await response.text();
    return this.parseDirectSearchResults(html, options.domain, options.keyword);
  }

  private parseValueSerpResponse(data: ValueSerpResponse, domain: string, keyword: string): RankCheckResult {
    const topResults: CompetitorUrl[] = [];
    const serpFeatures: SerpFeature[] = [];
    let position: number | null = null;
    let url: string | null = null;

    // Parse organic results
    if (data.organic_results) {
      for (let i = 0; i < data.organic_results.length; i++) {
        const result = data.organic_results[i];
        const resultDomain = this.extractDomain(result.link);
        
        topResults.push({
          position: i + 1,
          url: result.link,
          domain: resultDomain,
          title: result.title,
        });

        // Check if this is our domain
        if (this.domainMatches(resultDomain, domain) && position === null) {
          position = i + 1;
          url = result.link;
        }
      }
    }

    // Parse SERP features
    if (data.answer_box) {
      serpFeatures.push({
        type: 'featured_snippet',
        position: 0,
        hasOwnSite: this.domainMatches(this.extractDomain(data.answer_box.link || ''), domain),
      });
    }

    if (data.people_also_ask) {
      serpFeatures.push({
        type: 'people_also_ask',
        hasOwnSite: data.people_also_ask.some(
          (paa: { link?: string }) => this.domainMatches(this.extractDomain(paa.link || ''), domain)
        ),
      });
    }

    if (data.local_results) {
      serpFeatures.push({ type: 'local_pack' });
    }

    if (data.knowledge_graph) {
      serpFeatures.push({ type: 'knowledge_panel' });
    }

    return {
      keyword,
      position,
      url,
      serpFeatures,
      topResults: topResults.slice(0, 10),
      checkedAt: new Date(),
    };
  }

  private parseSerpApiResponse(data: SerpApiResponse, domain: string, keyword: string): RankCheckResult {
    const topResults: CompetitorUrl[] = [];
    const serpFeatures: SerpFeature[] = [];
    let position: number | null = null;
    let url: string | null = null;

    // Parse organic results
    if (data.organic_results) {
      for (let i = 0; i < data.organic_results.length; i++) {
        const result = data.organic_results[i];
        const resultDomain = this.extractDomain(result.link);
        
        topResults.push({
          position: result.position || i + 1,
          url: result.link,
          domain: resultDomain,
          title: result.title,
        });

        if (this.domainMatches(resultDomain, domain) && position === null) {
          position = result.position || i + 1;
          url = result.link;
        }
      }
    }

    // Parse SERP features
    if (data.answer_box) {
      serpFeatures.push({
        type: 'featured_snippet',
        position: 0,
      });
    }

    if (data.related_questions) {
      serpFeatures.push({ type: 'people_also_ask' });
    }

    return {
      keyword,
      position,
      url,
      serpFeatures,
      topResults: topResults.slice(0, 10),
      checkedAt: new Date(),
    };
  }

  private parseDirectSearchResults(html: string, domain: string, keyword: string): RankCheckResult {
    const topResults: CompetitorUrl[] = [];
    let position: number | null = null;
    let url: string | null = null;

    // Simple regex-based parsing (not perfect but works for basic cases)
    const linkRegex = /<a[^>]+href="\/url\?q=([^"&]+)/g;
    let match;
    let index = 0;

    while ((match = linkRegex.exec(html)) !== null && index < 100) {
      try {
        const decodedUrl = decodeURIComponent(match[1]);
        const resultDomain = this.extractDomain(decodedUrl);
        
        // Skip Google's own URLs
        if (resultDomain.includes('google.com') || resultDomain.includes('gstatic.com')) {
          continue;
        }

        index++;
        topResults.push({
          position: index,
          url: decodedUrl,
          domain: resultDomain,
        });

        if (this.domainMatches(resultDomain, domain) && position === null) {
          position = index;
          url = decodedUrl;
        }
      } catch {
        // Skip malformed URLs
      }
    }

    return {
      keyword,
      position,
      url,
      serpFeatures: [], // Direct scraping doesn't easily extract SERP features
      topResults: topResults.slice(0, 10),
      checkedAt: new Date(),
    };
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  private domainMatches(resultDomain: string, targetDomain: string): boolean {
    const normalizedResult = resultDomain.toLowerCase().replace(/^www\./, '');
    const normalizedTarget = targetDomain.toLowerCase().replace(/^www\./, '');
    
    // Exact match or subdomain match
    return normalizedResult === normalizedTarget || 
           normalizedResult.endsWith(`.${normalizedTarget}`);
  }
}

// ValueSERP response types
interface ValueSerpResponse {
  organic_results?: Array<{
    link: string;
    title: string;
    snippet?: string;
  }>;
  answer_box?: {
    link?: string;
    title?: string;
  };
  people_also_ask?: Array<{
    question: string;
    link?: string;
  }>;
  local_results?: Array<unknown>;
  knowledge_graph?: unknown;
}

// SerpAPI response types
interface SerpApiResponse {
  organic_results?: Array<{
    position: number;
    link: string;
    title: string;
    snippet?: string;
  }>;
  answer_box?: unknown;
  related_questions?: Array<unknown>;
}
