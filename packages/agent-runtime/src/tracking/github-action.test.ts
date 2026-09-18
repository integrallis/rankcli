import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { generateWorkflow, type WorkflowConfig } from './github-action.js';

type Step = { name?: string; id?: string; if?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, string> };
type Workflow = { env?: Record<string, string>; jobs: Record<string, { env?: Record<string, string>; permissions: Record<string, string>; steps: Step[] }> };

const base: WorkflowConfig = {
  schedule: 'weekly',
  siteUrl: 'https://example.com',
  features: { audit: true, autoFix: true, createIssues: true, createPRs: true },
  syncToDashboard: true,
};

function load(config: WorkflowConfig): { wf: Workflow; steps: Step[]; job: Workflow['jobs'][string] } {
  const wf = parse(generateWorkflow(config)) as Workflow;
  const job = wf.jobs['seo-check'];
  return { wf, job, steps: job.steps };
}

describe('generateWorkflow', () => {
  it('produces valid YAML whose rankcli steps all exist in the CLI', () => {
    const { steps } = load(base);
    const commands = steps.map(s => s.run || '').join('\n').match(/rankcli \w+/g) || [];
    for (const cmd of commands) {
      expect(['rankcli login', 'rankcli audit', 'rankcli fix']).toContain(cmd);
    }
  });

  it('scopes RANKCLI_API_KEY to the rankcli steps only', () => {
    const { wf, job, steps } = load(base);
    expect(wf.env?.RANKCLI_API_KEY).toBeUndefined();
    expect(job.env?.RANKCLI_API_KEY).toBeUndefined();
    for (const step of steps) {
      if (step.env?.RANKCLI_API_KEY) {
        expect(step.run).toMatch(/rankcli /);
      }
      // Third-party actions never see the key.
      if (step.uses) expect(step.env?.RANKCLI_API_KEY).toBeUndefined();
    }
    const verify = steps.find(s => s.name === 'Verify RankCLI API key')!;
    expect(verify.run).toContain('-z "$RANKCLI_API_KEY"');
    expect(verify.run).toContain('rankcli login');
    expect(steps.find(s => s.id === 'audit')!.env?.RANKCLI_API_KEY).toBe('${{ secrets.RANKCLI_API_KEY }}');
  });

  it('keeps report files out of the checkout so the fix PR never commits them', () => {
    const { steps } = load(base);
    expect(steps.find(s => s.id === 'audit')!.run).toContain('> "$RUNNER_TEMP/audit-report.json"');
    expect(steps.find(s => s.id === 'autofix')!.run).toContain('> "$RUNNER_TEMP/fixes.json"');
    expect(steps.find(s => s.uses?.startsWith('actions/upload-artifact'))!.with!.path).toContain('${{ runner.temp }}/audit-report.json');
  });

  it('reads fixes.json defensively (an empty or missing file means 0 applied)', () => {
    const { steps } = load(base);
    const check = steps.find(s => s.id === 'fixes')!;
    const snippet = check.run!.match(/node -e "(.*)"\)/)![1];
    expect(snippet).toContain('try');
    expect(snippet).toContain('catch');
  });

  it('embeds a syntactically valid github-script', () => {
    const { steps } = load(base);
    const script = steps.find(s => s.uses?.startsWith('actions/github-script'))!.with!.script;
    // github-script wraps the body in an async function.
    expect(() => new Function(`return (async () => {\n${script}\n})`)).not.toThrow();
  });

  it('without dashboard sync: no secrets, no auto-fix steps, read-only contents', () => {
    const noSync: WorkflowConfig = { ...base, syncToDashboard: false, features: { ...base.features, autoFix: false, createPRs: false } };
    const text = generateWorkflow(noSync);
    expect(text).not.toContain('RANKCLI_API_KEY');
    const { job, steps } = load(noSync);
    expect(steps.find(s => s.name === 'Auto-fix issues')).toBeUndefined();
    expect(job.permissions).toEqual({ contents: 'read', issues: 'write' });
  });
});
