# KODE.md

> **Last Updated**: 2026-01-18T04:55:18.708Z
>
> This file contains the AI's understanding of this project.

---

*   **Input**: A large list of file names and their content snippets (mostly header comments).
    *   **Output Structure**: Specific sections required: Project Overview, Tech Stack, Architecture, Key Files and Their Purposes, Development Guide, Important Notes.
    *   **Constraints**: Concise, direct, no thinking process shown, markdown format only.

    *   *Project Name*: Newma (牛码) (AI-driven Multi-Agent Code Assistant).
    *   *Version*: v3.1.0.
    *   *Description*: Enterprise-grade CLI development assistant. Uses "planning → search → execute → verify" loop. Integrates multi-agent systems, tool calling, token compression, and advanced reasoning (Tree of Thoughts, ReAct).
    *   *Tech Stack*:
        *   Languages: TypeScript, Python (some test files/ref prototypes), JavaScript.
        *   Node.js/CLI: Commander, Inquirer, Chalk, node-fetch.
        *   AI/LLM: OpenAI API (and compatible APIs like Zhipu AI).
        *   Testing: Jest, ts-node.
    *   *Architecture*:
        *   **Core Loop**: Four-step loop (Reasoner → Executor → Observer → Repairer).
        *   **Multi-Agent System**: Specialized agents (Frontend, Backend, Testing, Documentation) + Coordinator.
        *   **Two-Phase System**: Plan Agent (planning) + Execute Agent (execution).
        *   **Ultrathink**: Advanced reasoning engine using Tree of Thoughts (ToT) and ReAct (Reasoning + Acting).
        *   **Tools**: Built-in tools (Command, File, Unix commands) with a permission system.
        *   **Token Compression**: Content, context, history compression.
        *   **Adventure Mode**: Interactive branching interface.
        *   **Autonomous Mode**: Proactive execution.
    *   *Key Files*:
        *   `src/cli.ts`: Entry point.
        *   `src/repl.ts`: Interactive session manager.
        *   `src/ai.ts`: API interaction layer.
        *   `src/agents/`: Multi-agent implementations.
        *   `src/ultrathink/`: ToT and ReAct implementations.
        *   `src/tools/`: Tool registry and built-ins.
        *   `src/scanner.ts`: Project file scanner.
        *   `prompts/`: System prompts for different agents/modes.
        *   `settings.json`: API keys and configuration.
    *   *Development Guide*:
        *   Build: `npm run build` (implied by tsconfig/package.json).
        *   Run: `npx ts-node src/cli.ts` or `node dist/index.js`.
        *   Test: `npm test` (Jest) or specific test files via `ts-node`.
        *   Config: `settings.json` or `.env`.
    *   *Important Notes*:
        *   Permission system allows/disallows specific actions.
        *   Supports multiple AI providers (OpenAI, Zhipu AI).
        *   Heavily documented with markdown files for each phase/feature.
        *   Token optimization is a key feature for cost efficiency.

    *   *Project Overview*: Newma (牛码) is an enterprise-grade, AI-driven multi-agent CLI development assistant (v3.1.0) designed to automate coding workflows. It utilizes a "plan → search → execute → verify" loop, integrating advanced reasoning techniques like Tree of Thoughts and ReAct, along with a robust tool-calling architecture.

    *   *Tech Stack*:
        *   **Languages**: TypeScript (Primary), Python (Prototypes/Tests), JavaScript
        *   **Runtime**: Node.js
        *   **Libraries**: Commander (CLI), Inquirer (Prompts), Chalk (Styling), node-fetch (API calls)
        *   **Testing**: Jest, ts-node
        *   **AI**: OpenAI API (and compatible APIs like Zhipu AI GLM-4)

    *   *Architecture*:
        *   **Multi-Agent System**: Specialized agents (Frontend, Backend, Testing, Documentation) coordinated by a central orchestrator.
        *   **Reasoning Engines**:
            *   **Ultrathink**: Combines Tree of Thoughts (ToT) for planning and ReAct (Reasoning + Acting) for verification.
            *   **Four-Step Loop**: Reasoner (plan) → Executor (act) → Observer (check) → Repairer (fix).
        *   **Execution Modes**:
            *   **Two-Phase**: Separates planning and execution into distinct agents.
            *   **Adventure Mode**: Interactive text-adventure style branching for user control.
            *   **Autonomous Mode**: Fully automated execution.
        *   **Tool System**: Extensible registry with permission checking and support for Unix commands, file operations, and shell commands.
        *   **Optimization**: Comprehensive token compression system for context, history, and content to reduce costs.

    *   *Key Files and Their Purposes*:
        *   **`src/cli.ts`**: Main entry point defining CLI commands and flags.
        *   **`src/ai.ts`**: Handles LLM API interactions and response parsing.
        *   **`src/agents/`**: Contains specialized agent implementations (Backend, Frontend, etc.) and coordinators.
        *   **`src/ultrathink/`**: Implements ToT (`tree-of-thoughts.ts`) and ReAct (`react-loop.ts`) logic.
        *   **`src/tools/`**: Defines the tool interface and implements built-in tools (file, command).
        *   **`src/scanner.ts`**: Scans project directories to build context.
        *   **`prompts/`**: Directory holding system prompts for various agents and modes.
        *   **`settings.json`**: Configuration file for API keys and base URLs.

    *   *Development Guide*:
        *   **Setup**: Install dependencies via `npm install`. Configure API keys in `settings.json`.
        *   **Build**: Compile TypeScript using `npm run build` (or `tsc`).
        *   **Run**: Execute with `npm start` or `node dist/index.js`.
        *   **Testing**: Run unit tests with `npm test` (Jest). Individual integration tests can be run via `npx ts-node [test-file]`.
        *   **Usage**: Start the REPL to interact with the assistant using commands like `/plan`, `/do`, `/loop`, and `/init`.

    *   *Important Notes*:
        *   **Permissions**: The system includes a robust permission layer to control dangerous operations (e.g., `rm -rf`).
        *   **Cost Management**: Token compression is enabled by default to minimize API costs.
        *   **Extensibility**: New tools and agents can be added by implementing the defined interfaces in `src/tools/types.ts` and `src/agents/types.ts`.
        *   **Documentation**: The project includes extensive documentation (`.md` files) detailing design decisions, bug fixes, and implementation summaries for each development phase.

    *   *Self-Correction during drafting*: Ensure the distinction between the Two-Phase system and the Four-Step loop is clear in the architecture section. Mention Zhipu AI as it's in the settings.

---

*This file is automatically generated by the `/init` command. You can edit it manually to add additional context or corrections.*
