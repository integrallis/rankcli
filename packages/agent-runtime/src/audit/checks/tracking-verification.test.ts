import { describe, it, expect } from 'vitest';
import { analyzeTrackingVerification } from './tracking-verification.js';

describe('analyzeTrackingVerification', () => {
  const testUrl = 'https://example.com';

  describe('Google Analytics 4 detection', () => {
    it('detects GA4 gtag.js tracking code', () => {
      const html = `
        <html>
          <head>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script>
            <script>
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ABC123XYZ');
            </script>
          </head>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(true);
      expect(data.ga4.measurementId).toBe('G-ABC123XYZ');

      const ga4Issue = issues.find((i) => i.code === 'GA4_MISSING');
      expect(ga4Issue).toBeUndefined();
    });

    it('detects GA4 from script src only', () => {
      const html = `
        <html>
          <head>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-TESTID123"></script>
          </head>
        </html>
      `;

      const { data } = analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(true);
      expect(data.ga4.measurementId).toBe('G-TESTID123');
    });

    it('reports missing GA4 when not present', () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(false);
      expect(data.ga4.measurementId).toBeUndefined();

      const ga4Issue = issues.find((i) => i.code === 'GA4_MISSING');
      expect(ga4Issue).toBeDefined();
      expect(ga4Issue?.severity).toBe('warning');
      expect(ga4Issue?.affectedUrls).toContain(testUrl);
    });

    it('does not report missing GA4 if GTM is present', () => {
      const html = `
        <html>
          <head>
            <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123';f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-ABC123');</script>
          </head>
        </html>
      `;

      const { issues } = analyzeTrackingVerification(html, testUrl);

      const ga4Issue = issues.find((i) => i.code === 'GA4_MISSING');
      expect(ga4Issue).toBeUndefined();
    });
  });

  describe('Google Tag Manager detection', () => {
    it('detects GTM with noscript fallback', () => {
      const html = `
        <html>
          <head>
            <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id=GTM-TESTID';f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-TESTID');</script>
          </head>
          <body>
            <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TESTID"
            height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
          </body>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.gtm.detected).toBe(true);
      expect(data.gtm.containerId).toBe('GTM-TESTID');
      expect(data.gtm.hasNoscript).toBe(true);

      const gtmIssue = issues.find((i) => i.code === 'GTM_MISSING');
      expect(gtmIssue).toBeUndefined();

      const noscriptIssue = issues.find((i) => i.code === 'GTM_NOSCRIPT_MISSING');
      expect(noscriptIssue).toBeUndefined();
    });

    it('reports missing noscript when GTM present without it', () => {
      const html = `
        <html>
          <head>
            <script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
          </head>
          <body></body>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.gtm.detected).toBe(true);
      expect(data.gtm.hasNoscript).toBe(false);

      const noscriptIssue = issues.find((i) => i.code === 'GTM_NOSCRIPT_MISSING');
      expect(noscriptIssue).toBeDefined();
      expect(noscriptIssue?.severity).toBe('notice');
    });

    it('reports missing GTM as informational', () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.gtm.detected).toBe(false);

      const gtmIssue = issues.find((i) => i.code === 'GTM_MISSING');
      expect(gtmIssue).toBeDefined();
      expect(gtmIssue?.severity).toBe('notice');
    });
  });

  describe('Google Search Console verification', () => {
    it('detects GSC verification meta tag', () => {
      const html = `
        <html>
          <head>
            <meta name="google-site-verification" content="abc123xyz789verificationcode" />
          </head>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.gsc.verified).toBe(true);
      expect(data.gsc.verificationCode).toBe('abc123xyz789verificationcode');

      const gscIssue = issues.find((i) => i.code === 'GSC_VERIFICATION_MISSING');
      expect(gscIssue).toBeUndefined();
    });

    it('reports missing GSC verification', () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.gsc.verified).toBe(false);

      const gscIssue = issues.find((i) => i.code === 'GSC_VERIFICATION_MISSING');
      expect(gscIssue).toBeDefined();
      expect(gscIssue?.severity).toBe('warning');
    });

    it('rejects short verification codes as invalid', () => {
      const html = `
        <html>
          <head>
            <meta name="google-site-verification" content="short" />
          </head>
        </html>
      `;

      const { data } = analyzeTrackingVerification(html, testUrl);

      expect(data.gsc.verified).toBe(false);
    });
  });

  describe('Bing Webmaster Tools verification', () => {
    it('detects Bing verification meta tag', () => {
      const html = `
        <html>
          <head>
            <meta name="msvalidate.01" content="BING12345678901234567890" />
          </head>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.bing.verified).toBe(true);
      expect(data.bing.verificationCode).toBe('BING12345678901234567890');

      const bingIssue = issues.find((i) => i.code === 'BING_VERIFICATION_MISSING');
      expect(bingIssue).toBeUndefined();
    });

    it('reports missing Bing verification as notice', () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.bing.verified).toBe(false);

      const bingIssue = issues.find((i) => i.code === 'BING_VERIFICATION_MISSING');
      expect(bingIssue).toBeDefined();
      expect(bingIssue?.severity).toBe('notice');
    });
  });

  describe('Schema.org structured data detection', () => {
    it('detects JSON-LD structured data', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Test Company",
                "url": "https://example.com"
              }
            </script>
          </head>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(true);
      expect(data.schemaOrg.types).toContain('Organization');
      expect(data.schemaOrg.hasValidJson).toBe(true);

      const schemaIssue = issues.find((i) => i.code === 'SCHEMA_ORG_MISSING');
      expect(schemaIssue).toBeUndefined();
    });

    it('detects microdata structured data', () => {
      const html = `
        <html>
          <body>
            <div itemscope itemtype="https://schema.org/Product">
              <span itemprop="name">Test Product</span>
            </div>
          </body>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(true);

      const schemaIssue = issues.find((i) => i.code === 'SCHEMA_ORG_MISSING');
      expect(schemaIssue).toBeUndefined();
    });

    it('reports missing structured data', () => {
      const html = `<html><head></head><body></body></html>`;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(false);

      const schemaIssue = issues.find((i) => i.code === 'SCHEMA_ORG_MISSING');
      expect(schemaIssue).toBeDefined();
      expect(schemaIssue?.severity).toBe('warning');
    });

    it('reports invalid JSON-LD', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              { invalid json here }
            </script>
          </head>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(true);
      expect(data.schemaOrg.hasValidJson).toBe(false);

      const invalidIssue = issues.find((i) => i.code === 'SCHEMA_ORG_INVALID');
      expect(invalidIssue).toBeDefined();
      expect(invalidIssue?.severity).toBe('error');
    });

    it('extracts multiple schema types', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              { "@context": "https://schema.org", "@type": "Organization", "name": "Test" }
            </script>
            <script type="application/ld+json">
              { "@context": "https://schema.org", "@type": "WebSite", "url": "https://example.com" }
            </script>
          </head>
        </html>
      `;

      const { data } = analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.types).toContain('Organization');
      expect(data.schemaOrg.types).toContain('WebSite');
    });
  });

  describe('Complete tracking analysis', () => {
    it('analyzes fully configured page with all tracking', () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta name="google-site-verification" content="googleverification123456" />
            <meta name="msvalidate.01" content="bingverification123456789" />
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-MEASUREMENT1"></script>
            <script>
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-MEASUREMENT1');
            </script>
            <script type="application/ld+json">
              { "@context": "https://schema.org", "@type": "Organization", "name": "Test" }
            </script>
          </head>
          <body></body>
        </html>
      `;

      const { data, issues } = analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(true);
      expect(data.gsc.verified).toBe(true);
      expect(data.bing.verified).toBe(true);
      expect(data.schemaOrg.detected).toBe(true);

      // Should only have GTM missing (which is informational)
      const criticalIssues = issues.filter((i) => i.severity === 'error' || i.severity === 'warning');
      expect(criticalIssues).toHaveLength(0);
    });

    it('analyzes page with no tracking configured', () => {
      const html = `<html><head></head><body></body></html>`;

      const { issues } = analyzeTrackingVerification(html, testUrl);

      const issueCodes = issues.map((i) => i.code);
      expect(issueCodes).toContain('GA4_MISSING');
      expect(issueCodes).toContain('GSC_VERIFICATION_MISSING');
      expect(issueCodes).toContain('BING_VERIFICATION_MISSING');
      expect(issueCodes).toContain('GTM_MISSING');
      expect(issueCodes).toContain('SCHEMA_ORG_MISSING');
    });
  });
});
