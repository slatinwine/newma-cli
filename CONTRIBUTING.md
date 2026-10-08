# Contributing to Newma (牛码)

Thanks for helping improve Newma. This document covers the minimum you need
to build, test and contribute changes.

## Setup

```bash
git clone <repo>
cd newma-cli
npm install
npm run verify   # 构建 + 全量测试 + 冒烟验收（一条命令）
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
- **Gate**: `npm run verify` 必须全绿才能提交——它跑完整构建、全部
  离线测试（含 REPL 黑盒 E2E）和发布冒烟（版本一致、main/bin 入口、
  tarball 内容检查）。
- **Docs**: when adding a user-facing command, update `README.md`, the REPL
  `/help` text and the tab-completion list in `src/completion.ts`, and add
  an entry under "Unreleased" in `CHANGELOG.md`.
- **Don't** commit `.env`, `settings.json`, or anything under `.memo/`,
  `.kode/` (all gitignored — they hold local state and keys).

## Release checklist

1. Update `CHANGELOG.md`（Unreleased → 版本号 + 日期）。
2. 升 `package.json` 的 `version`（单一来源，`--version` 读它）。
3. `npm run verify`（构建 + 测试 + 冒烟 + pack 检查）必须全绿。
4. 打 tag `v<version>` 并 `npm publish`。
