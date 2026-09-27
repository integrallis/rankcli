import { describe, it, expect } from 'vitest';
import { buildFrameworkGuidance } from './framework-guidance.js';
import { loadRecipe } from '../frameworks/suggestion-engine.js';
import '../frameworks/embedded-recipes.generated.js';

const recipe = {
  framework: 'nextjs' as const,
  display_name: 'Next.js',
  category: 'meta-framework',
  ssr_default: true,
  seo_challenges: ['Client components lose metadata'],
  checks: [
    { code: 'A_CODE', severity: 'warning', title: 'Alpha', description: 'a desc', howToFix: 'do A' },
    { code: 'B_CODE', severity: 'warning', title: 'Beta', description: 'b desc', howToFix: 'do B' },
    { code: 'C_CODE', severity: 'warning', title: 'Gamma', description: 'c desc', howToFix: 'do C' },
  ],
} as never;

describe('buildFrameworkGuidance', () => {
  it('is empty without a recipe', () => {
    expect(buildFrameworkGuidance(null)).toBe('');
    expect(buildFrameworkGuidance(undefined)).toBe('');
  });

  it('leads with what the framework is and its traps', () => {
    const out = buildFrameworkGuidance(recipe);
    expect(out).toContain('## Next.js conventions');
    expect(out).toContain('Renders on the server by default: yes');
    expect(out).toContain('Client components lose metadata');
  });

  // A tight budget should be spent on what is actually wrong with this site.
  it('puts the reported issues first', () => {
    const out = buildFrameworkGuidance(recipe, { issueCodes: ['C_CODE'], maxChars: 10_000 });
    expect(out.indexOf('Gamma')).toBeGreaterThan(-1);
    expect(out.indexOf('Gamma')).toBeLessThan(out.indexOf('Alpha'));
  });

  it('drops the unreported ones first when the budget is tight', () => {
    const tight = buildFrameworkGuidance(recipe, { issueCodes: ['C_CODE'], maxChars: 220 });
    expect(tight).toContain('Gamma');
    expect(tight).toMatch(/more Next\.js checks omitted/);
  });

  it('stays inside its budget and says what it left out', () => {
    const out = buildFrameworkGuidance(recipe, { maxChars: 300 });
    expect(out.length).toBeLessThanOrEqual(400); // budget + the omitted-count line
    expect(out).toMatch(/more Next\.js checks omitted/);
  });

  // Half a code snippet is worse than none: a title and its fix travel together.
  it('never truncates mid-check', () => {
    for (const budget of [150, 200, 260, 320, 500, 1000]) {
      const out = buildFrameworkGuidance(recipe, { maxChars: budget });
      for (const [title, fix] of [['Alpha', 'do A'], ['Beta', 'do B'], ['Gamma', 'do C']]) {
        expect(out.includes(title), `budget ${budget}: ${title} without ${fix}`).toBe(out.includes(fix));
      }
    }
  });

  it('includes everything when the budget allows', () => {
    const out = buildFrameworkGuidance(recipe, { maxChars: 10_000 });
    expect(out).toContain('do A');
    expect(out).toContain('do B');
    expect(out).toContain('do C');
    expect(out).not.toMatch(/omitted/);
  });

  // The real recipes, not a fixture: this is what the prompt will actually carry.
  it('builds usable guidance from the shipped recipes', async () => {
    for (const framework of ['nextjs', 'react', 'astro', 'wordpress'] as const) {
      const real = await loadRecipe(framework);
      expect(real, `${framework} recipe should load`).toBeTruthy();
      const out = buildFrameworkGuidance(real, { issueCodes: [], maxChars: 4000 });
      expect(out).toContain('conventions');
      expect(out.length).toBeLessThanOrEqual(4200);
      expect(out.length).toBeGreaterThan(100);
    }
  });
});
