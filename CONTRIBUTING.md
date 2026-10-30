# Contributing

Issues and pull requests are welcome. A finding that is wrong on a real site is the most useful
report there is: include the URL (or the HTML) and the issue code.

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

Node 20.19+ or 22.12+, pnpm 8 (`npx pnpm@8` works). No other toolchain: the Rust/WASM layer
the CLI once carried is gone.

## Layout

- `packages/agent-runtime/src/audit/checks/` holds every check, one file each, as a function
  `(html, url) => { issues, data }` or an async variant that fetches. `engine.ts` runs them;
  `dedupe.ts` collapses codes that describe one condition; `scoring/` turns issues into scores.
- `packages/agent-runtime/src/frameworks/` is framework detection (scored evidence, not
  first match) and the fix recipes under `recipes/`.
- `packages/cli/src/commands/` is one file per command; `lib/site-audit.ts` is the one audit
  pipeline behind `audit`, `fix` and `apply`, so they always agree on the score.
- `packages/mcp-server/src/server.ts` defines the tools; `packages/github-action/src/` the
  Action; the three plugins are self-contained.

## Adding or changing a check

1. Put the check in `packages/agent-runtime/src/audit/checks/<name>.ts` and wire it in
   `engine.ts`. Give each finding a stable `code`, a `title`, a `description`, an `impact` and a
   `howToFix` that a developer can act on.
2. Only report what the HTML or the responses show. A check that fires on every site, or
   whose claim the tool cannot support, is a false positive at scale; demote it to a notice or
   do not add it.
3. If the finding is one condition another code already reports, add a rule to
   `dedupe.ts` instead of a second code.
4. Add a test next to it (`<name>.test.ts`, vitest) with a page that triggers the finding and
   one that does not.
5. Run `pnpm test` in `packages/agent-runtime`, then rebuild it and run the CLI's tests.

## Pull requests

Keep a pull request to one change. Say what was wrong, what the change does, and how it was
verified. CI runs the engine, CLI, MCP server, Action and plugin suites on every pull request.

## Releases (maintainers)

Bump the versions of `cli`, `agent-runtime` and `mcp-server` together (the CLI pins the runtime
at `^0.0.N`, and on 0.0.x that means exactly 0.0.N), push to `main`, then create a GitHub
release `vX.Y.Z`. `release.yml` publishes to npm and the MCP registry, `native-release.yml`
builds the binaries and updates Homebrew and Scoop, and `publish-plugins.yml` is run by hand
when a plugin changes.

## License of contributions

By contributing, you agree that your contribution is licensed under the license of the package
it lands in: FSL-1.1-MIT for the engine, the CLI, the MCP server and the Action, MIT for the
three framework plugins. Both are in each package's `LICENSE` file.
