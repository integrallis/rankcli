import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What `rankcli init` writes to rankcli.config.json. Every field is optional on read. */
export interface ProjectConfig {
  name?: string;
  framework?: string | null;
  url?: string | null;
  githubRepo?: string | null;
  initialized?: string;
}

export const PROJECT_CONFIG_FILE = 'rankcli.config.json';

/** The project's rankcli.config.json, or null when there is none or it does not parse. */
export function readProjectConfig(cwd: string = process.cwd()): ProjectConfig | null {
  const path = join(cwd, PROJECT_CONFIG_FILE);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    return parsed && typeof parsed === 'object' ? (parsed as ProjectConfig) : null;
  } catch {
    return null;
  }
}

/**
 * The URL a command falls back to when `--url` is not given: the `url` in the project's
 * rankcli.config.json. `rankcli init` wrote that file and `audit` then ignored it, so
 * `init` had no payoff for the one command people run most.
 */
export function configuredUrl(cwd: string = process.cwd()): string | null {
  const url = readProjectConfig(cwd)?.url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}
