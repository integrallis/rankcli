import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeTrackingVerification } from './tracking-verification.js';
import { lookupSiteVerification, type SiteVerification } from './site-verification.js';

// The DNS/BingSiteAuth.xml lookup is the helper's business (site-verification.test.ts); here
// it answers what each test says, and never touches the network.
vi.mock('./site-verification.js', () => ({ lookupSiteVerification: vi.fn() }));

const lookup = vi.mocked(lookupSiteVerification);
const nothing: SiteVerification = { dnsChecked: true, googleDns: false, bingDns: false, bingSiteAuthFile: false };

beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue(nothing);
});

describe('analyzeTrackingVerification', () => {
  const testUrl = 'https://example.com';

  describe('Google Analytics 4 detection', () => {
    it('detects GA4 gtag.js tracking code', async () => {
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

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(true);
      expect(data.ga4.measurementId).toBe('G-ABC123XYZ');

      const ga4Issue = issues.find((i) => i.code === 'GA4_MISSING');
      expect(ga4Issue).toBeUndefined();
    });

    it('detects GA4 from script src only', async () => {
      const html = `
        <html>
          <head>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-TESTID123"></script>
          </head>
        </html>
      `;

      const { data } = await analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(true);
      expect(data.ga4.measurementId).toBe('G-TESTID123');
    });

    it('reports missing GA4 when not present', async () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(false);
      expect(data.ga4.measurementId).toBeUndefined();

      const ga4Issue = issues.find((i) => i.code === 'GA4_MISSING');
      expect(ga4Issue).toBeDefined();
      expect(ga4Issue?.severity).toBe('warning');
      expect(ga4Issue?.affectedUrls).toContain(testUrl);
    });

    it('does not report missing GA4 if GTM is present', async () => {
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

      const { issues } = await analyzeTrackingVerification(html, testUrl);

      const ga4Issue = issues.find((i) => i.code === 'GA4_MISSING');
      expect(ga4Issue).toBeUndefined();
    });
  });

  describe('Google Tag Manager detection', () => {
    it('detects GTM with noscript fallback', async () => {
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

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.gtm.detected).toBe(true);
      expect(data.gtm.containerId).toBe('GTM-TESTID');
      expect(data.gtm.hasNoscript).toBe(true);

      const gtmIssue = issues.find((i) => i.code === 'GTM_MISSING');
      expect(gtmIssue).toBeUndefined();

      const noscriptIssue = issues.find((i) => i.code === 'GTM_NOSCRIPT_MISSING');
      expect(noscriptIssue).toBeUndefined();
    });

    it('reports missing noscript when GTM present without it', async () => {
      const html = `
        <html>
          <head>
            <script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
          </head>
          <body></body>
        </html>
      `;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.gtm.detected).toBe(true);
      expect(data.gtm.hasNoscript).toBe(false);

      const noscriptIssue = issues.find((i) => i.code === 'GTM_NOSCRIPT_MISSING');
      expect(noscriptIssue).toBeDefined();
      expect(noscriptIssue?.severity).toBe('notice');
    });

    it('reports missing GTM as informational', async () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.gtm.detected).toBe(false);

      const gtmIssue = issues.find((i) => i.code === 'GTM_MISSING');
      expect(gtmIssue).toBeDefined();
      expect(gtmIssue?.severity).toBe('notice');
    });
  });

  describe('Google Search Console verification', () => {
    it('detects GSC verification meta tag', async () => {
      const html = `
        <html>
          <head>
            <meta name="google-site-verification" content="abc123xyz789verificationcode" />
          </head>
        </html>
      `;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.gsc.verified).toBe(true);
      expect(data.gsc.verificationCode).toBe('abc123xyz789verificationcode');

      const gscIssue = issues.find((i) => i.code === 'GSC_VERIFICATION_MISSING');
      expect(gscIssue).toBeUndefined();
    });

    it('reports missing GSC verification', async () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.gsc.verified).toBe(false);

      const gscIssue = issues.find((i) => i.code === 'GSC_VERIFICATION_MISSING');
      expect(gscIssue).toBeDefined();
      expect(gscIssue?.severity).toBe('warning');
    });

    it('rejects short verification codes as invalid', async () => {
      const html = `
        <html>
          <head>
            <meta name="google-site-verification" content="short" />
          </head>
        </html>
      `;

      const { data } = await analyzeTrackingVerification(html, testUrl);

      expect(data.gsc.verified).toBe(false);
    });
  });

  describe('Bing Webmaster Tools verification', () => {
    it('detects Bing verification meta tag', async () => {
      const html = `
        <html>
          <head>
            <meta name="msvalidate.01" content="BING12345678901234567890" />
          </head>
        </html>
      `;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.bing.verified).toBe(true);
      expect(data.bing.verificationCode).toBe('BING12345678901234567890');

      const bingIssue = issues.find((i) => i.code === 'BING_VERIFICATION_MISSING');
      expect(bingIssue).toBeUndefined();
    });

    it('reports missing Bing verification as notice', async () => {
      const html = `<html><head></head></html>`;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.bing.verified).toBe(false);

      const bingIssue = issues.find((i) => i.code === 'BING_VERIFICATION_MISSING');
      expect(bingIssue).toBeDefined();
      expect(bingIssue?.severity).toBe('notice');
    });
  });

  describe('Schema.org structured data detection', () => {
    it('detects JSON-LD structured data', async () => {
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

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(true);
      expect(data.schemaOrg.types).toContain('Organization');
      expect(data.schemaOrg.hasValidJson).toBe(true);

      const schemaIssue = issues.find((i) => i.code === 'SCHEMA_ORG_MISSING');
      expect(schemaIssue).toBeUndefined();
    });

    it('detects microdata structured data', async () => {
      const html = `
        <html>
          <body>
            <div itemscope itemtype="https://schema.org/Product">
              <span itemprop="name">Test Product</span>
            </div>
          </body>
        </html>
      `;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(true);

      const schemaIssue = issues.find((i) => i.code === 'SCHEMA_ORG_MISSING');
      expect(schemaIssue).toBeUndefined();
    });

    it('reports missing structured data', async () => {
      const html = `<html><head></head><body></body></html>`;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(false);

      const schemaIssue = issues.find((i) => i.code === 'SCHEMA_ORG_MISSING');
      expect(schemaIssue).toBeDefined();
      expect(schemaIssue?.severity).toBe('warning');
    });

    it('reports invalid JSON-LD', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              { invalid json here }
            </script>
          </head>
        </html>
      `;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.detected).toBe(true);
      expect(data.schemaOrg.hasValidJson).toBe(false);

      const invalidIssue = issues.find((i) => i.code === 'SCHEMA_ORG_INVALID');
      expect(invalidIssue).toBeDefined();
      expect(invalidIssue?.severity).toBe('error');
    });

    it('extracts multiple schema types', async () => {
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

      const { data } = await analyzeTrackingVerification(html, testUrl);

      expect(data.schemaOrg.types).toContain('Organization');
      expect(data.schemaOrg.types).toContain('WebSite');
    });
  });

  describe('Complete tracking analysis', () => {
    it('analyzes fully configured page with all tracking', async () => {
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

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.ga4.detected).toBe(true);
      expect(data.gsc.verified).toBe(true);
      expect(data.bing.verified).toBe(true);
      expect(data.schemaOrg.detected).toBe(true);

      // Should only have GTM missing (which is informational)
      const criticalIssues = issues.filter((i) => i.severity === 'error' || i.severity === 'warning');
      expect(criticalIssues).toHaveLength(0);
    });

    it('analyzes page with no tracking configured', async () => {
      const html = `<html><head></head><body></body></html>`;

      const { issues } = await analyzeTrackingVerification(html, testUrl);

      const issueCodes = issues.map((i) => i.code);
      expect(issueCodes).toContain('GA4_MISSING');
      expect(issueCodes).toContain('GSC_VERIFICATION_MISSING');
      expect(issueCodes).toContain('BING_VERIFICATION_MISSING');
      expect(issueCodes).toContain('GTM_MISSING');
      expect(issueCodes).toContain('SCHEMA_ORG_MISSING');
    });
  });

  describe('other analytics', () => {
    // rankcli.dev loads Cloudflare Web Analytics: it measures its traffic and has no use for GA4
    // or a tag manager, so neither notice applies.
    it('does not ask a Cloudflare Web Analytics site for GA4 or GTM', async () => {
      const html = `<html><head>
        <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "abc"}'></script>
      </head></html>`;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.otherAnalytics).toEqual(['Cloudflare Web Analytics']);
      expect(data.ga4.detected).toBe(false);
      const codes = issues.map((i) => i.code);
      expect(codes).not.toContain('GA4_MISSING');
      expect(codes).not.toContain('GTM_MISSING');
    });

    it.each([
      ['Plausible', '<script defer data-domain="example.com" src="https://plausible.io/js/script.js"></script>'],
      ['Fathom', '<script src="https://cdn.usefathom.com/script.js" data-site="ABCDEFG" defer></script>'],
      ['Umami', '<script defer src="https://analytics.example.com/script.js" data-website-id="9d8a-1"></script>'],
      ['PostHog', '<script>posthog.init("phc_x", { api_host: "https://us.i.posthog.com" })</script>'],
      ['Matomo', '<script>var _paq = window._paq = window._paq || []; _paq.push(["trackPageView"]);</script>'],
      ['Simple Analytics', '<script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>'],
      ['Mixpanel', '<script src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"></script>'],
      ['Segment', '<script src="https://cdn.segment.com/analytics.js/v1/KEY/analytics.min.js"></script>'],
    ])('recognises %s', async (name, snippet) => {
      const { data, issues } = await analyzeTrackingVerification(`<html><head>${snippet}</head></html>`, testUrl);

      expect(data.otherAnalytics).toContain(name);
      const codes = issues.map((i) => i.code);
      expect(codes).not.toContain('GA4_MISSING');
      expect(codes).not.toContain('GTM_MISSING');
    });

    it('still reports both when no analytics at all is present', async () => {
      const html = `<html><head><script src="/assets/app.js"></script></head></html>`;

      const { data, issues } = await analyzeTrackingVerification(html, testUrl);

      expect(data.otherAnalytics).toEqual([]);
      const codes = issues.map((i) => i.code);
      expect(codes).toContain('GA4_MISSING');
      expect(codes).toContain('GTM_MISSING');
    });
  });

  describe('verification through DNS and BingSiteAuth.xml', () => {
    const bare = `<html><head></head></html>`;

    it('accepts a google-site-verification TXT record in place of the meta tag', async () => {
      lookup.mockResolvedValue({ ...nothing, googleDns: true });

      const { data, issues } = await analyzeTrackingVerification(bare, testUrl);

      expect(data.gsc).toEqual({ verified: true, verificationCode: undefined, source: 'dns' });
      expect(issues.map((i) => i.code)).not.toContain('GSC_VERIFICATION_MISSING');
      expect(lookup).toHaveBeenCalledWith(testUrl);
    });

    it('accepts an MS= TXT record for Bing', async () => {
      lookup.mockResolvedValue({ ...nothing, bingDns: true });

      const { data, issues } = await analyzeTrackingVerification(bare, testUrl);

      expect(data.bing.verified).toBe(true);
      expect(data.bing.source).toBe('dns');
      expect(issues.map((i) => i.code)).not.toContain('BING_VERIFICATION_MISSING');
    });

    it('accepts /BingSiteAuth.xml for Bing', async () => {
      lookup.mockResolvedValue({ ...nothing, bingSiteAuthFile: true });

      const { data, issues } = await analyzeTrackingVerification(bare, testUrl);

      expect(data.bing.source).toBe('file');
      expect(issues.map((i) => i.code)).not.toContain('BING_VERIFICATION_MISSING');
    });

    it('prefers the meta tag as the source when both are present', async () => {
      lookup.mockResolvedValue({ ...nothing, googleDns: true });
      const html = `<html><head><meta name="google-site-verification" content="abc123xyz789verificationcode" /></head></html>`;

      const { data } = await analyzeTrackingVerification(html, testUrl);

      expect(data.gsc.source).toBe('meta');
    });

    it('says the record is absent when DNS was checked and found nothing', async () => {
      const { data, issues } = await analyzeTrackingVerification(bare, testUrl);

      expect(data.dnsChecked).toBe(true);
      const gsc = issues.find((i) => i.code === 'GSC_VERIFICATION_MISSING');
      expect(gsc?.title).toBe('Google Search Console verification not found');
      expect(gsc?.description).toContain('no google-site-verification TXT record');
      expect(gsc?.details).toEqual({ dnsChecked: true });
      const bing = issues.find((i) => i.code === 'BING_VERIFICATION_MISSING');
      expect(bing?.description).toContain('no MS= TXT record');
    });

    // Deno and offline runs have no resolver: the site may well be verified, so say only what
    // was seen.
    it('only says the tag is not in the HTML when DNS could not be checked', async () => {
      lookup.mockResolvedValue({ ...nothing, dnsChecked: false });

      const { data, issues } = await analyzeTrackingVerification(bare, testUrl);

      expect(data.dnsChecked).toBe(false);
      const gsc = issues.find((i) => i.code === 'GSC_VERIFICATION_MISSING');
      expect(gsc).toBeDefined();
      expect(gsc?.title).toBe('Google Search Console verification not visible in the HTML');
      expect(gsc?.description).toContain('could not check');
      expect(gsc?.description).not.toContain('no google-site-verification TXT record');
      expect(gsc?.details).toEqual({ dnsChecked: false });
      const bing = issues.find((i) => i.code === 'BING_VERIFICATION_MISSING');
      expect(bing?.title).toBe('Bing Webmaster Tools verification not visible in the HTML');
      expect(bing?.description).toContain('could not check');
    });
  });
});
