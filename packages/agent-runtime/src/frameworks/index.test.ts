import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORTED_FRAMEWORKS } from './index.js';

describe('SUPPORTED_FRAMEWORKS', () => {
  // "Supported" has to mean one thing. A framework is supported when it has a recipe; without
  // one it is merely detected, and saying otherwise over-promises framework-specific fixes.
  it('is exactly the set of frameworks with a recipe', () => {
    const onDisk = readdirSync(join(__dirname, 'recipes'))
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => f.replace('.yaml', ''))
      .sort();
    expect([...SUPPORTED_FRAMEWORKS].sort()).toEqual(onDisk);
  });
});
