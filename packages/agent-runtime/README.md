# @rankcli/agent-runtime

Core audit engine for RankCLI. Runs 280+ SEO checks and powers both the CLI and SaaS edge functions.

## Architecture

This package is **isomorphic** - it works in both Node.js and Deno environments:

- **Node.js**: Used by the CLI (`packages/cli`)
- **Deno**: Used by Supabase Edge Functions (`packages/saas/supabase/functions`)

The isomorphic design uses native `fetch` API instead of Node-specific modules like `axios` or `https`.

## Directory Structure

```
src/
├── audit/
│   ├── engine.ts          # Main audit orchestrator
│   ├── types.ts           # Issue definitions & types
│   ├── deno-entry.ts      # Deno-specific entry point
│   └── checks/            # Individual check modules
│       ├── crawlability.ts
│       ├── on-page.ts
│       ├── performance.ts
│       ├── security.ts
│       ├── ai-readiness.ts
│       └── ... (40+ check modules)
├── utils/
│   └── http.ts            # Isomorphic HTTP utilities
├── content/               # Content generation
├── geo/                   # GEO tracking
├── git/                   # Git/PR helpers
└── index.ts               # Main entry point
```

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Commands

```bash
# Install dependencies
pnpm install

# Development mode (watches both Node and Deno bundles)
pnpm dev

# Run tests
pnpm test        # Watch mode
pnpm test:run    # Single run

# Build for production
pnpm build       # Builds Node.js + Deno bundles

# Build only Deno bundle
pnpm build:deno
```

### Development Workflow

When you run `pnpm dev`, it:

1. Builds the Deno bundle first
2. Starts tsup in watch mode for Node.js
3. Rebuilds the Deno bundle on every successful Node.js build

This ensures both the CLI (Node.js) and edge functions (Deno) stay in sync during development.

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Watch mode - rebuilds Node + Deno on changes |
| `pnpm dev:node` | Watch mode - Node.js only |
| `pnpm dev:deno` | Watch mode - Deno bundle only |
| `pnpm build` | Production build (Node.js + Deno) |
| `pnpm build:deno` | Build Deno bundle only |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |

## Deno Bundle

The Deno bundle is generated at:
```
packages/saas/supabase/functions/_shared/audit/
├── engine.bundle.js   # Bundled audit engine
└── index.ts           # Wrapper with cheerio import
```

Edge functions import from the shared bundle:
```typescript
import { runFullAudit } from '../_shared/audit/index.ts';
```

### How It Works

1. `scripts/build-deno.ts` uses esbuild to bundle `src/audit/deno-entry.ts`
2. The bundle excludes `cheerio` (imported from esm.sh at runtime)
3. Node-specific APIs are polyfilled or replaced with web-compatible alternatives

### Isomorphic Considerations

When adding new features to the audit engine:

- Use `fetch` instead of `axios` or Node's `http`/`https`
- Use the helpers in `src/utils/http.ts` for HTTP requests
- Avoid Node-specific modules (`fs`, `path`, `dns`, `crypto`, etc.)
- For DNS lookups, use DNS-over-HTTPS (see `additional-checks.ts`)
- Test in both Node.js (`pnpm test`) and edge functions

## VS Code Tasks

If using VS Code, these tasks are available (Cmd/Ctrl+Shift+P → "Tasks: Run Task"):

| Task | Description |
|------|-------------|
| Dev: Agent Runtime (with Deno watch) | Watches and rebuilds both bundles |
| Dev: SaaS Frontend | Runs the Vite dev server |
| Dev: Full Stack | Runs both in parallel |
| Build: Deno Bundle | One-time Deno bundle build |
| Deploy: Edge Functions | Deploys to Supabase |

## DevContainer

When using the devcontainer:

- The Deno bundle is built automatically on container creation
- Run `pnpm dev` in `packages/agent-runtime` to start watching for changes
- The bundle is rebuilt automatically when you modify audit code

## API

### runFullAudit

Main entry point for running audits:

```typescript
import { runFullAudit } from '@rankcli/agent-runtime';

const report = await runFullAudit('https://example.com', {
  maxPages: 10,           // Max pages to crawl
  includeAdvanced: true,  // Run advanced checks
  includeAI: false,       // Run AI-powered analysis
});

console.log(report.overallScore);      // 0-100
console.log(report.issues);            // Array of issues
console.log(report.healthScores);      // Category scores
console.log(report.checksRun);         // Number of checks run
```

### Issue Structure

```typescript
interface AuditIssue {
  code: string;           // e.g., 'TITLE_MISSING'
  severity: 'error' | 'warning' | 'notice';
  category: string;       // e.g., 'on-page', 'security'
  title: string;          // Human-readable title
  description?: string;   // Detailed description
  impact?: string;        // SEO impact explanation
  howToFix?: string;      // Fix instructions
  affectedUrls?: string[];
  details?: Record<string, unknown>;
}
```

### Health Scores

```typescript
interface HealthScores {
  crawlability: number;   // 0-100
  onPage: number;
  content: number;
  performance: number;
  security: number;
  socialMeta: number;
  aiReadiness: number;
  mobile: number;
}
```

## Adding New Checks

1. Create a new file in `src/audit/checks/` or add to an existing one
2. Export the check function
3. Add to `src/audit/engine.ts` to include in the audit flow
4. Add to `src/audit/deno-entry.ts` to export for Deno
5. Run `pnpm build:deno` to regenerate the bundle
6. Add tests in a `.test.ts` file

Example check:

```typescript
// src/audit/checks/my-check.ts
import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export async function checkMyThing(url: string): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];

  const response = await httpGet(url);

  if (/* condition */) {
    issues.push({
      code: 'MY_ISSUE_CODE',
      severity: 'warning',
      category: 'my-category',
      title: 'Issue title',
      description: 'What this means',
      howToFix: 'How to fix it',
      affectedUrls: [url],
    });
  }

  return issues;
}
```

## Testing

Tests use Vitest:

```bash
# Run all tests
pnpm test:run

# Run specific test file
pnpm test:run src/audit/checks/social-meta.test.ts

# Run with coverage
pnpm test:coverage
```

## License

MIT
