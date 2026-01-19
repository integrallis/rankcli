import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateBlogPost,
  generateChangelog,
  optimizeReadme,
  scoreContentSEO,
  ContentGeneratorOptions,
  BlogPostConfig,
  ChangelogConfig,
  ReadmeConfig,
  GeneratedContent,
  SEOScore,
} from './generator.js';

describe('content-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateBlogPost', () => {
    it('generates blog post with title', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        title: 'How to Use Our API: A Complete Guide',
        content: '# How to Use Our API\n\nThis guide covers...',
        metaDescription: 'Learn how to use our API with this step-by-step guide.',
        keywords: ['api', 'guide', 'tutorial'],
      });

      const config: BlogPostConfig = {
        topic: 'how to use our API',
        keywords: ['api', 'tutorial'],
        tone: 'technical',
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.metaDescription).toBeDefined();
    });

    it('includes target keywords in content', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        title: 'REST API Tutorial',
        content: '# REST API Tutorial\n\nLearn how to build a REST API...',
        metaDescription: 'A complete REST API tutorial for beginners.',
        keywords: ['rest', 'api', 'tutorial'],
      });

      const config: BlogPostConfig = {
        topic: 'REST API tutorial',
        keywords: ['rest api', 'tutorial'],
        tone: 'educational',
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      expect(result.keywords).toContain('rest');
    });

    it('generates SEO-optimized meta description', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        title: 'Test Post',
        content: '# Test\n\nContent here...',
        metaDescription: 'A great meta description under 160 chars.',
        keywords: [],
      });

      const config: BlogPostConfig = {
        topic: 'test topic',
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      expect(result.metaDescription.length).toBeLessThanOrEqual(160);
    });

    it('respects word count limits', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        title: 'Short Post',
        content: '# Short\n\nThis is a short post with limited words.',
        metaDescription: 'A short post.',
        keywords: [],
      });

      const config: BlogPostConfig = {
        topic: 'short topic',
        wordCount: { min: 100, max: 500 },
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      expect(result.content).toBeDefined();
    });

    it('handles LLM errors gracefully', async () => {
      const mockLLM = vi.fn().mockRejectedValue(new Error('LLM unavailable'));

      const config: BlogPostConfig = {
        topic: 'test topic',
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      expect(result.error).toBeDefined();
      expect(result.content).toBe('');
    });
  });

  describe('generateChangelog', () => {
    it('generates changelog from git commits', async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: `feat: add user authentication
fix: resolve login bug
chore: update dependencies`,
      });

      const config: ChangelogConfig = {
        fromRef: 'v1.0.0',
        toRef: 'HEAD',
      };

      const result = await generateChangelog(config, { exec: mockExec });

      expect(result.content).toContain('feat');
      expect(result.sections).toBeDefined();
    });

    it('groups changes by type', async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: `feat: feature 1
feat: feature 2
fix: bug fix
docs: update readme`,
      });

      const config: ChangelogConfig = {
        fromRef: 'v1.0.0',
        toRef: 'HEAD',
        groupByType: true,
      };

      const result = await generateChangelog(config, { exec: mockExec });

      expect(result.sections).toHaveProperty('features');
      expect(result.sections).toHaveProperty('fixes');
    });

    it('includes date range', async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: `feat: new feature`,
      });

      const config: ChangelogConfig = {
        fromRef: 'v1.0.0',
        toRef: 'v1.1.0',
      };

      const result = await generateChangelog(config, { exec: mockExec });

      expect(result.version).toBeDefined();
    });

    it('handles empty commit range', async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: '',
      });

      const config: ChangelogConfig = {
        fromRef: 'v1.0.0',
        toRef: 'v1.0.0',
      };

      const result = await generateChangelog(config, { exec: mockExec });

      expect(result.content).toBe('');
      expect(result.sections).toEqual({});
    });

    it('formats for SEO with keywords', async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: `feat: add new API endpoint`,
      });

      const config: ChangelogConfig = {
        fromRef: 'v1.0.0',
        toRef: 'HEAD',
        seoKeywords: ['api', 'update'],
      };

      const result = await generateChangelog(config, { exec: mockExec });

      expect(result.metaDescription).toBeDefined();
    });
  });

  describe('optimizeReadme', () => {
    it('adds missing sections', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        content: '# Project\n\n## Installation\n\n## Usage\n\n## License',
        suggestions: ['Add badges', 'Add examples'],
      });

      const config: ReadmeConfig = {
        currentContent: '# Project\n\nBasic readme content.',
        projectName: 'my-project',
      };

      const result = await optimizeReadme(config, { llm: mockLLM });

      expect(result.content).toContain('Installation');
    });

    it('adds SEO-friendly description', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        content: '# Project\n\nA powerful tool for developers.',
        suggestions: [],
        metaDescription: 'A powerful tool for developers.',
      });

      const config: ReadmeConfig = {
        currentContent: '# Project',
        projectName: 'my-project',
        keywords: ['developer tool'],
      };

      const result = await optimizeReadme(config, { llm: mockLLM });

      expect(result.metaDescription).toBeDefined();
    });

    it('suggests badge additions', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        content: '# Project',
        suggestions: ['Add npm version badge', 'Add license badge'],
      });

      const config: ReadmeConfig = {
        currentContent: '# Project',
        projectName: 'my-project',
      };

      const result = await optimizeReadme(config, { llm: mockLLM });

      expect(result.suggestions).toContain('Add npm version badge');
    });

    it('preserves existing content structure', async () => {
      const existingContent = `# My Project

## Custom Section

My custom content here.`;

      const mockLLM = vi.fn().mockResolvedValue({
        content: `# My Project

## Custom Section

My custom content here.

## Installation

npm install my-project`,
        suggestions: [],
      });

      const config: ReadmeConfig = {
        currentContent: existingContent,
        projectName: 'my-project',
        preserveCustomSections: true,
      };

      const result = await optimizeReadme(config, { llm: mockLLM });

      expect(result.content).toContain('Custom Section');
    });

    it('handles empty readme', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        content: '# My Project\n\nA great project.',
        suggestions: ['Add all sections'],
      });

      const config: ReadmeConfig = {
        currentContent: '',
        projectName: 'my-project',
      };

      const result = await optimizeReadme(config, { llm: mockLLM });

      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('scoreContentSEO', () => {
    it('scores content based on SEO factors', () => {
      const content = `# Great Title

This is a great article about SEO optimization.

## Introduction

Learn about SEO best practices.

## Conclusion

In summary, SEO is important.`;

      const score = scoreContentSEO(content, {
        targetKeywords: ['seo', 'optimization'],
      });

      expect(score.overall).toBeGreaterThan(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });

    it('checks for heading structure', () => {
      const goodContent = `# Main Title

## Section 1

Content here.

## Section 2

More content.`;

      const badContent = `Main Title

No headings at all.`;

      const goodScore = scoreContentSEO(goodContent);
      const badScore = scoreContentSEO(badContent);

      expect(goodScore.headingScore).toBeGreaterThan(badScore.headingScore);
    });

    it('checks keyword density', () => {
      const contentWithKeywords = `# SEO Guide

SEO is important for developers. This SEO guide covers SEO basics.`;

      const contentWithoutKeywords = `# Guide

This guide covers various topics about web development.`;

      const withScore = scoreContentSEO(contentWithKeywords, {
        targetKeywords: ['seo'],
      });
      const withoutScore = scoreContentSEO(contentWithoutKeywords, {
        targetKeywords: ['seo'],
      });

      expect(withScore.keywordScore).toBeGreaterThan(withoutScore.keywordScore);
    });

    it('checks content length', () => {
      const shortContent = '# Title\n\nShort.';
      const longContent = `# Title

${'This is a paragraph of content. '.repeat(50)}`;

      const shortScore = scoreContentSEO(shortContent);
      const longScore = scoreContentSEO(longContent);

      expect(longScore.lengthScore).toBeGreaterThan(shortScore.lengthScore);
    });

    it('checks for internal links', () => {
      const contentWithLinks = `# Guide

Check out [our API docs](/docs/api) and [tutorials](/tutorials).`;

      const contentWithoutLinks = `# Guide

This is content without any links.`;

      const withLinksScore = scoreContentSEO(contentWithLinks);
      const withoutLinksScore = scoreContentSEO(contentWithoutLinks);

      expect(withLinksScore.linkScore).toBeGreaterThan(withoutLinksScore.linkScore);
    });

    it('checks for images with alt text', () => {
      const contentWithImages = `# Guide

![API diagram showing flow](./api-diagram.png)`;

      const contentWithoutImages = `# Guide

Just text content.`;

      const withImagesScore = scoreContentSEO(contentWithImages);
      const withoutImagesScore = scoreContentSEO(contentWithoutImages);

      expect(withImagesScore.mediaScore).toBeGreaterThan(withoutImagesScore.mediaScore);
    });

    it('returns breakdown of score factors', () => {
      const content = '# Test\n\nContent here.';

      const score = scoreContentSEO(content);

      expect(score).toHaveProperty('overall');
      expect(score).toHaveProperty('headingScore');
      expect(score).toHaveProperty('keywordScore');
      expect(score).toHaveProperty('lengthScore');
      expect(score).toHaveProperty('linkScore');
      expect(score).toHaveProperty('mediaScore');
    });
  });

  describe('GEO optimization', () => {
    it('structures content for AI citation', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        title: 'SEO Autopilot: Best CLI Tool for Developers',
        content: `# SEO Autopilot: Best CLI Tool for Developers

**Key Fact:** SEO Autopilot runs 200+ automated SEO checks directly from your terminal.

## Features

- Command-line interface
- GitHub integration
- Auto-fix PRs`,
        metaDescription: 'SEO Autopilot is the best CLI tool for developers.',
        keywords: ['seo', 'cli', 'developers'],
      });

      const config: BlogPostConfig = {
        topic: 'SEO Autopilot CLI',
        geoOptimize: true,
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      // GEO-optimized content should have citable facts
      expect(result.content).toMatch(/\*\*.*\*\*/); // Bold facts
    });

    it('includes FAQ section for AI parsing', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        title: 'FAQ Post',
        content: `# FAQ

## What is SEO Autopilot?

SEO Autopilot is a CLI-first SEO tool.

## How does it work?

It runs 200+ checks on your website.`,
        metaDescription: 'FAQ about SEO Autopilot.',
        keywords: [],
        hasFAQ: true,
      });

      const config: BlogPostConfig = {
        topic: 'FAQ about SEO',
        includeFAQ: true,
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      expect(result.hasFAQ).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('generates complete blog post with all SEO elements', async () => {
      const mockLLM = vi.fn().mockResolvedValue({
        title: 'Complete SEO Guide for Developers',
        content: `# Complete SEO Guide for Developers

Learn everything about SEO optimization for your web applications.

## Introduction

SEO is crucial for modern web development.

## Key Concepts

Understanding these concepts will help you rank better.

## Conclusion

Start optimizing your sites today!`,
        metaDescription: 'A complete guide to SEO for developers. Learn optimization techniques.',
        keywords: ['seo', 'developers', 'guide', 'optimization'],
        readingTime: '5 min',
        wordCount: 150,
      });

      const config: BlogPostConfig = {
        topic: 'SEO for developers',
        keywords: ['seo', 'developers'],
        tone: 'educational',
        wordCount: { min: 100, max: 500 },
      };

      const result = await generateBlogPost(config, { llm: mockLLM });

      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.metaDescription).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.readingTime).toBeDefined();
    });

    it('generates release notes from conventional commits', async () => {
      const mockExec = vi.fn().mockResolvedValue({
        stdout: `feat(api): add new endpoint for user profiles
fix(auth): resolve token refresh issue
feat(cli): add --verbose flag
fix(ui): correct button alignment
docs: update API documentation
chore: bump dependencies`,
      });

      const config: ChangelogConfig = {
        fromRef: 'v1.0.0',
        toRef: 'v1.1.0',
        groupByType: true,
        includeBreaking: true,
      };

      const result = await generateChangelog(config, { exec: mockExec });

      expect(result.sections.features).toHaveLength(2);
      expect(result.sections.fixes).toHaveLength(2);
    });
  });
});
