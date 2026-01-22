import { httpGet, httpPost } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface PerformanceData {
  loadTime: number; // ms
  ttfb: number; // ms
  htmlSize: number; // bytes
  compressed: boolean;
  cacheControl?: string;
  contentEncoding?: string;
}

export async function analyzePerformance(url: string): Promise<{ issues: AuditIssue[]; data: PerformanceData }> {
  const issues: AuditIssue[] = [];

  const startTime = Date.now();

  try {
    const response = await httpGet<string>(url, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    const loadTime = Date.now() - startTime;
    // Note: TTFB approximation - fetch doesn't expose this directly
    const ttfbTime = Math.min(loadTime, loadTime * 0.3); // Estimate ~30% of total
    const htmlSize = typeof response.data === 'string' ? response.data.length : 0;
    const contentEncoding = response.headers['content-encoding'];
    const cacheControl = response.headers['cache-control'];
    const compressed = !!contentEncoding && ['gzip', 'deflate', 'br'].some(e => contentEncoding.includes(e));

    const data: PerformanceData = {
      loadTime,
      ttfb: ttfbTime || loadTime,
      htmlSize,
      compressed,
      cacheControl,
      contentEncoding,
    };

    // Check load time
    if (loadTime > 3000) {
      issues.push({
        ...ISSUE_DEFINITIONS.SLOW_PAGE,
        affectedUrls: [url],
        details: { loadTime: `${(loadTime / 1000).toFixed(1)}s` },
      });
    }

    // Check TTFB
    if (ttfbTime > 600) {
      issues.push({
        ...ISSUE_DEFINITIONS.SLOW_TTFB,
        affectedUrls: [url],
        details: { ttfb: `${ttfbTime}ms` },
      });
    }

    // Check HTML size
    if (htmlSize > 100 * 1024) { // > 100KB
      issues.push({
        ...ISSUE_DEFINITIONS.HTML_TOO_LARGE,
        affectedUrls: [url],
        details: { size: `${(htmlSize / 1024).toFixed(0)}KB` },
      });
    }

    // Check compression
    if (!compressed && htmlSize > 1024) {
      issues.push({
        ...ISSUE_DEFINITIONS.UNCOMPRESSED,
        affectedUrls: [url],
        details: { htmlSize: `${(htmlSize / 1024).toFixed(0)}KB` },
      });
    }

    // Check cache headers
    if (!cacheControl) {
      issues.push({
        ...ISSUE_DEFINITIONS.NO_CACHE,
        affectedUrls: [url],
      });
    }

    return { issues, data };
  } catch (error) {
    return {
      issues: [{
        ...ISSUE_DEFINITIONS.SLOW_PAGE,
        affectedUrls: [url],
        details: { error: error instanceof Error ? error.message : 'Request failed' },
      }],
      data: {
        loadTime: 0,
        ttfb: 0,
        htmlSize: 0,
        compressed: false,
      }
    };
  }
}

// Fetch Core Web Vitals from CrUX API (requires API key)
export async function fetchCoreWebVitals(url: string, apiKey?: string): Promise<{
  lcp?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  fid?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  cls?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  inp?: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
} | null> {
  if (!apiKey) return null;

  try {
    const response = await httpPost<{ record?: { metrics?: Record<string, { percentiles?: { p75?: number } }> } }>(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`,
      { url },
      { timeout: 10000 }
    );

    const metrics = response.data?.record?.metrics;
    if (!metrics) return null;

    const getRating = (value: number, thresholds: [number, number]): 'good' | 'needs-improvement' | 'poor' => {
      if (value <= thresholds[0]) return 'good';
      if (value <= thresholds[1]) return 'needs-improvement';
      return 'poor';
    };

    return {
      lcp: metrics.largest_contentful_paint?.percentiles?.p75 ? {
        value: metrics.largest_contentful_paint.percentiles.p75,
        rating: getRating(metrics.largest_contentful_paint.percentiles.p75, [2500, 4000]),
      } : undefined,
      fid: metrics.first_input_delay?.percentiles?.p75 ? {
        value: metrics.first_input_delay.percentiles.p75,
        rating: getRating(metrics.first_input_delay.percentiles.p75, [100, 300]),
      } : undefined,
      cls: metrics.cumulative_layout_shift?.percentiles?.p75 ? {
        value: metrics.cumulative_layout_shift.percentiles.p75,
        rating: getRating(metrics.cumulative_layout_shift.percentiles.p75, [0.1, 0.25]),
      } : undefined,
      inp: metrics.interaction_to_next_paint?.percentiles?.p75 ? {
        value: metrics.interaction_to_next_paint.percentiles.p75,
        rating: getRating(metrics.interaction_to_next_paint.percentiles.p75, [200, 500]),
      } : undefined,
    };
  } catch {
    return null;
  }
}
