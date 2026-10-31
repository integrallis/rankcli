/**
 * rankcli.config.json and the settings an audit runs with, shared by the CLI and the GitHub
 * Action so a gate reads the same way in both. `rankcli init` writes the first four fields;
 * the rest are the CI plumbing. Flags (or Action inputs) win over the file. Every field is
 * optional.
 *
 * {
 *   "url": "https://example.com",
 *   "maxPages": 5,
 *   "checkLinks": false,
 *   "failOn": ["error", "score:aiReadiness<70"],
 *   "minScore": 80,
 *   "budgets": { "crawlability": 90 },
 *   "baseline": ".rankcli/baseline.json",
 *   "ignore": ["LLMS_TXT_MISSING", { "code": "IMG_ALT_MISSING", "url": "/blog/*" }],
 *   "headers": { "x-vercel-protection-bypass": "${VERCEL_BYPASS}" },
 *   "dir": "dist"
 * }
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { parseFailOn, parseBudgets, mergeGateSpecs, type GateSpec } from './ci/gate.js';
import { compileIgnoreRules, type IgnoreRule } from './ci/ignore.js';
import { readBaseline, type BaselineReport } from './ci/baseline.js';

export interface ProjectConfig {
  name?: string;
  framework?: string | null;
  url?: string | null;
  githubRepo?: string | null;
  initialized?: string;
  /** Pages to audit, counting the URL itself. */
  maxPages?: number;
  checkLinks?: boolean;
  /** Gate rules in the `--fail-on` syntax: "error", "score<80", "score:aiReadiness<70". */
  failOn?: string | string[];
  minScore?: number;
  /** Minimum category scores: { "aiReadiness": 70 }. */
  budgets?: Record<string, number>;
  /** A saved JSON report; the severity gate then counts only findings that are not in it. */
  baseline?: string;
  ignore?: IgnoreRule[];
  /** Sent with every request to the site. Values may use ${ENV_VAR}. */
  headers?: Record<string, string>;
  /** A build directory to audit instead of the live site. */
  dir?: string;
}

export const PROJECT_CONFIG_FILE = 'rankcli.config.json';

export interface LoadedConfig {
  config: ProjectConfig;
  /** The file it came from. */
  path: string;
}

/** `${NAME}` in a config value is read from the environment, so tokens stay out of the file. */
export function expandEnv(value: string): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => process.env[name] ?? '');
}

/** What is wrong with a config object, as messages; empty when it is fine. */
export function validateProjectConfig(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['the file must contain a JSON object'];
  const c = raw as Record<string, unknown>;
  const errors: string[] = [];
  const isString = (v: unknown) => typeof v === 'string';
  if (c.url !== undefined && c.url !== null && !isString(c.url)) errors.push('url must be a string');
  if (c.maxPages !== undefined && (!Number.isInteger(c.maxPages) || (c.maxPages as number) < 1)) errors.push('maxPages must be a whole number of 1 or more');
  if (c.checkLinks !== undefined && typeof c.checkLinks !== 'boolean') errors.push('checkLinks must be true or false');
  if (c.failOn !== undefined) {
    if (!isString(c.failOn) && !(Array.isArray(c.failOn) && c.failOn.every(isString))) errors.push('failOn must be a string or an array of strings');
    else {
      const { error } = parseFailOn(c.failOn as string | string[]);
      if (error) errors.push(`failOn: ${error}`);
    }
  }
  if (c.minScore !== undefined && (typeof c.minScore !== 'number' || c.minScore < 0 || c.minScore > 100)) errors.push('minScore must be a number from 0 to 100');
  if (c.budgets !== undefined) {
    const { error } = parseBudgets(c.budgets);
    if (error) errors.push(error);
  }
  if (c.baseline !== undefined && !isString(c.baseline)) errors.push('baseline must be a file path');
  if (c.ignore !== undefined) errors.push(...compileIgnoreRules(c.ignore).errors);
  if (c.headers !== undefined) {
    if (!c.headers || typeof c.headers !== 'object' || Array.isArray(c.headers) || !Object.values(c.headers as object).every(isString)) {
      errors.push('headers must be an object of header names to string values');
    }
  }
  if (c.dir !== undefined && !isString(c.dir)) errors.push('dir must be a directory path');
  return errors;
}

/**
 * Load the project's config: the given file, or rankcli.config.json in `cwd` when it exists.
 * A file that is named, missing, unparsable or invalid is an error, never silently ignored:
 * a gate that is not applied is a green build on a broken site.
 */
export function loadProjectConfig(cwd: string = process.cwd(), file?: string): { loaded: LoadedConfig | null; error?: string } {
  const path = file ? (isAbsolute(file) ? file : join(cwd, file)) : join(cwd, PROJECT_CONFIG_FILE);
  if (!existsSync(path)) {
    return file ? { loaded: null, error: `Config file not found: ${file}` } : { loaded: null };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    return { loaded: null, error: `${file ?? PROJECT_CONFIG_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const errors = validateProjectConfig(raw);
  if (errors.length) return { loaded: null, error: `${file ?? PROJECT_CONFIG_FILE}: ${errors.join('; ')}` };
  return { loaded: { config: raw as ProjectConfig, path } };
}

/** "Name: value" strings (--header) and "name=value" strings (--cookie) as a header map. */
export function parseHeaderOptions(headers: string[] = [], cookies: string[] = []): { headers: Record<string, string>; error?: string } {
  const out: Record<string, string> = {};
  for (const raw of headers) {
    const i = raw.indexOf(':');
    const name = i > 0 ? raw.slice(0, i).trim() : '';
    if (!name) return { headers: out, error: `Invalid header "${raw}" (use "Name: value")` };
    out[name] = raw.slice(i + 1).trim();
  }
  const cookie = cookies.map(c => c.trim()).filter(Boolean);
  const bad = cookie.find(c => !c.includes('='));
  if (bad !== undefined) return { headers: out, error: `Invalid cookie "${bad}" (use "name=value")` };
  if (cookie.length) {
    const existing = Object.keys(out).find(k => k.toLowerCase() === 'cookie');
    const joined = [existing ? out[existing] : '', ...cookie].filter(Boolean).join('; ');
    if (existing) delete out[existing];
    out.Cookie = joined;
  }
  return { headers: out };
}

/** What a caller passes in: flags, Action inputs. Strings, the way they arrive. */
export interface AuditSettingsInput {
  url?: string;
  dir?: string;
  maxPages?: string | number;
  checkLinks?: boolean;
  failOn?: string | string[];
  minScore?: string | number;
  baseline?: string;
  /** "Name: value" lines. */
  header?: string[];
  /** "name=value" strings. */
  cookie?: string[];
  /** The config file; default: rankcli.config.json in cwd when it exists. */
  config?: string;
}

/** Everything an audit runs with, after the input and the config file are reconciled. Input wins. */
export interface AuditSettings {
  url?: string;
  dir?: string;
  maxPages: number;
  checkLinks: boolean;
  spec: GateSpec;
  baselineFile?: string;
  headers: Record<string, string>;
  ignore?: IgnoreRule[];
  config?: ProjectConfig;
  configPath?: string;
}

export function resolveAuditSettings(input: AuditSettingsInput, cwd: string = process.cwd()): { settings?: AuditSettings; error?: string } {
  const { loaded, error: configError } = loadProjectConfig(cwd, input.config);
  if (configError) return { error: configError };
  const config = loaded?.config ?? {};

  const rules = parseFailOn(input.failOn ?? config.failOn);
  if (rules.error) return { error: `Invalid fail-on rule: ${rules.error}` };
  const minScoreRaw = input.minScore ?? config.minScore;
  let minScore: GateSpec = { budgets: [] };
  if (minScoreRaw !== undefined && String(minScoreRaw).trim() !== '') {
    const n = Number(String(minScoreRaw).trim());
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: `Invalid min-score "${minScoreRaw}" (use a number from 0 to 100)` };
    minScore = { budgets: [{ category: 'overall', min: n }] };
  }
  const spec = mergeGateSpecs(rules.spec, minScore, parseBudgets(config.budgets).spec);

  const fromInput = parseHeaderOptions(input.header, input.cookie);
  if (fromInput.error) return { error: fromInput.error };
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(config.headers ?? {})) headers[name] = expandEnv(value);
  Object.assign(headers, fromInput.headers);

  const maxPagesRaw = input.maxPages ?? config.maxPages;
  const maxPages = Math.max(1, parseInt(String(maxPagesRaw ?? '5'), 10) || 5);

  return {
    settings: {
      url: String(input.url || config.url || '').trim() || undefined,
      dir: input.dir || config.dir || undefined,
      maxPages,
      checkLinks: !!input.checkLinks || !!config.checkLinks,
      spec,
      baselineFile: input.baseline || config.baseline || undefined,
      headers,
      ignore: config.ignore,
      config: loaded?.config,
      configPath: loaded?.path,
    },
  };
}

/** A baseline file, read and checked. */
export function loadBaselineFile(file: string, cwd: string = process.cwd()): { baseline?: BaselineReport & { file: string }; error?: string } {
  const path = isAbsolute(file) ? file : join(cwd, file);
  if (!existsSync(path)) return { error: `Baseline file not found: ${file} (save one with: rankcli audit -o json > ${file})` };
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    return { error: `Baseline ${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const read = readBaseline(doc);
  if ('error' in read) return { error: `Baseline ${file}: ${read.error}` };
  return { baseline: { ...read, file } };
}
