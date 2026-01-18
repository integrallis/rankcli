import { describe, it, expect } from 'vitest';
import { analyzeSocialMeta } from './social-meta.js';

describe('analyzeSocialMeta', () => {
  const testUrl = 'https://example.com';

  describe('Open Graph analysis', () => {
    it('detects all Open Graph tags when present', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Test Title" />
            <meta property="og:description" content="Test Description" />
            <meta property="og:image" content="https://example.com/og.png" />
            <meta property="og:url" content="https://example.com" />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Test Site" />
          </head>
        </html>
      `;

      const { data, issues } = analyzeSocialMeta(html, testUrl);

      expect(data.openGraph.title).toBe('Test Title');
      expect(data.openGraph.description).toBe('Test Description');
      expect(data.openGraph.image).toBe('https://example.com/og.png');
      expect(data.openGraph.url).toBe('https://example.com');
      expect(data.openGraph.type).toBe('website');
      expect(data.openGraph.siteName).toBe('Test Site');

      // Should not have OG-related issues
      const ogIssues = issues.filter((i) => i.code.startsWith('OG_'));
      expect(ogIssues).toHaveLength(0);
    });

    it('reports missing og:title', () => {
      const html = `<html><head></head></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'OG_TITLE_MISSING');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('warning');
      expect(issue?.affectedUrls).toContain(testUrl);
    });

    it('reports missing og:description', () => {
      const html = `<html><head></head></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'OG_DESCRIPTION_MISSING');
      expect(issue).toBeDefined();
    });

    it('reports missing og:image', () => {
      const html = `<html><head></head></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'OG_IMAGE_MISSING');
      expect(issue).toBeDefined();
    });

    it('reports missing og:url', () => {
      const html = `<html><head></head></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'OG_URL_MISSING');
      expect(issue).toBeDefined();
    });

    it('reports missing og:type', () => {
      const html = `<html><head></head></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'OG_TYPE_MISSING');
      expect(issue).toBeDefined();
    });
  });

  describe('Twitter Card analysis', () => {
    it('detects all Twitter Card tags when present', () => {
      const html = `
        <html>
          <head>
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="Twitter Title" />
            <meta name="twitter:description" content="Twitter Description" />
            <meta name="twitter:image" content="https://example.com/twitter.png" />
            <meta name="twitter:site" content="@example" />
            <meta name="twitter:creator" content="@author" />
          </head>
        </html>
      `;

      const { data, issues } = analyzeSocialMeta(html, testUrl);

      expect(data.twitter.card).toBe('summary_large_image');
      expect(data.twitter.title).toBe('Twitter Title');
      expect(data.twitter.description).toBe('Twitter Description');
      expect(data.twitter.image).toBe('https://example.com/twitter.png');
      expect(data.twitter.site).toBe('@example');
      expect(data.twitter.creator).toBe('@author');

      // Should not have Twitter-related issues
      const twitterIssues = issues.filter((i) => i.code.startsWith('TWITTER_'));
      expect(twitterIssues).toHaveLength(0);
    });

    it('reports missing twitter:card', () => {
      const html = `<html><head></head></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'TWITTER_CARD_MISSING');
      expect(issue).toBeDefined();
      // Twitter card is a notice since it's less critical than OG tags
      expect(issue?.severity).toBe('notice');
    });

    it('does not report missing twitter:image if og:image exists', () => {
      const html = `
        <html>
          <head>
            <meta property="og:image" content="https://example.com/og.png" />
          </head>
        </html>
      `;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'TWITTER_IMAGE_MISSING');
      expect(issue).toBeUndefined();
    });

    it('reports missing twitter:image if no og:image', () => {
      const html = `<html><head></head></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      const issue = issues.find((i) => i.code === 'TWITTER_IMAGE_MISSING');
      expect(issue).toBeDefined();
    });
  });

  describe('Favicon analysis', () => {
    it('detects standard favicon', () => {
      const html = `
        <html>
          <head>
            <link rel="icon" href="/favicon.ico" />
          </head>
        </html>
      `;

      const { data, issues } = analyzeSocialMeta(html, testUrl);

      expect(data.hasFavicon).toBe(true);
      const issue = issues.find((i) => i.code === 'FAVICON_MISSING');
      expect(issue).toBeUndefined();
    });

    it('detects shortcut icon', () => {
      const html = `
        <html>
          <head>
            <link rel="shortcut icon" href="/favicon.ico" />
          </head>
        </html>
      `;

      const { data } = analyzeSocialMeta(html, testUrl);
      expect(data.hasFavicon).toBe(true);
    });

    it('detects apple-touch-icon', () => {
      const html = `
        <html>
          <head>
            <link rel="apple-touch-icon" href="/apple-icon.png" />
          </head>
        </html>
      `;

      const { data } = analyzeSocialMeta(html, testUrl);
      expect(data.hasFavicon).toBe(true);
    });

    it('reports missing favicon', () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = analyzeSocialMeta(html, testUrl);

      expect(data.hasFavicon).toBe(false);
      const issue = issues.find((i) => i.code === 'FAVICON_MISSING');
      expect(issue).toBeDefined();
    });
  });

  describe('Lang attribute analysis', () => {
    it('detects lang attribute', () => {
      const html = `<html lang="en"><head></head></html>`;

      const { data, issues } = analyzeSocialMeta(html, testUrl);

      expect(data.langAttribute).toBe('en');
      const issue = issues.find((i) => i.code === 'LANG_ATTR_MISSING');
      expect(issue).toBeUndefined();
    });

    it('reports missing lang attribute', () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = analyzeSocialMeta(html, testUrl);

      expect(data.langAttribute).toBeUndefined();
      const issue = issues.find((i) => i.code === 'LANG_ATTR_MISSING');
      expect(issue).toBeDefined();
    });

    it('handles different lang formats', () => {
      const html = `<html lang="en-US"><head></head></html>`;

      const { data } = analyzeSocialMeta(html, testUrl);
      expect(data.langAttribute).toBe('en-US');
    });
  });

  describe('Complete HTML analysis', () => {
    it('analyzes fully compliant HTML', () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta property="og:title" content="Test Page" />
            <meta property="og:description" content="A description" />
            <meta property="og:image" content="https://example.com/og.png" />
            <meta property="og:url" content="https://example.com" />
            <meta property="og:type" content="website" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:image" content="https://example.com/twitter.png" />
            <link rel="icon" href="/favicon.ico" />
          </head>
          <body></body>
        </html>
      `;

      const { issues } = analyzeSocialMeta(html, testUrl);

      // Should have no issues for a fully compliant page
      expect(issues).toHaveLength(0);
    });

    it('analyzes completely non-compliant HTML', () => {
      const html = `<html><head></head><body></body></html>`;

      const { issues } = analyzeSocialMeta(html, testUrl);

      // Should have multiple issues
      expect(issues.length).toBeGreaterThan(5);

      // Check for specific issues
      const issueCodes = issues.map((i) => i.code);
      expect(issueCodes).toContain('OG_TITLE_MISSING');
      expect(issueCodes).toContain('OG_DESCRIPTION_MISSING');
      expect(issueCodes).toContain('OG_IMAGE_MISSING');
      expect(issueCodes).toContain('TWITTER_CARD_MISSING');
      expect(issueCodes).toContain('FAVICON_MISSING');
      expect(issueCodes).toContain('LANG_ATTR_MISSING');
    });
  });
});
