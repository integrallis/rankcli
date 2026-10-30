import { describe, it, expect } from 'vitest';
import { parseGitHubRepo } from './init.js';

describe('parseGitHubRepo', () => {
  it('parses an SSH remote URL', () => {
    expect(parseGitHubRepo('git@github.com:integrallis/rankcli-mcp-server.git')).toBe(
      'integrallis/rankcli-mcp-server'
    );
  });

  it('parses an HTTPS remote URL', () => {
    expect(parseGitHubRepo('https://github.com/integrallis/rankcli-mcp-server.git')).toBe(
      'integrallis/rankcli-mcp-server'
    );
  });

  it('parses an HTTPS remote URL without a .git suffix', () => {
    expect(parseGitHubRepo('https://github.com/integrallis/rankcli-mcp-server')).toBe(
      'integrallis/rankcli-mcp-server'
    );
  });

  it('does not truncate repo names that contain a dot', () => {
    // Regression: a naive [^/.]+ repo pattern stops at the first dot,
    // mis-parsing this exact repo as "integrallis/rankcli" instead of
    // "integrallis/rankcli.dev".
    expect(parseGitHubRepo('git@github.com:integrallis/rankcli.dev.git')).toBe(
      'integrallis/rankcli.dev'
    );
    expect(parseGitHubRepo('https://github.com/integrallis/rankcli.dev')).toBe(
      'integrallis/rankcli.dev'
    );
  });

  it('returns null for a non-GitHub remote', () => {
    expect(parseGitHubRepo('git@gitlab.com:integrallis/rankcli.git')).toBeNull();
  });
});
