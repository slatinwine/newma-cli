# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/) and the project
versions [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **Tab completion drift**: 36 dispatched commands were missing from the
  completion table (users could not Tab-complete /undo, /diff, /preset,
  /mode, /review-*, /skill-*, all precipitation commands, …). The table
  now mirrors the dispatcher; a new consistency gate
  (tests/command-consistency.test.ts) cross-checks dispatcher ↔
  completion ↔ /help so this cannot silently regress again.
- /help was missing /chat and the review-mode switches.

### Fixed

- **Double Ctrl+C now exits**: the SIGINT handler printed "Press Ctrl+C
  again to exit" but never implemented the second-press exit. Two
  presses within 2 seconds now trigger a graceful shutdown (branch
  settlement + memory save), same as /exit.
- **SIGTERM settles session state**: a new unified `gracefulShutdown()`
  (idempotent) is shared by /exit, readline close, double Ctrl+C and
  SIGTERM, so abandoned-branch settlement and memory persistence run on
  every exit path. (Windows cannot catch SIGTERM — platform limitation,
  the graceful path is exercised by CI on Linux.)

### Added

- `bench/benchmark-session-write.mjs`: quantifies per-message session
  persistence cost. Verdict at realistic scale (≤500 messages): total
  write time under a second — the O(n²) full-file rewrite is documented
  and deliberately kept for message durability; revisit only if
  sessions routinely exceed ~1000 messages.

### Fixed

- **AI response cache poisoning**: the cache key did not include the
  target endpoint, so a response obtained from one endpoint (a mock,
  proxy or different provider) would be replayed for requests to
  another. The endpoint origin now participates in the key.
- Configuration precedence flipped to CLI flag > environment variable >
  settings.json (12-factor convention). Previously a stale
  `~/.kode/settings.json` apiKey silently overrode `OPENAI_API_KEY`
  from the environment, which also made CI/test injection impossible.

### Added

- `NEWMA_CACHE=off` disables the AI response cache (used by tests/CI
  for isolation).
- Mock-LLM end-to-end test: drives the full one-shot
  plan → confirm → execute pipeline against a local OpenAI-compatible
  server — the AI happy path is now covered without real credentials.

### Fixed

- `--loop` mode now exits with code 2 on errors (1 stays "not done"),
  matching the documented contract that shell wrappers rely on.

### Changed

- Logger default level is now `warn` — startup shows only the config
  summary and banner; internal subsystem chatter ([PLUGIN],
  [DraftManager], [Scheduler], …) requires `--verbose` or `NEWMA_LOG`.
  This matches git/docker CLI conventions.

## [3.5.1] - 2026-10-08

### Added

- Central logger (`src/logger.ts`) with levels: `--verbose` shows debug
  internals, `--silent`/`-q` and `NEWMA_LOG` control volume; memory
  subsystem noise (init messages, periodic scheduler heartbeats) moved off
  the user's screen.
- REPL end-to-end black-box tests: pipe-driven runs against the compiled
  `dist/cli.js` verify /help, /save→/saves, /flags→/tree flows.

### Fixed

- Plugin loading always failed with "Tool already registered: file" (the
  success path re-registered an existing builtin); plugin tools now
  override builtins explicitly and the duplicate registration was removed.
- Skills initialization crashed on every start (`__dirname is not
  defined` in ESM output); the Python executor path is now derived from
  the module URL.
- Command injection surface: the memo plugin spawned its CLI with
  `shell: true` on Windows while passing user-typed decision titles as
  arguments; the shell is gone (CreateProcess resolves executables
  directly).
- Session index writes debounced: adding a message no longer rewrites the
  whole index file twice per message (session file durability unchanged;
  index flushes on reads and session end).

### Changed

- Dream consolidation is now opt-in (`dream.enabled`, default false) and
  reads the real sharded session store (`.memo/sessions/**`) instead of a
  `.kode/sessions` layout that never existed.
- Adjudicated experimental subsystems: event sources, dual-track runtime
  and adventure mode are kept (wired and testable); dream consolidation
  preserved behind its flag. All documented as experimental in README.

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
