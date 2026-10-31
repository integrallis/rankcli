/**
 * rankcli.config.json. The schema, the loader and the settings resolution live in the engine
 * (packages/agent-runtime/src/audit/project-config.ts) so the GitHub Action reads the file the
 * same way; this file keeps the two helpers `init` and the commands use.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectConfig } from '@rankcli/agent-runtime';

// A plain constant here, not a re-export: `fix` and `apply` read the file through
// configuredUrl(), and their tests mock the whole runtime module.
export const PROJECT_CONFIG_FILE = 'rankcli.config.json';

export {
  expandEnv,
  validateProjectConfig,
  loadProjectConfig,
  loadBaselineFile,
  parseHeaderOptions,
  resolveAuditSettings,
  type ProjectConfig,
  type LoadedConfig,
  type AuditSettings,
  type AuditSettingsInput,
} from '@rankcli/agent-runtime';

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
 * rankcli.config.json.
 */
export function configuredUrl(cwd: string = process.cwd()): string | null {
  const url = readProjectConfig(cwd)?.url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}
