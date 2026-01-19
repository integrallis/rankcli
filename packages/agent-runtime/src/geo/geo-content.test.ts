import { describe, it, expect } from 'vitest';
import {
  generateAICitableContent,
  generateFAQSchema,
  generateComparisonTable,
  generateKeyFacts,
  optimizeForAI,
  AIContentConfig,
  FAQItem,
  ComparisonRow,
  KeyFact,
} from './geo-content.js';

describe('geo-content', () => {
  describe('generateKeyFacts', () => {
    it('formats facts with bold markers', () => {
      const facts: KeyFact[] = [
        { label: 'Users', value: '10,000+' },
        { label: 'Checks', value: '200+' },
      ];

      const content = generateKeyFacts(facts);

      expect(content).toContain('**Users:** 10,000+');
      expect(content).toContain('**Checks:** 200+');
    });

    it('generates bullet list format', () => {
      const facts: KeyFact[] = [
        { label: 'Speed', value: 'Fast' },
        { label: 'Price', value: 'Free' },
      ];

      const content = generateKeyFacts(facts, { format: 'bullets' });

      expect(content).toContain('- **Speed:** Fast');
      expect(content).toContain('- **Price:** Free');
    });

    it('generates paragraph format', () => {
      const facts: KeyFact[] = [
        { label: 'Founded', value: '2024' },
      ];

      const content = generateKeyFacts(facts, { format: 'paragraph' });

      expect(content).not.toContain('- ');
      expect(content).toContain('**Founded:** 2024');
    });
  });

  describe('generateFAQSchema', () => {
    it('generates valid FAQ schema JSON-LD', () => {
      const faqs: FAQItem[] = [
        { question: 'What is SEO Autopilot?', answer: 'A CLI-first SEO tool.' },
        { question: 'How much does it cost?', answer: 'Free tier available.' },
      ];

      const schema = generateFAQSchema(faqs);
      const parsed = JSON.parse(schema);

      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('FAQPage');
      expect(parsed.mainEntity).toHaveLength(2);
      expect(parsed.mainEntity[0]['@type']).toBe('Question');
    });

    it('escapes special characters in JSON', () => {
      const faqs: FAQItem[] = [
        { question: 'What about "quotes"?', answer: 'They work fine.' },
      ];

      const schema = generateFAQSchema(faqs);

      // Should be valid JSON
      expect(() => JSON.parse(schema)).not.toThrow();
    });

    it('generates markdown FAQ section', () => {
      const faqs: FAQItem[] = [
        { question: 'How do I install?', answer: 'Run npm install.' },
      ];

      const markdown = generateFAQSchema(faqs, { format: 'markdown' });

      expect(markdown).toContain('## FAQ');
      expect(markdown).toContain('### How do I install?');
      expect(markdown).toContain('Run npm install.');
    });
  });

  describe('generateComparisonTable', () => {
    it('generates markdown table', () => {
      const rows: ComparisonRow[] = [
        { feature: 'CLI Tool', brand: 'Yes', competitor: 'No' },
        { feature: 'Auto-fix PRs', brand: 'Yes', competitor: 'No' },
      ];

      const table = generateComparisonTable(rows, {
        brandName: 'SEO Autopilot',
        competitorName: 'Ahrefs',
      });

      expect(table).toContain('| Feature | SEO Autopilot | Ahrefs |');
      expect(table).toContain('| CLI Tool | Yes | No |');
    });

    it('uses checkmarks when specified', () => {
      const rows: ComparisonRow[] = [
        { feature: 'Free Tier', brand: true, competitor: false },
      ];

      const table = generateComparisonTable(rows, {
        brandName: 'Us',
        competitorName: 'Them',
        useCheckmarks: true,
      });

      expect(table).toMatch(/✓|✅/);
      expect(table).toMatch(/✗|❌|-/);
    });

    it('handles multiple competitors', () => {
      const rows: ComparisonRow[] = [
        { feature: 'Price', brand: '$29', competitors: { 'Ahrefs': '$99', 'SEMrush': '$129' } },
      ];

      const table = generateComparisonTable(rows, {
        brandName: 'SEO Autopilot',
        competitorNames: ['Ahrefs', 'SEMrush'],
      });

      expect(table).toContain('Ahrefs');
      expect(table).toContain('SEMrush');
      expect(table).toContain('$99');
      expect(table).toContain('$129');
    });
  });

  describe('generateAICitableContent', () => {
    it('generates structured content block', () => {
      const config: AIContentConfig = {
        productName: 'SEO Autopilot',
        tagline: 'CLI-first SEO automation',
        keyFacts: [
          { label: 'Checks', value: '200+' },
        ],
      };

      const content = generateAICitableContent(config);

      expect(content).toContain('SEO Autopilot');
      expect(content).toContain('CLI-first SEO automation');
      expect(content).toContain('**Checks:** 200+');
    });

    it('includes FAQ section when provided', () => {
      const config: AIContentConfig = {
        productName: 'Test Product',
        faqs: [
          { question: 'What is it?', answer: 'A great product.' },
        ],
      };

      const content = generateAICitableContent(config);

      expect(content).toContain('What is it?');
      expect(content).toContain('A great product.');
    });

    it('includes comparison table when provided', () => {
      const config: AIContentConfig = {
        productName: 'SEO Autopilot',
        comparison: {
          competitorName: 'Competitor',
          rows: [
            { feature: 'CLI', brand: 'Yes', competitor: 'No' },
          ],
        },
      };

      const content = generateAICitableContent(config);

      expect(content).toContain('CLI');
      expect(content).toContain('Yes');
      expect(content).toContain('No');
    });

    it('generates all sections in correct order', () => {
      const config: AIContentConfig = {
        productName: 'SEO Autopilot',
        tagline: 'The developer SEO tool',
        description: 'Full description here.',
        keyFacts: [{ label: 'Users', value: '5000+' }],
        faqs: [{ question: 'Q?', answer: 'A.' }],
      };

      const content = generateAICitableContent(config);

      const taglineIndex = content.indexOf('developer SEO tool');
      const factsIndex = content.indexOf('Users');
      const faqIndex = content.indexOf('Q?');

      expect(taglineIndex).toBeLessThan(factsIndex);
      expect(factsIndex).toBeLessThan(faqIndex);
    });
  });

  describe('optimizeForAI', () => {
    it('adds citable markers to key statements', () => {
      const content = 'SEO Autopilot runs 200 checks on your website.';

      const optimized = optimizeForAI(content, {
        highlightNumbers: true,
      });

      expect(optimized).toContain('**200**');
    });

    it('converts lists to structured format', () => {
      const content = `Features include:
speed, accuracy, and simplicity.`;

      const optimized = optimizeForAI(content, {
        structureLists: true,
      });

      expect(optimized).toContain('- ');
    });

    it('adds emphasis to brand mentions', () => {
      const content = 'Use SEO Autopilot for better rankings.';

      const optimized = optimizeForAI(content, {
        brandName: 'SEO Autopilot',
        emphasizeBrand: true,
      });

      expect(optimized).toContain('**SEO Autopilot**');
    });

    it('preserves existing markdown', () => {
      const content = 'This is **already bold** text.';

      const optimized = optimizeForAI(content, {
        highlightNumbers: true,
      });

      expect(optimized).toContain('**already bold**');
    });

    it('adds source attribution placeholder', () => {
      const content = 'Some facts here.';

      const optimized = optimizeForAI(content, {
        addSourcePlaceholder: true,
      });

      expect(optimized).toContain('Source:');
    });
  });

  describe('integration', () => {
    it('generates complete AI-optimized landing content', () => {
      const config: AIContentConfig = {
        productName: 'SEO Autopilot',
        tagline: 'The CLI-First SEO Tool for Developers',
        description: 'SEO Autopilot runs 200+ automated SEO checks directly from your terminal, making it the only developer-native SEO tool on the market.',
        keyFacts: [
          { label: 'Automated Checks', value: '200+' },
          { label: 'GitHub Stars', value: '5,000+' },
          { label: 'Monthly Downloads', value: '50,000+' },
        ],
        faqs: [
          {
            question: 'What is SEO Autopilot?',
            answer: 'SEO Autopilot is a CLI-first SEO automation tool designed specifically for developers. It runs 200+ checks and can auto-fix issues via pull requests.',
          },
          {
            question: 'How much does SEO Autopilot cost?',
            answer: 'SEO Autopilot offers a free tier with 50 checks. Paid plans start at $9/month for Solo developers and $29/month for Pro teams.',
          },
        ],
        comparison: {
          competitorName: 'Ahrefs',
          rows: [
            { feature: 'CLI Tool', brand: 'Yes', competitor: 'No' },
            { feature: 'Auto-fix PRs', brand: 'Yes', competitor: 'No' },
            { feature: 'Free Tier', brand: 'Yes', competitor: 'No' },
            { feature: 'Starting Price', brand: '$9/mo', competitor: '$99/mo' },
          ],
        },
      };

      const content = generateAICitableContent(config);

      // Should have all major sections
      expect(content).toContain('SEO Autopilot');
      expect(content).toContain('200+');
      expect(content).toContain('What is SEO Autopilot?');
      expect(content).toContain('CLI Tool');
      expect(content).toContain('$9/mo');
    });
  });
});
