import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatConventionalCommit,
  formatSEOCommitMessage,
  isGitRepo,
  detectGitHubPages,
  generateCommitSummary,
  COMMIT_TYPES,
  SEO_SCOPES,
  type ConventionalCommit,
  type SEOFixCommit,
  type CommitConfig,
} from './commit-helper.js';

describe('commit-helper', () => {
  describe('formatConventionalCommit', () => {
    it('formats a basic commit message', () => {
      const commit: ConventionalCommit = {
        type: 'fix',
        description: 'resolve meta tag issue',
      };
      expect(formatConventionalCommit(commit)).toBe('fix: resolve meta tag issue');
    });

    it('includes scope when provided', () => {
      const commit: ConventionalCommit = {
        type: 'fix',
        scope: 'seo',
        description: 'add missing title tag',
      };
      expect(formatConventionalCommit(commit)).toBe('fix(seo): add missing title tag');
    });

    it('adds breaking change indicator', () => {
      const commit: ConventionalCommit = {
        type: 'feat',
        scope: 'schema',
        description: 'change JSON-LD format',
        breaking: true,
      };
      expect(formatConventionalCommit(commit)).toBe('feat(schema)!: change JSON-LD format');
    });

    it('includes body when provided', () => {
      const commit: ConventionalCommit = {
        type: 'fix',
        scope: 'meta',
        description: 'add meta description',
        body: 'Added meta descriptions to all pages.\nThis improves SEO score.',
      };
      const result = formatConventionalCommit(commit);
      expect(result).toContain('fix(meta): add meta description');
      expect(result).toContain('Added meta descriptions to all pages.');
      expect(result).toContain('This improves SEO score.');
    });

    it('includes issue codes when provided', () => {
      const commit: ConventionalCommit = {
        type: 'fix',
        scope: 'seo',
        description: 'fix crawlability issues',
        issues: ['ROBOTS_TXT_MISSING', 'SITEMAP_MISSING'],
      };
      const result = formatConventionalCommit(commit);
      expect(result).toContain('Issue codes: ROBOTS_TXT_MISSING, SITEMAP_MISSING');
    });
  });

  describe('formatSEOCommitMessage', () => {
    it('formats SEO fix with co-author', () => {
      const fix: SEOFixCommit = {
        category: 'on-page',
        issues: ['TITLE_MISSING', 'META_DESC_MISSING'],
        filesChanged: ['index.html'],
        description: 'add on page improvements',
      };
      const config: CommitConfig = {
        systemName: 'SEO Autopilot',
        systemEmail: 'bot@seo-autopilot.dev',
      };

      const result = formatSEOCommitMessage(fix, config);

      expect(result).toContain('fix(meta): add on page improvements');
      expect(result).toContain('Files changed:');
      expect(result).toContain('- index.html');
      expect(result).toContain('Issue codes: TITLE_MISSING, META_DESC_MISSING');
      expect(result).toContain('Co-Authored-By: SEO Autopilot <bot@seo-autopilot.dev>');
    });

    it('maps categories to correct commit types', () => {
      const testCases = [
        { category: 'crawlability', expectedType: 'fix', expectedScope: 'seo' },
        { category: 'on-page', expectedType: 'fix', expectedScope: 'meta' },
        { category: 'structured-data', expectedType: 'feat', expectedScope: 'schema' },
        { category: 'performance', expectedType: 'perf', expectedScope: 'web' },
        { category: 'social-meta', expectedType: 'feat', expectedScope: 'og' },
        { category: 'images', expectedType: 'fix', expectedScope: 'images' },
        { category: 'links', expectedType: 'fix', expectedScope: 'links' },
        { category: 'security', expectedType: 'fix', expectedScope: 'security' },
      ];

      testCases.forEach(({ category, expectedType, expectedScope }) => {
        const fix: SEOFixCommit = {
          category,
          issues: ['TEST_ISSUE'],
          filesChanged: ['test.html'],
          description: 'test fix',
        };
        const result = formatSEOCommitMessage(fix);
        expect(result).toContain(`${expectedType}(${expectedScope}): test fix`);
      });
    });

    it('uses default scope for unknown categories', () => {
      const fix: SEOFixCommit = {
        category: 'unknown-category',
        issues: ['TEST_ISSUE'],
        filesChanged: ['test.html'],
        description: 'test fix',
      };
      const result = formatSEOCommitMessage(fix);
      expect(result).toContain('fix(seo): test fix');
    });

    it('handles multiple files', () => {
      const fix: SEOFixCommit = {
        category: 'on-page',
        issues: ['TEST'],
        filesChanged: ['index.html', 'about.html', 'contact.html'],
        description: 'fix meta tags',
      };
      const result = formatSEOCommitMessage(fix);
      expect(result).toContain('- index.html');
      expect(result).toContain('- about.html');
      expect(result).toContain('- contact.html');
    });

    it('uses custom system name and email', () => {
      const fix: SEOFixCommit = {
        category: 'on-page',
        issues: ['TEST'],
        filesChanged: ['index.html'],
        description: 'test',
      };
      const config: CommitConfig = {
        systemName: 'Custom Bot',
        systemEmail: 'custom@example.com',
      };
      const result = formatSEOCommitMessage(fix, config);
      expect(result).toContain('Co-Authored-By: Custom Bot <custom@example.com>');
    });
  });

  describe('generateCommitSummary', () => {
    it('generates summary for successful commits', () => {
      const commits = [
        {
          fix: {
            category: 'on-page',
            issues: ['TITLE_MISSING'],
            filesChanged: ['index.html'],
            description: 'add title tags',
          },
          result: { success: true, hash: 'abc1234' },
        },
        {
          fix: {
            category: 'social-meta',
            issues: ['OG_TITLE_MISSING'],
            filesChanged: ['index.html'],
            description: 'add og tags',
          },
          result: { success: true, hash: 'def5678' },
        },
      ];

      const summary = generateCommitSummary(commits);

      expect(summary).toContain('## SEO Fix Commits Summary');
      expect(summary).toContain('2 commits created');
      expect(summary).toContain('abc1234');
      expect(summary).toContain('def5678');
      expect(summary).toContain('add title tags');
      expect(summary).toContain('add og tags');
    });

    it('includes failed commits in summary', () => {
      const commits = [
        {
          fix: {
            category: 'on-page',
            issues: ['TITLE_MISSING'],
            filesChanged: ['index.html'],
            description: 'add title tags',
          },
          result: { success: true, hash: 'abc1234' },
        },
        {
          fix: {
            category: 'crawlability',
            issues: ['ROBOTS_TXT_MISSING'],
            filesChanged: ['robots.txt'],
            description: 'add robots.txt',
          },
          result: { success: false, error: 'Permission denied' },
        },
      ];

      const summary = generateCommitSummary(commits);

      expect(summary).toContain('1 commits created');
      expect(summary).toContain('1 commits failed');
      expect(summary).toContain('### Failed Commits');
      expect(summary).toContain('Permission denied');
    });
  });

  describe('COMMIT_TYPES and SEO_SCOPES', () => {
    it('has all expected commit types', () => {
      const types = COMMIT_TYPES.map((t) => t.type);
      expect(types).toContain('fix');
      expect(types).toContain('feat');
      expect(types).toContain('docs');
      expect(types).toContain('perf');
      expect(types).toContain('chore');
    });

    it('has all expected SEO scopes', () => {
      expect(SEO_SCOPES).toContain('seo');
      expect(SEO_SCOPES).toContain('meta');
      expect(SEO_SCOPES).toContain('og');
      expect(SEO_SCOPES).toContain('schema');
      expect(SEO_SCOPES).toContain('images');
      expect(SEO_SCOPES).toContain('links');
      expect(SEO_SCOPES).toContain('security');
    });
  });
});

describe('detectGitHubPages', () => {
  // These tests would need filesystem mocking
  // For now, we test the function exists and returns expected shape
  it('returns expected structure', () => {
    // Test with a non-existent path returns false
    const result = detectGitHubPages('/non/existent/path');
    expect(result).toHaveProperty('isGitHubPages');
    expect(typeof result.isGitHubPages).toBe('boolean');
  });
});

describe('isGitRepo', () => {
  it('returns false for non-git directory', () => {
    expect(isGitRepo('/tmp')).toBe(false);
  });

  it('returns boolean', () => {
    const result = isGitRepo();
    expect(typeof result).toBe('boolean');
  });
});
