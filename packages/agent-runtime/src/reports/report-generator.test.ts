import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateHTMLReport,
  generatePDFReport,
  ReportConfig,
  ReportBranding,
  AuditReportData,
} from './report-generator.js';

describe('report-generator', () => {
  const mockAuditData: AuditReportData = {
    url: 'https://example.com',
    domain: 'example.com',
    timestamp: '2024-01-15T10:00:00Z',
    score: 72,
    healthScores: {
      overall: 72,
      crawlability: 80,
      indexability: 75,
      onPage: 65,
      content: 70,
      links: 75,
      performance: 70,
      security: 85,
      aiReadiness: 70,
      social: 65,
      localSeo: 60,
    },
    summary: {
      errors: 3,
      warnings: 8,
      notices: 5,
      passed: 84,
    },
    issues: [
      { code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', affectedUrls: ['https://example.com/about'] },
      { code: 'META_DESC_MISSING', severity: 'error', category: 'on-page', title: 'Missing meta description', affectedUrls: ['https://example.com/about'] },
      { code: 'OG_IMAGE_MISSING', severity: 'warning', category: 'social', title: 'Missing OG image', affectedUrls: ['https://example.com'] },
    ],
    pages: [
      { url: 'https://example.com', score: 75, issues: 2 },
      { url: 'https://example.com/about', score: 60, issues: 4 },
    ],
  };

  describe('generateHTMLReport', () => {
    it('generates valid HTML document', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('includes audit score prominently', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('72');
      expect(html).toContain('/100');
    });

    it('includes domain and timestamp', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('example.com');
      expect(html).toContain('2024');
    });

    it('includes summary statistics', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('3'); // errors
      expect(html).toContain('8'); // warnings
      expect(html).toContain('84'); // passed
    });

    it('includes category scores', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('Crawlability');
      expect(html).toContain('80');
      expect(html).toContain('On-Page');
      expect(html).toContain('65');
    });

    it('lists issues with severity badges', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('TITLE_MISSING');
      expect(html).toContain('Missing title');
      expect(html).toContain('error');
    });

    it('includes page-level details', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('example.com/about');
      expect(html).toContain('60');
    });

    it('applies default branding when none provided', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('RankCLI');
    });

    it('applies custom branding when provided', () => {
      const branding: ReportBranding = {
        companyName: 'ACME Agency',
        logoUrl: 'https://acme.com/logo.png',
        primaryColor: '#FF5733',
        accentColor: '#33FF57',
      };

      const html = generateHTMLReport(mockAuditData, { branding });

      expect(html).toContain('ACME Agency');
      expect(html).toContain('https://acme.com/logo.png');
      expect(html).toContain('#FF5733');
    });

    it('removes RankCLI branding in white-label mode', () => {
      const branding: ReportBranding = {
        companyName: 'ACME Agency',
        whiteLabel: true,
      };

      const html = generateHTMLReport(mockAuditData, { branding });

      expect(html).not.toContain('RankCLI');
      expect(html).toContain('ACME Agency');
    });

    it('includes CSS styling inline', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });

    it('generates responsive layout', () => {
      const html = generateHTMLReport(mockAuditData);

      expect(html).toContain('viewport');
      expect(html).toContain('@media');
    });
  });

  describe('generatePDFReport', () => {
    it('returns a Buffer', async () => {
      const pdf = await generatePDFReport(mockAuditData);

      expect(pdf).toBeInstanceOf(Buffer);
    });

    it('generates non-empty PDF', async () => {
      const pdf = await generatePDFReport(mockAuditData);

      expect(pdf.length).toBeGreaterThan(0);
    });

    it('applies custom branding', async () => {
      const branding: ReportBranding = {
        companyName: 'ACME Agency',
        whiteLabel: true,
      };

      // PDF generation should not throw with custom branding
      const pdf = await generatePDFReport(mockAuditData, { branding });
      expect(pdf).toBeInstanceOf(Buffer);
    });
  });

  describe('ReportConfig options', () => {
    it('includes executive summary when enabled', () => {
      const config: ReportConfig = {
        includeExecutiveSummary: true,
      };

      const html = generateHTMLReport(mockAuditData, config);

      expect(html).toContain('Executive Summary');
    });

    it('excludes page details when disabled', () => {
      const config: ReportConfig = {
        includePageDetails: false,
      };

      const html = generateHTMLReport(mockAuditData, config);

      expect(html).not.toContain('Page Details');
      // The issues section may still contain URLs, but the page details table should be excluded
      expect(html).not.toContain('<table class="pages-table">');
    });

    it('includes recommendations when enabled', () => {
      const config: ReportConfig = {
        includeRecommendations: true,
      };

      const html = generateHTMLReport(mockAuditData, config);

      expect(html).toContain('Recommendations');
      expect(html).toContain('How to Fix');
    });

    it('limits issues shown when maxIssues set', () => {
      const dataWithManyIssues: AuditReportData = {
        ...mockAuditData,
        issues: Array.from({ length: 20 }, (_, i) => ({
          code: `ISSUE_${i}`,
          severity: 'warning' as const,
          category: 'on-page',
          title: `Issue ${i}`,
          affectedUrls: [],
        })),
      };

      const config: ReportConfig = {
        maxIssues: 5,
      };

      const html = generateHTMLReport(dataWithManyIssues, config);

      // Should show "and X more" indicator
      expect(html).toContain('more');
    });
  });

  describe('score visualization', () => {
    it('shows green score badge for high scores', () => {
      const highScoreData = { ...mockAuditData, score: 90 };
      const html = generateHTMLReport(highScoreData);

      expect(html).toMatch(/green|success|good/i);
    });

    it('shows yellow score badge for medium scores', () => {
      const mediumScoreData = { ...mockAuditData, score: 60 };
      const html = generateHTMLReport(mediumScoreData);

      expect(html).toMatch(/yellow|warning|orange/i);
    });

    it('shows red score badge for low scores', () => {
      const lowScoreData = { ...mockAuditData, score: 30 };
      const html = generateHTMLReport(lowScoreData);

      expect(html).toMatch(/red|error|danger/i);
    });
  });

  describe('integration scenarios', () => {
    it('generates complete agency report', () => {
      const config: ReportConfig = {
        branding: {
          companyName: 'Digital Marketing Pro',
          logoUrl: 'https://dmp.com/logo.svg',
          primaryColor: '#1a73e8',
          accentColor: '#34a853',
          whiteLabel: true,
          contactEmail: 'reports@dmp.com',
          websiteUrl: 'https://dmp.com',
        },
        includeExecutiveSummary: true,
        includeRecommendations: true,
        includePageDetails: true,
      };

      const html = generateHTMLReport(mockAuditData, config);

      expect(html).toContain('Digital Marketing Pro');
      expect(html).toContain('Executive Summary');
      expect(html).toContain('Recommendations');
      expect(html).not.toContain('RankCLI');
    });

    it('generates minimal free report', () => {
      const config: ReportConfig = {
        includeExecutiveSummary: false,
        includeRecommendations: false,
        includePageDetails: false,
        maxIssues: 5,
      };

      const html = generateHTMLReport(mockAuditData, config);

      expect(html).toContain('RankCLI');
      expect(html).not.toContain('Executive Summary');
    });
  });
});
