/**
 * Ignore rules from the config file: a code, a page pattern, or both.
 *
 *   "LLMS_TXT_MISSING"                              this code, everywhere
 *   { "code": "IMG_ALT_MISSING", "url": "/blog/*" } this code on these pages
 *   { "url": "/drafts/**" }                         every finding on these pages
 *
 * Patterns are globs: `*` matches within one path segment, `**` across segments. A pattern
 * that starts with http(s):// matches the whole URL; any other pattern matches the path.
 */
import type { AuditIssue } from '../types.js';
import { pagePath } from './baseline.js';

export type IgnoreRule = string | { code?: string; url?: string; reason?: string };

export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; }
      else re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`, 'i');
}

interface CompiledRule {
  code?: RegExp;
  url?: RegExp;
  /** The url pattern matches the whole URL, not just the path. */
  wholeUrl: boolean;
}

export function compileIgnoreRules(rules: unknown): { rules: CompiledRule[]; errors: string[] } {
  const compiled: CompiledRule[] = [];
  const errors: string[] = [];
  if (rules === undefined || rules === null) return { rules: compiled, errors };
  if (!Array.isArray(rules)) return { rules: compiled, errors: ['ignore must be an array of codes or { code, url } objects'] };
  rules.forEach((rule, i) => {
    if (typeof rule === 'string') {
      if (!rule.trim()) errors.push(`ignore[${i}] is empty`);
      else compiled.push({ code: globToRegExp(rule.trim()), wholeUrl: false });
      return;
    }
    if (!rule || typeof rule !== 'object') { errors.push(`ignore[${i}] must be a code or a { code, url } object`); return; }
    const { code, url } = rule as { code?: unknown; url?: unknown };
    if (code !== undefined && typeof code !== 'string') { errors.push(`ignore[${i}].code must be a string`); return; }
    if (url !== undefined && typeof url !== 'string') { errors.push(`ignore[${i}].url must be a string`); return; }
    if (!code && !url) { errors.push(`ignore[${i}] needs a code, a url, or both`); return; }
    const wholeUrl = !!url && /^https?:\/\//i.test(url);
    const pattern = url ? (wholeUrl ? url.replace(/\/+$/, '') : url.startsWith('/') ? url : `/${url}`) : undefined;
    compiled.push({
      code: code ? globToRegExp(code.trim()) : undefined,
      url: pattern ? globToRegExp(pattern) : undefined,
      wholeUrl,
    });
  });
  return { rules: compiled, errors };
}

function matchesUrl(rule: CompiledRule, url: string): boolean {
  if (!rule.url) return true;
  return rule.wholeUrl ? rule.url.test(url.replace(/\/+$/, '')) : rule.url.test(pagePath(url).split('?')[0]);
}

export interface IgnoredFinding {
  code: string;
  /** The pages it was ignored on; absent when the code was ignored everywhere. */
  urls?: string[];
}

export interface IgnoreResult {
  issues: AuditIssue[];
  ignored: IgnoredFinding[];
}

/** Remove the findings the rules name; what was removed is reported, never silently dropped. */
export function applyIgnores(issues: AuditIssue[], rules: IgnoreRule[] | undefined): IgnoreResult {
  const { rules: compiled } = compileIgnoreRules(rules);
  if (compiled.length === 0) return { issues, ignored: [] };
  const kept: AuditIssue[] = [];
  const ignored: IgnoredFinding[] = [];
  for (const issue of issues) {
    const forCode = compiled.filter(r => !r.code || r.code.test(issue.code));
    if (forCode.length === 0) { kept.push(issue); continue; }
    if (forCode.some(r => !r.url)) { ignored.push({ code: issue.code }); continue; }
    const urls = issue.affectedUrls ?? [];
    if (urls.length === 0) { kept.push(issue); continue; } // a page rule cannot match a finding that names no page
    const remaining = urls.filter(u => !forCode.some(r => matchesUrl(r, u)));
    if (remaining.length === urls.length) kept.push(issue);
    else if (remaining.length === 0) ignored.push({ code: issue.code, urls });
    else {
      kept.push({ ...issue, affectedUrls: remaining });
      ignored.push({ code: issue.code, urls: urls.filter(u => !remaining.includes(u)) });
    }
  }
  return { issues: kept, ignored };
}
