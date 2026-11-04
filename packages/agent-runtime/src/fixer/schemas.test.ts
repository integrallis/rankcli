import { describe, it, expect } from 'vitest';
import { pageSchemaGraph, pageSchemaBlock } from './schemas.js';

describe('pageSchemaGraph', () => {
  // rankcli #20: the agent fixer dispatches NO_ORGANIZATION_SCHEMA and NO_ENTITY_SCHEMA to
  // the generic schema fix. Neither check accepts a WebSite or WebPage, so a block without
  // an Organization reports success and leaves the issue exactly where it was.
  it('always includes an Organization, which is what the entity checks look for', () => {
    const graph = pageSchemaGraph({ siteName: 'Example', siteUrl: 'https://example.com' });
    expect(graph.map(n => n['@type'])).toContain('Organization');
  });

  it('is a WebSite at the root', () => {
    const [primary] = pageSchemaGraph({ siteName: 'Example', siteUrl: 'https://example.com' });
    expect(primary['@type']).toBe('WebSite');
    expect(primary.url).toBe('https://example.com');
  });

  it('is a WebPage on a deeper page, pointing back at the site', () => {
    const [primary] = pageSchemaGraph({
      siteName: 'Example',
      siteUrl: 'https://example.com',
      pageUrl: 'https://example.com/research.html',
      pageTitle: 'Research — Example',
    });
    expect(primary['@type']).toBe('WebPage');
    expect(primary.name).toBe('Research — Example');
    expect(primary.isPartOf).toEqual({ '@type': 'WebSite', name: 'Example', url: 'https://example.com' });
  });

  it('states nothing the page did not: no SoftwareApplication, no Offer, no price', () => {
    const json = JSON.stringify(pageSchemaGraph({
      siteName: 'Example',
      siteUrl: 'https://example.com',
      pageUrl: 'https://example.com/products.html',
      pageTitle: 'Products',
      description: 'What we make.',
    }));
    expect(json).not.toContain('SoftwareApplication');
    expect(json).not.toContain('Offer');
    expect(json).not.toContain('priceCurrency');
    expect(json).not.toContain('applicationCategory');
  });

  it('omits an absent description rather than inventing one', () => {
    const [primary] = pageSchemaGraph({ siteName: 'Example', siteUrl: 'https://example.com' });
    expect(primary).not.toHaveProperty('description');
  });

  it('falls back to the site name when the page has no title', () => {
    const [primary] = pageSchemaGraph({ siteName: 'Example', siteUrl: 'https://example.com', pageTitle: '   ' });
    expect(primary.name).toBe('Example');
  });

  it('renders a block both fixer paths can insert into <head>', () => {
    const block = pageSchemaBlock({ siteName: 'Example', siteUrl: 'https://example.com' });
    expect(block).toContain('<script type="application/ld+json">');
    expect(block.trimEnd()).toMatch(/<\/script>$/);
    expect(JSON.parse(block.replace(/^[\s\S]*?<script type="application\/ld\+json">/, '').replace(/<\/script>[\s\S]*$/, ''))).toHaveLength(2);
  });
});
