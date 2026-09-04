/**
 * Agent Experience (AX) readiness
 *
 * Classic GEO asks "can an AI crawler read this page and cite it in an
 * answer?" — that's what ai-readiness.ts covers. AX asks a different
 * question: "can an AI AGENT (not just a chatbot) discover what this site
 * can DO and act on it?" — a distinct, newer discipline (named tooling in
 * this space: AgentGrade and similar agent-readiness scanners, 2026).
 *
 * This checks for the machine-readable discovery surface an agent looks
 * for before it can act: llms-full.txt (the fuller, more-fetched sibling
 * of llms.txt), a SKILL.md capability manifest, a discoverable MCP server,
 * and an OpenAPI spec. None of these are required — most sites won't have
 * any of them yet, this is genuinely emerging — so absence is reported as
 * a low-severity opportunity, not a failure.
 */

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface AgentExperienceSignal {
  path: string;
  present: boolean;
  description: string;
}

export interface AgentExperienceData {
  signals: AgentExperienceSignal[];
  score: number; // 0-100, percentage of signals present
}

const SIGNAL_PATHS: Array<{ path: string; description: string }> = [
  { path: '/llms-full.txt', description: 'Full-site content dump for AI agents — the fuller sibling of llms.txt, measured as fetched roughly 2x more often' },
  { path: '/skill.md', description: 'SKILL.md capability manifest (Anthropic Agent Skills convention)' },
  { path: '/mcp', description: 'MCP (Model Context Protocol) server, discoverable at a conventional path' },
  { path: '/.well-known/mcp.json', description: 'MCP server descriptor at the .well-known convention' },
  { path: '/openapi.json', description: 'OpenAPI spec — lets an agent discover and call your API directly instead of scraping HTML' },
  { path: '/.well-known/ai-plugin.json', description: 'AI plugin manifest (older but still-referenced convention for agent tool discovery)' },
];

async function fetchBody(baseUrl: string, path: string): Promise<{ status: number; body: string } | null> {
  try {
    const url = new URL(path, baseUrl).href;
    const response = await httpGet<string>(url, {
      timeout: 8000,
      validateStatus: () => true,
    });
    return { status: response.status, body: String(response.data ?? '') };
  } catch {
    return null;
  }
}

/**
 * Many sites — anything client-side-routed (React/Vue/etc. SPAs in
 * particular) — serve their app shell with HTTP 200 for EVERY unmatched
 * path rather than a real 404. A naive "status 200 = found" check would
 * report every single signal as present on such a site, which is worse
 * than not checking at all — actively misleading rather than merely
 * incomplete. Fetching one definitely-nonexistent path first and
 * comparing every signal's response against it catches this: identical
 * bytes back means "this is the fallback shell," not a real resource,
 * regardless of what status code came back with it.
 */
async function pathExists(baseUrl: string, path: string, fallbackBody: string | null): Promise<boolean> {
  const result = await fetchBody(baseUrl, path);
  if (!result) return false;
  if (result.status === 404) return false;
  if (result.status < 200 || result.status >= 400) return false;
  if (fallbackBody != null && result.body === fallbackBody) return false;
  return true;
}

export async function checkAgentExperience(
  baseUrl: string
): Promise<{ issues: AuditIssue[]; data: AgentExperienceData }> {
  const issues: AuditIssue[] = [];

  const probePath = `/__rankcli_ax_probe_${Math.random().toString(36).slice(2)}`;
  const baseline = await fetchBody(baseUrl, probePath);
  const fallbackBody = baseline && baseline.status >= 200 && baseline.status < 400 ? baseline.body : null;

  const signals = await Promise.all(
    SIGNAL_PATHS.map(async ({ path, description }) => ({
      path,
      description,
      present: await pathExists(baseUrl, path, fallbackBody),
    }))
  );

  const presentCount = signals.filter((s) => s.present).length;
  const score = Math.round((presentCount / signals.length) * 100);

  // Only worth flagging when a site has essentially no agent-facing
  // discovery surface at all — this is a forward-looking opportunity
  // check, not a compliance requirement, so it stays low-severity and
  // only fires below a meaningful threshold.
  if (presentCount === 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.NO_AGENT_EXPERIENCE_SURFACE,
      affectedUrls: [baseUrl],
      details: { checkedPaths: SIGNAL_PATHS.map((s) => s.path) },
    });
  }

  return { issues, data: { signals, score } };
}
