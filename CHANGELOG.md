# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/) and the project
versions [Semantic Versioning](https://semver.org/).

## [3.5.0] - 2026-10-08

### Added — Game-Style Session Management

This release redesigns session management around three metaphors: game save
slots, galgame branching, and AlphaZero MCTS over decision outcomes.

- **Save points** (`/save [name]`, `/saves`, `/load`): a save binds the git
  commit, session message position, task document and session flags into one
  restorable pointer tuple (`.memo/saves/`). Quick saves roll (keep 20);
  named saves persist. Auto-saves happen on review approvals and before plan
  execution.
- **Branch tree** (`/tree`, `/flags`): every plan choice records the full
  option set — including untaken options — with selection reason and outcome
  (`succeeded` / `failed` / `abandoned`). Session flags (confirmed
  constraints) are injected into plan generation. Session messages gain tree
  semantics (`parentMessageId` + abandoned ranges); rewound branches stay on
  disk but leave the AI context.
- **Time travel** (`/back-to`): lossless rewind to any decision or save
  point — current work is preserved on a `kode/branch-*` git branch and the
  target state is checked out on `kode/rewind-*` (never `git reset`).
  Abandoned-branch conclusions are injected as PRIOR BRANCH MEMORY so the
  assistant avoids repeating failed paths.
- **MCTS exploration** (`/next`): outcomes backpropagate rewards up the
  decision chain (succeeded=1.0, abandoned=0.25, failed=0.0); PUCT/UCB1
  scoring recommends whether to exploit the best-known option or explore an
  untried one. Same-signature decision points merge on revisit so per-option
  win rates accumulate correctly. Cross-session prior reflux turns
  historical win rates into initial priors for new decisions.
- **Conversation continuity** (`/continue`, `newma -i -c`): resume the most
  recent session; its active conversation, flags and branch memory are
  replayed into every subsequent AI request.
- Branch outcomes feed the precipitation (skill distillation) system as a
  new `branches` evidence source, so decision strategy ("incremental plans
  win more often in this project") can be learned.
- Dynamic agent reassignment: failed multi-agent tasks rotate to another
  capable agent (`dynamicReassignment`), and subagent `maxRetries` is now
  actually enforced with timeline events.

### Fixed

- Repair engine rolled back by label instead of commit hash (rollback could
  never work); `/undo` now distinguishes kode checkpoints from user commits;
  `git clean -fd` is opt-in instead of default.
- Precipitation auto-approve/auto-reject thresholds were inverted.
- Checkpoints no longer sweep `.memo/` / `.kode/` runtime data into the
  user's commit history.
- `executor-v2` fills `rollbackData` (the `rollbackManager` argument was
  accepted but never used); task status `running` is now actually set.
- Review-mode diff rewritten as a proper LCS line diff (inserting a line at
  the top no longer flags the whole file).
- `SessionContextManager.createSession` ignored its `sessionId` argument;
  cross-instance session loading reloads a stale index with a directory-scan
  fallback; save listing is deterministic under same-millisecond creation.
- Windows: memo plugin no longer hardcodes a macOS path / `python3`; the
  ESM loader handles drive-letter paths; `npm run build` works from a clean
  checkout; `copy:prompts` / `copy:templates` no longer require Unix shells.
- `node dist/cli.js` runs without a loader (postbuild rewrites extensionless
  relative imports); the build compiles the UI first, fixing the
  chicken-and-egg failure on clean trees.

### Changed

- Test suite consolidated under `tests/` (47+ offline tests covering the
  save/branch/MCTS system, fixes and agent reassignment, plus the
  ultrathink suite); overlapping event-source test variants archived.
- `--version` reads from `package.json` (single source of truth), aligned
  at 3.5.0.
- GitHub Actions CI: build + loader-free smoke test + offline test suites
  on Ubuntu and Windows, plus a typecheck job.
- Repository hygiene: game demos, papers and scratch dev scripts moved out
  of version control into `archive/` (kept on disk).

## [3.4.0] and earlier

See git history (`git log` in this repository).
