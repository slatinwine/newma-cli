# Contributing to Newma (牛码)

Thanks for helping improve Newma. This document covers the minimum you need
to build, test and contribute changes.

## Setup

```bash
git clone <repo>
cd newma-cli
npm install
npm run build
npm test
```

Requirements: Node.js ≥ 22, Git. A Bun install is optional for the
alternative build (`npm run build:bun`).

## Project layout

```
src/            TypeScript source (compiled to dist/)
  memory/       persistence: save points, branch tree, session context
  loop/         loop engine, plugins, commands
  agents/       multi-agent coordination
  ultrathink/   Tree-of-Thoughts planning + ReAct verification
tests/          offline Jest suites (no API key needed)
test-ultrathink ToT/ReAct test suites
bench/          benchmark scripts
scripts/        build helpers (e.g. fix-dist-imports.mjs)
archive/        retired demo/scratch files (not part of the product)
```

## Conventions

- **Tests**: user-facing bug fixes and features should come with offline
  tests in `tests/` (they must pass without network or API keys). Fix or
  update stale tests rather than deleting them; if a test encodes behavior
  that intentionally changed, say so in the commit message.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`,
  `docs:`, `build:`). Keep the subject ≤ 72 chars; details in the body.
- **Types**: `npm run build` runs `tsc` with `strict` — zero new errors is
  the bar. CI enforces this on Ubuntu and Windows.
- **Docs**: when adding a user-facing command, update `README.md`, the REPL
  `/help` text and the tab-completion list in `src/completion.ts`, and add
  an entry under "Unreleased" in `CHANGELOG.md`.
- **Don't** commit `.env`, `settings.json`, or anything under `.memo/`,
  `.kode/` (all gitignored — they hold local state and keys).

## Release checklist

1. Update `CHANGELOG.md` (move Unreleased → version, date).
2. Bump `version` in `package.json` (single source of truth — `--version`
   reads from it).
3. `npm run build && npm test`, then `npm pack --dry-run` and inspect the
   file list.
4. Tag `v<version>` and `npm publish`.
