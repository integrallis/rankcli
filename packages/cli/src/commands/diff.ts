/**
 * `rankcli diff before.json after.json`: what changed between two saved reports. New
 * findings, fixed findings, score moves per category; `--fail-on` turns it into a gate on
 * the new findings (and, with score rules, on the after report's scores).
 */
import chalk from 'chalk';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  diffIssues,
  evaluateGate,
  isGated,
  parseFailOn,
  readBaseline,
  SCORE_CATEGORIES,
  type AuditIssue,
  type BaselineReport,
  type HealthScore,
} from '@rankcli/agent-runtime';
import { EXIT_CODES } from './audit.js';

export interface DiffOptions {
  /** console (default) or json. */
  output?: string;
  /** Gate rules on the new findings: error | warning | notice; score<N applies to the after report. */
  failOn?: string | string[];
}

function readReport(file: string, cwd: string): { report?: BaselineReport; error?: string } {
  const path = isAbsolute(file) ? file : join(cwd, file);
  if (!existsSync(path)) return { error: `File not found: ${file}` };
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    return { error: `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const read = readBaseline(doc);
  if ('error' in read) return { error: `${file}: ${read.error}` };
  return { report: read };
}

export interface ScoreChange {
  before?: number;
  after?: number;
  delta?: number;
}

export function scoreChanges(before: Partial<HealthScore> | undefined, after: Partial<HealthScore> | undefined): Record<string, ScoreChange> {
  const changes: Record<string, ScoreChange> = {};
  for (const category of SCORE_CATEGORIES) {
    const b = before?.[category];
    const a = after?.[category];
    if (b === undefined && a === undefined) continue;
    changes[category] = { before: b, after: a, delta: b !== undefined && a !== undefined ? a - b : undefined };
  }
  return changes;
}

export async function diff(beforeFile: string, afterFile: string, options: DiffOptions = {}): Promise<number> {
  const cwd = process.cwd();
  const json = String(options.output ?? 'console').trim().toLowerCase() === 'json';
  const fail = (code: number, message: string): number => {
    if (json) console.log(JSON.stringify({ error: message, exitCode: code }, null, 2));
    else console.error(`\n❌ ${message}\n`);
    return code;
  };

  const rules = parseFailOn(options.failOn);
  if (rules.error) return fail(EXIT_CODES.USAGE, `Invalid --fail-on: ${rules.error}`);
  const before = readReport(beforeFile, cwd);
  if (before.error || !before.report) return fail(EXIT_CODES.USAGE, before.error ?? 'unreadable');
  const after = readReport(afterFile, cwd);
  if (after.error || !after.report) return fail(EXIT_CODES.USAGE, after.error ?? 'unreadable');

  const result = diffIssues(before.report.issues, after.report.issues);
  const beforeScores = { ...(before.report.healthScores ?? {}), ...(before.report.score !== undefined && { overall: before.report.score }) };
  const afterScores = { ...(after.report.healthScores ?? {}), ...(after.report.score !== undefined && { overall: after.report.score }) };
  const scores = scoreChanges(beforeScores, afterScores);
  const gate = evaluateGate(rules.spec, result.added, { ...afterScores, overall: afterScores.overall ?? 0 }, { newOnly: true });
  const gated = isGated(rules.spec);
  const exitCode = gate.passed ? EXIT_CODES.OK : EXIT_CODES.GATE_FAILED;

  if (json) {
    console.log(JSON.stringify({
      before: { file: beforeFile, url: before.report.url, timestamp: before.report.timestamp, score: before.report.score },
      after: { file: afterFile, url: after.report.url, timestamp: after.report.timestamp, score: after.report.score },
      scores,
      added: result.added,
      fixed: result.fixed,
      unchanged: result.unchanged,
      ...(gated && { gate }),
      exitCode,
    }, null, 2));
    for (const failure of gate.failures) console.error(`Gate failed: ${failure}`);
    return exitCode;
  }

  const when = (r: BaselineReport) => (r.timestamp ? ` (${r.timestamp})` : '');
  console.log('\n' + chalk.bold('═'.repeat(60)));
  console.log(chalk.bold.cyan(`  AUDIT DIFF`));
  console.log(chalk.bold('═'.repeat(60)));
  console.log(`\n  ${chalk.bold('Before:')} ${beforeFile}${chalk.dim(when(before.report))}`);
  console.log(`  ${chalk.bold('After:')}  ${afterFile}${chalk.dim(when(after.report))}`);
  if (before.report.url && after.report.url && before.report.url !== after.report.url) {
    console.log(chalk.yellow(`  Different URLs: ${before.report.url} vs ${after.report.url}`));
  }

  const changed = Object.entries(scores).filter(([, c]) => c.delta !== undefined && c.delta !== 0);
  const overall = scores.overall;
  if (overall?.before !== undefined && overall.after !== undefined) {
    const d = overall.delta ?? 0;
    const color = d > 0 ? chalk.green : d < 0 ? chalk.red : chalk.dim;
    console.log(`\n  ${chalk.bold('Score:')} ${overall.before} → ${overall.after} ${color(`(${d >= 0 ? '+' : ''}${d})`)}`);
  }
  const categoryMoves = changed.filter(([category]) => category !== 'overall');
  if (categoryMoves.length) {
    console.log('\n' + chalk.bold('  Category scores that moved:'));
    for (const [category, c] of categoryMoves) {
      const d = c.delta ?? 0;
      const color = d > 0 ? chalk.green : chalk.red;
      console.log(`    ${category.padEnd(14)} ${c.before} → ${c.after} ${color(`(${d >= 0 ? '+' : ''}${d})`)}`);
    }
  }

  const list = (label: string, items: AuditIssue[], mark: string) => {
    console.log('\n' + chalk.bold(`  ${label} (${items.length}):`));
    if (items.length === 0) { console.log(chalk.dim('    none')); return; }
    for (const issue of items) {
      console.log(`    ${mark} ${issue.title}  ${chalk.dim(issue.code)}`);
      for (const url of issue.affectedUrls ?? []) console.log(chalk.dim(`      ${url}`));
    }
  };
  list('New', result.added, chalk.red('+'));
  list('Fixed', result.fixed, chalk.green('-'));
  console.log(`\n  ${chalk.bold('Unchanged:')} ${result.unchanged}`);

  if (gated) {
    console.log('');
    if (gate.passed) console.log(chalk.green('  ✓ Gate passed'));
    else for (const failure of gate.failures) console.log(chalk.red(`  ✗ Gate failed: ${failure}`));
  }
  console.log('\n' + chalk.bold('═'.repeat(60)) + '\n');
  return exitCode;
}
