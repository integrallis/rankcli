import { describe, it, expect } from 'vitest';
import { parseContentSignal } from './ai-readiness.js';

describe('parseContentSignal', () => {
  it('returns null when no Content-Signal line is present', () => {
    const robots = 'User-agent: *\nDisallow: /admin\n';
    expect(parseContentSignal(robots)).toBeNull();
  });

  it('extracts a standalone Content-Signal line', () => {
    const robots = 'User-agent: *\nContent-Signal: search=yes,ai-train=no,use=reference\nDisallow:\n';
    expect(parseContentSignal(robots)).toBe('search=yes,ai-train=no,use=reference');
  });

  it('is case-insensitive on the directive name', () => {
    const robots = 'content-SIGNAL: ai-train=no\n';
    expect(parseContentSignal(robots)).toBe('ai-train=no');
  });

  it('trims surrounding whitespace but preserves the value casing', () => {
    const robots = '  Content-Signal:   Search=Yes,AI-Train=No  \n';
    expect(parseContentSignal(robots)).toBe('Search=Yes,AI-Train=No');
  });

  it('returns the first Content-Signal line when multiple are present', () => {
    const robots = 'Content-Signal: search=yes\nContent-Signal: ai-train=no\n';
    expect(parseContentSignal(robots)).toBe('search=yes');
  });

  it('returns null for an empty robots.txt', () => {
    expect(parseContentSignal('')).toBeNull();
  });
});
