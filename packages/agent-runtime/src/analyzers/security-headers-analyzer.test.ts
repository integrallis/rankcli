import { describe, it, expect } from 'vitest';
import { analyzeSecurityHeaders, generateSecurityHeaders } from './security-headers-analyzer.js';

describe('Security Headers Analyzer', () => {
  describe('analyzeSecurityHeaders', () => {
    it('detects HTTPS', () => {
      const result = analyzeSecurityHeaders({}, 'https://example.com');
      expect(result.https.enabled).toBe(true);
    });

    it('detects missing HTTPS', () => {
      const result = analyzeSecurityHeaders({}, 'http://example.com');
      expect(result.https.enabled).toBe(false);
      expect(result.issues.some(i => i.code === 'SEC_NO_HTTPS')).toBe(true);
    });

    it('detects HSTS', () => {
      const result = analyzeSecurityHeaders({
        'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
      }, 'https://example.com');
      expect(result.https.hasHSTS).toBe(true);
      expect(result.https.hstsMaxAge).toBe(31536000);
      expect(result.https.includesSubdomains).toBe(true);
      expect(result.https.preload).toBe(true);
    });

    it('warns about short HSTS max-age', () => {
      const result = analyzeSecurityHeaders({
        'strict-transport-security': 'max-age=86400',
      }, 'https://example.com');
      expect(result.issues.some(i => i.code === 'SEC_HSTS_SHORT')).toBe(true);
    });

    it('detects CSP', () => {
      const result = analyzeSecurityHeaders({
        'content-security-policy': "default-src 'self'",
      }, 'https://example.com');
      expect(result.contentSecurity.hasCSP).toBe(true);
    });

    it('warns about missing CSP', () => {
      const result = analyzeSecurityHeaders({}, 'https://example.com');
      expect(result.issues.some(i => i.code === 'SEC_NO_CSP')).toBe(true);
    });

    it('detects X-Frame-Options', () => {
      const result = analyzeSecurityHeaders({
        'x-frame-options': 'SAMEORIGIN',
      }, 'https://example.com');
      expect(result.frameOptions.hasXFrameOptions).toBe(true);
      expect(result.frameOptions.value).toBe('SAMEORIGIN');
    });

    it('detects X-Content-Type-Options', () => {
      const result = analyzeSecurityHeaders({
        'x-content-type-options': 'nosniff',
      }, 'https://example.com');
      expect(result.contentTypeOptions.hasXContentTypeOptions).toBe(true);
    });

    it('detects Referrer-Policy', () => {
      const result = analyzeSecurityHeaders({
        'referrer-policy': 'strict-origin-when-cross-origin',
      }, 'https://example.com');
      expect(result.referrerPolicy.hasReferrerPolicy).toBe(true);
    });

    it('detects Permissions-Policy', () => {
      const result = analyzeSecurityHeaders({
        'permissions-policy': 'geolocation=(), microphone=()',
      }, 'https://example.com');
      expect(result.permissionsPolicy.hasPermissionsPolicy).toBe(true);
    });

    it('grades A+ for complete headers', () => {
      const result = analyzeSecurityHeaders({
        'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
        'content-security-policy': "default-src 'self'",
        'x-frame-options': 'SAMEORIGIN',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'geolocation=()',
      }, 'https://example.com');
      expect(result.grade).toBe('A+');
    });

    it('grades D for no headers on HTTP', () => {
      // HTTP without headers still gets 44/100 (no HSTS penalty since not HTTPS)
      // Score: 100 - 30 (no HTTPS) - 10 (no CSP) - 5 (no X-Frame) - 5 (no X-Content-Type) - 3 (no Referrer) - 3 (no Permissions) = 44
      const result = analyzeSecurityHeaders({}, 'http://example.com');
      expect(result.grade).toBe('D');
    });

    it('normalizes header names to lowercase', () => {
      const result = analyzeSecurityHeaders({
        'Strict-Transport-Security': 'max-age=31536000',
        'Content-Security-Policy': "default-src 'self'",
      }, 'https://example.com');
      expect(result.https.hasHSTS).toBe(true);
      expect(result.contentSecurity.hasCSP).toBe(true);
    });
  });

  describe('generateSecurityHeaders', () => {
    it('generates recommended headers', () => {
      const headers = generateSecurityHeaders('https://example.com');
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBeDefined();
      expect(headers['Permissions-Policy']).toBeDefined();
    });
  });
});
