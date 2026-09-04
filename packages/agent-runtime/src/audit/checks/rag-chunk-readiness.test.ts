import { describe, it, expect } from 'vitest';
import { analyzeRAGChunkReadiness } from './rag-chunk-readiness.js';

const testUrl = 'https://example.com';

function words(n: number, prefix = 'word'): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
}

describe('analyzeRAGChunkReadiness', () => {
  it('returns zero sections and score 0 for a page with no headings', () => {
    const html = `<html><body><p>${words(200)}</p></body></html>`;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.totalSections).toBe(0);
    expect(data.chunkReadinessScore).toBe(0);
  });

  it('classifies a well-sized section (150-450 words) as good', () => {
    const html = `<html><body><h2>Topic</h2><p>${words(300)}</p></body></html>`;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.totalSections).toBe(1);
    expect(data.sections[0].wordCount).toBe(300);
    expect(data.sections[0].sizeQuality).toBe('good');
  });

  it('classifies a very short section as too-short', () => {
    const html = `<html><body><h2>Topic</h2><p>${words(20)}</p></body></html>`;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.sections[0].sizeQuality).toBe('too-short');
  });

  it('classifies a very long section as too-long', () => {
    const html = `<html><body><h2>Topic</h2><p>${words(800)}</p></body></html>`;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.sections[0].sizeQuality).toBe('too-long');
  });

  it('splits content into sections at each h1/h2/h3, regardless of nesting depth', () => {
    // Deliberately nested in wrapper divs — a sibling-only DOM walk would
    // fail to associate the paragraphs with their heading here; document
    // order should still get this right.
    const html = `
      <html><body>
        <div class="section-wrapper">
          <div class="inner"><h2>First</h2></div>
          <div class="content"><p>${words(200, 'a')}</p></div>
        </div>
        <div class="section-wrapper">
          <div class="inner"><h2>Second</h2></div>
          <div class="content"><p>${words(200, 'b')}</p></div>
        </div>
      </body></html>
    `;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.totalSections).toBe(2);
    expect(data.sections[0].heading).toBe('First');
    expect(data.sections[0].wordCount).toBe(200);
    expect(data.sections[1].heading).toBe('Second');
    expect(data.sections[1].wordCount).toBe(200);
  });

  it('accumulates multiple paragraphs and list items under one heading', () => {
    const html = `
      <html><body>
        <h2>Topic</h2>
        <p>${words(100, 'a')}</p>
        <p>${words(100, 'b')}</p>
        <ul><li>${words(50, 'c')}</li><li>${words(50, 'd')}</li></ul>
      </body></html>
    `;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.totalSections).toBe(1);
    expect(data.sections[0].wordCount).toBe(300);
  });

  it('content before the first heading is not attributed to any section', () => {
    const html = `
      <html><body>
        <p>${words(500)}</p>
        <h2>Topic</h2>
        <p>${words(200)}</p>
      </body></html>
    `;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.totalSections).toBe(1);
    expect(data.sections[0].wordCount).toBe(200);
  });

  it('detects a dangling-reference opener', () => {
    const html = `<html><body><h2>Topic</h2><p>This approach reduces cost significantly. ${words(150)}</p></body></html>`;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.sections[0].startsWithDanglingReference).toBe(true);
  });

  it('does not flag a section that names its subject', () => {
    const html = `<html><body><h2>Topic</h2><p>Caching reduces cost significantly. ${words(150)}</p></body></html>`;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.sections[0].startsWithDanglingReference).toBe(false);
  });

  it('raises RAG_CHUNK_SIZE_MISMATCH when most sections are poorly sized', () => {
    const html = `
      <html><body>
        <h2>One</h2><p>${words(20)}</p>
        <h2>Two</h2><p>${words(900)}</p>
        <h2>Three</h2><p>${words(15)}</p>
      </body></html>
    `;
    const { issues } = analyzeRAGChunkReadiness(html, testUrl);
    expect(issues.some((i) => i.code === 'RAG_CHUNK_SIZE_MISMATCH')).toBe(true);
  });

  it('does not raise RAG_CHUNK_SIZE_MISMATCH when most sections are well-sized', () => {
    const html = `
      <html><body>
        <h2>One</h2><p>${words(200)}</p>
        <h2>Two</h2><p>${words(250)}</p>
        <h2>Three</h2><p>${words(300)}</p>
      </body></html>
    `;
    const { issues } = analyzeRAGChunkReadiness(html, testUrl);
    expect(issues.some((i) => i.code === 'RAG_CHUNK_SIZE_MISMATCH')).toBe(false);
  });

  it('raises RAG_CHUNK_DANGLING_REFERENCES when over 30% of sections open with one', () => {
    const html = `
      <html><body>
        <h2>One</h2><p>This reduces cost. ${words(150)}</p>
        <h2>Two</h2><p>It also improves speed. ${words(150)}</p>
        <h2>Three</h2><p>Caching is the mechanism. ${words(150)}</p>
      </body></html>
    `;
    const { issues } = analyzeRAGChunkReadiness(html, testUrl);
    expect(issues.some((i) => i.code === 'RAG_CHUNK_DANGLING_REFERENCES')).toBe(true);
  });

  it('does not raise issues for a page with too few sections to judge (under 3)', () => {
    const html = `<html><body><h2>One</h2><p>${words(20)}</p><h2>Two</h2><p>${words(900)}</p></body></html>`;
    const { issues } = analyzeRAGChunkReadiness(html, testUrl);
    expect(issues.length).toBe(0);
  });

  it('computes a chunkReadinessScore of 100 when all sections are good and self-contained', () => {
    const html = `
      <html><body>
        <h2>One</h2><p>Caching reduces latency. ${words(200)}</p>
        <h2>Two</h2><p>Compression reduces bandwidth. ${words(200)}</p>
      </body></html>
    `;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.chunkReadinessScore).toBe(100);
  });

  it('estimates tokens at roughly 1.33 tokens per word', () => {
    const html = `<html><body><h2>Topic</h2><p>${words(300)}</p></body></html>`;
    const { data } = analyzeRAGChunkReadiness(html, testUrl);
    expect(data.sections[0].estimatedTokens).toBe(399); // round(300 * 1.33)
  });
});
