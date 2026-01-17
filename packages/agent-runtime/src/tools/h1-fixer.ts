import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import type { ToolResult } from '../types.js';
import type { GeneratedFix } from '../fixer.js';

interface H1ScanResult {
  hasH1: boolean;
  h1Location?: {
    file: string;
    line: number;
    content: string;
  };
  candidates: HeadlineCandidate[];
}

interface HeadlineCandidate {
  file: string;
  line: number;
  tag: string;
  className: string;
  content: string;
  score: number; // Higher = more likely to be the main headline
}

// Tailwind text size classes ranked by size
const TEXT_SIZE_SCORES: Record<string, number> = {
  'text-9xl': 100,
  'text-8xl': 90,
  'text-7xl': 80,
  'text-6xl': 70,
  'text-5xl': 60,
  'text-4xl': 50,
  'text-3xl': 40,
  'text-2xl': 30,
  'text-xl': 20,
};

// Component names that likely contain the main headline
const PRIORITY_COMPONENTS = ['hero', 'landing', 'home', 'index', 'main'];

export async function scanForH1(params: { cwd: string }): Promise<ToolResult> {
  const { cwd } = params;
  const result: H1ScanResult = {
    hasH1: false,
    candidates: [],
  };

  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) {
    return { success: true, data: result };
  }

  const files = findReactFiles(srcDir);

  // Store all H1 locations to find the best one
  const h1Locations: Array<{ file: string; line: number; content: string; priority: number }> = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relativePath = file.replace(cwd + '/', '');

    // Check for existing H1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for <h1 or <H1 in JSX
      if (/<h1[\s>]/i.test(line)) {
        // Calculate priority based on file location
        let priority = 0;
        const lowerPath = relativePath.toLowerCase();
        if (lowerPath.includes('hero')) priority += 100;
        if (lowerPath.includes('landing')) priority += 80;
        if (lowerPath.includes('home')) priority += 70;
        if (lowerPath.includes('index')) priority += 60;
        if (lowerPath.includes('main')) priority += 50;
        if (lowerPath.includes('components/landing')) priority += 40;

        h1Locations.push({
          file: relativePath,
          line: i + 1,
          content: line.trim(),
          priority,
        });
      }

      // Look for headline candidates (large text that's not an H1)
      const candidate = findHeadlineCandidate(line, i + 1, relativePath);
      if (candidate) {
        result.candidates.push(candidate);
      }
    }
  }

  // If we found H1s, use the highest priority one
  if (h1Locations.length > 0) {
    h1Locations.sort((a, b) => b.priority - a.priority);
    const best = h1Locations[0];
    result.hasH1 = true;
    result.h1Location = {
      file: best.file,
      line: best.line,
      content: best.content,
    };
  }

  // Sort candidates by score (highest first)
  result.candidates.sort((a, b) => b.score - a.score);

  // Boost score for components in priority list
  for (const candidate of result.candidates) {
    const fileName = candidate.file.toLowerCase();
    for (const priority of PRIORITY_COMPONENTS) {
      if (fileName.includes(priority)) {
        candidate.score += 25;
      }
    }
  }

  // Re-sort after boosting
  result.candidates.sort((a, b) => b.score - a.score);

  return { success: true, data: result };
}

function findReactFiles(dir: string): string[] {
  const files: string[] = [];

  function scan(currentDir: string) {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;

      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip ui components directory - these are usually shadcn/ui
        if (entry !== 'ui' || !currentDir.includes('components')) {
          scan(fullPath);
        }
      } else if (['.tsx', '.jsx'].includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

function findHeadlineCandidate(line: string, lineNum: number, file: string): HeadlineCandidate | null {
  // Match patterns like <div className="text-5xl or <p className="... text-4xl
  const tagMatch = line.match(/<(div|p|span|section)\s+[^>]*className=["']([^"']*text-[3-9]xl[^"']*)["']/i);

  if (!tagMatch) return null;

  const [, tag, className] = tagMatch;

  // Calculate score based on text size
  let score = 0;
  for (const [sizeClass, points] of Object.entries(TEXT_SIZE_SCORES)) {
    if (className.includes(sizeClass)) {
      score = points;
      break;
    }
  }

  // Boost for bold
  if (className.includes('font-bold') || className.includes('font-extrabold')) {
    score += 10;
  }

  // Extract text content if on same line
  const textMatch = line.match(/>([^<]+)</);
  const content = textMatch ? textMatch[1].trim() : '';

  return {
    file,
    line: lineNum,
    tag,
    className,
    content,
    score,
  };
}

export async function generateH1Fix(params: { cwd: string }): Promise<GeneratedFix | null> {
  const scanResult = await scanForH1(params);

  if (!scanResult.success || !scanResult.data) {
    return null;
  }

  const data = scanResult.data as H1ScanResult;

  // If H1 already exists, no fix needed
  if (data.hasH1) {
    return {
      issue: {
        code: 'MISSING_H1',
        message: 'No H1 heading found',
        severity: 'critical',
      },
      file: data.h1Location!.file,
      before: null,
      after: data.h1Location!.content,
      explanation: `H1 already exists in component at line ${data.h1Location!.line}. The audit may not see it because it's rendered by JavaScript. Google's crawler does execute JS.`,
      skipped: true,
      skipReason: `H1 found in ${data.h1Location!.file}:${data.h1Location!.line} (JS-rendered)`,
    };
  }

  // No H1 and no candidates
  if (data.candidates.length === 0) {
    return {
      issue: {
        code: 'MISSING_H1',
        message: 'No H1 heading found',
        severity: 'critical',
      },
      file: 'Unknown',
      before: null,
      after: '<h1>Your Main Headline</h1>',
      explanation: 'No suitable headline element found to convert. Add an H1 manually in your main page component.',
      skipped: true,
      skipReason: 'No headline-like elements found to convert',
    };
  }

  // Get the best candidate
  const best = data.candidates[0];

  // Generate the fix
  const before = `<${best.tag}`;
  const after = `<h1`;

  return {
    issue: {
      code: 'MISSING_H1',
      message: 'No H1 heading found',
      severity: 'critical',
    },
    file: best.file,
    before,
    after,
    explanation: `Convert the main headline from <${best.tag}> to <h1>. Found at line ${best.line} with classes: ${best.className}`,
  };
}
