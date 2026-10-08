# Newma (牛码) CLI

AI-driven command-line coding assistant for the terminal. It plans, executes
and verifies code changes with your choice of reasoning strategies, and —
uniquely — treats every task like a game run: **save points, branch trees,
and lossless time travel** for both your code and your conversation.

- **Requires:** Node.js ≥ 22 · Git (for checkpoints/rollback)
- **Default model:** any OpenAI-compatible API (Zhipu GLM by default)
- **License:** MIT

## Install

```bash
npm install -g newma-cli
# or run without installing
npx newma-cli <requirement>
```

Set your API key (`.env` or environment):

```bash
OPENAI_API_KEY=your-key        # or ZHIPU_API_KEY
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas  # optional
```

## Quick start

```bash
# One-shot task
newma "add a login page"

# Interactive REPL
newma -i

# Continue your last session (conversation, flags and branch memory restored)
newma -i -c          # or /continue inside the REPL
```

Inside the REPL, type a requirement directly or use `/plan <requirement>`.
Every plan choice is a recorded decision point; every execution is preceded
by an automatic save point.

### Session commands (game-style)

| Command | What it does |
|---|---|
| `/save [name]` | Create a save point (git commit + messages + flags + task) |
| `/saves [--all]` | List save slots (`--all` includes other sessions) |
| `/load <id\|name>` | Restore a save point — losslessly |
| `/tree` | Render the decision tree (flowchart with outcomes) |
| `/flags` | Show/set session constraints (`/flags set key=value`) |
| `/back-to <id>` | Time travel to a decision/save point; current work is preserved on a git branch |
| `/next` | MCTS recommendation: exploit best-known or explore untried |
| `/continue` | Resume the most recent session |

Rewinding never deletes work: the abandoned branch is kept as
`kode/branch-*` in git, its conclusions are injected as *prior branch
memory* ("this path failed because …"), and outcomes feed the MCTS
statistics so future plan choices get smarter.

### Other commonly used commands

`/plan` `/do` `/loop` (execution modes) · `/chat` · `/status` `/state` ·
`/undo` `/diff` · `/review-on|off` (approve file changes) · `/memory-*`
(persistent memory) · `/skills` `/drafts` `/approve` (skill distillation) ·
`/help` for the full list.

## How it works

```
plan → search → execute → verify  (loop until done)
  │                    │
  │ decision points    │ checkpoints before destructive actions
  ▼                    ▼
  branch tree (.memo/branches/)   save points (.memo/saves/)
  └── outcomes backpropagate → MCTS priors → better next plans
  └── abandoned branches → precipitation (learned skills)
```

Key strategies (opt-in): Tree of Thoughts planning (`--ultrathink`),
function-calling execution, multi-agent decomposition, FFT fast decisions,
automatic verification, git-based rollback, and a precipitation system that
distills repeated patterns into reusable skills.

## Development

```bash
npm install
npm run build     # compile (UI first), rewrite ESM extensions, copy assets
npm test          # offline test suites (tests/ + test-ultrathink/)
node dist/cli.js --version   # runs without any loader
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and
[CHANGELOG.md](CHANGELOG.md) for release history.

## Known limitations

- Session persistence rewrites the whole session JSON per message (fine for
  normal sessions, not yet optimized for very long ones).
- Several subsystems (event sources, dream consolidation, dual-track
  runtime) are experimental and off by default.
- AI-powered features require a working API key; all `/save` `/tree`
  `/flags` `/next` `/back-to` commands work fully offline.
