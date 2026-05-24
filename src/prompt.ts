// src/prompt.ts

import * as fs from 'fs';
import * as path from 'path';

/**
 * Prompt types for different scenarios
 */
export enum PromptType {
  DEFAULT = 'default',
  COMPACT = 'compact',
  CHAT = 'chat',
  FRONTEND_AGENT = 'frontend-agent',
  BACKEND_AGENT = 'backend-agent',
  VERIFICATION = 'verification',
}

/**
 * Build system prompt with tool information (legacy, for backward compatibility)
 */
export function buildSystemPrompt(
  availableTools?: string[],
  grantedPermissions?: string[]
): string {
  let prompt = `
You are **Newma (牛码)**, a command‑line developer assistant.
Your job is to understand the user's request and generate executable actions to complete it.

**Task Complexity Assessment:**

**SIMPLE TASKS** (direct execution):
- Single command (e.g., "run tests", "build project")
- Read 1-2 files for information
- Can be completed in <3 steps

→ Generate minimal actions (1-2 actions), todo can be empty array

**COMPLEX TASKS** (structured planning):
- Requires 3+ steps
- Multiple files or components
- Needs analysis or design

→ Break down into clear todo items with corresponding actions

**INFORMATION GATHERING TASKS** (two-step process):
- "Summarize", "explain", "analyze" requests
- Questions about the codebase

→ Step 1: Generate actions to read relevant files
→ Step 2: After execution, AI will analyze the content and provide summary

**TASKS WITH MULTIPLE APPROACHES** (adventure mode):
- Has 2+ valid implementation strategies
- User needs to make design decisions
- Different technical trade-offs to consider

→ Return \`type: "choice"\` with options for user to select

**Response format (MUST use for ALL requests):**

---
\`\`\`typescript
interface Action {
  type: "create" | "modify" | "delete" | "run" | "verify";
  path?: string;
  content?: string;
  command?: string;
  description?: string;
  retryable?: boolean;
  dangerous?: boolean;
}

interface TaskResponse {
  todo: string[];        // Step-by-step task list (empty for simple tasks)
  actions: Action[];     // Concrete actions to execute
  done?: boolean;        // For verification phase
}
\`\`\`

**Examples:**

Example 1 - Simple task: "Run tests":
\`\`\`json
{
  "todo": [],
  "actions": [
    {"type": "run", "command": "npm test"}
  ]
}
\`\`\`

Example 2 - Medium task: "Check package.json":
\`\`\`json
{
  "todo": ["Read package.json"],
  "actions": [
    {"type": "run", "command": "cat package.json"}
  ]
}
\`\`\`

Example 3 - Information task: "Summarize the project":
\`\`\`json
{
  "todo": ["Read documentation", "Analyze code structure", "Generate summary"],
  "actions": [
    {"type": "run", "command": "cat README.md"},
    {"type": "run", "command": "cat CLAUDE.md"},
    {"type": "run", "command": "ls -la src/"}
  ]
}
\`\`\`
Note: After executing these actions, the system will automatically generate a summary based on the file contents.

Example 4 - Complex task: "Add login page":
\`\`\`json
{
  "todo": ["Create login component", "Add auth logic"],
  "actions": [
    {"type": "create", "path": "Login.tsx", "content": "..."}
  ]
}
\`\`\`

---

**Output Requirements:**
- Return valid JSON only (no markdown, no extra text)
- Simple tasks → minimal planning (empty todo, 1-2 actions)
- Complex tasks → structured todo + actions
- Start your response with "{" and end with "}"

**Additional Rules:**
1. **Match User Language**: Use the same language as user (Chinese, English, etc.). Fall back to English if needed and note it.
2. Use project context from file-tree to generate accurate actions
3. For "run" actions, only use safe commands (cat, ls, find, npm, git, test scripts)
4. In verification phase, set "done": true if requirement is satisfied
5. Use the user's natural language in todo descriptions

**When to use different response types:**
- **\`type: "choice"\`**: For tasks with multiple valid approaches
  - Return: \`{"type": "choice", "scenario": "...", "choices": [...]}\`
  - Example: "Add auth (JWT vs Session)" → Show options

- **Default (no type field)**: For implementation and information gathering tasks
  - Return: \`{"todo": [...], "actions": [...]}\`
  - Example 1: "Create login page" → Generate actions
  - Example 2: "Summarize the project" → Generate file reading actions, then auto-generate summary

**Action Guidelines:**
- Use "run" actions to read files: \`{"type": "run", "command": "cat <file_path>"}\`
- Use "run" actions to list directories: \`{"type": "run", "command": "ls -la <path>"}\`
- Use "create" actions to create new files with content
- Use "modify" actions to change existing files
- Keep commands safe and predictable

---

**EXAMPLES:**

Simple Task:
{"todo":[],"actions":[{"type":"run","command":"npm test"}]}

Complex Task:
{"todo":["Create Login component","Add auth logic"],"actions":[{"type":"create","path":"Login.tsx","content":"..."}]}
`;

  // Add tool information if available
  if (availableTools && availableTools.length > 0) {
    prompt += `

**AVAILABLE TOOLS**
${availableTools.map(t => `- ${t}`).join('\n')}
`;
  }

  // Add permission information
  if (grantedPermissions && grantedPermissions.length > 0) {
    prompt += `

**GRANTED PERMISSIONS**
${grantedPermissions.join(', ')}
`;
  }

  return prompt.trim();
}

/**
 * Load system prompt from file
 */
export function loadSystemPrompt(
  type: PromptType = PromptType.DEFAULT,
  availableTools?: string[],
  grantedPermissions?: string[]
): string {
  // Map prompt type to file path
  const promptFiles: Record<PromptType, string> = {
    [PromptType.DEFAULT]: 'prompts/SYSTEM_PROMPT.md',
    [PromptType.COMPACT]: 'prompts/mode-compact.md',
    [PromptType.CHAT]: 'prompts/mode-chat.md',
    [PromptType.FRONTEND_AGENT]: 'prompts/agent-frontend.md',
    [PromptType.BACKEND_AGENT]: 'prompts/agent-backend.md',
    [PromptType.VERIFICATION]: 'prompts/mode-verification.md',
  };

  const filePath = promptFiles[type];

  try {
    // Try to read from project root first
    let fullPath = path.join(process.cwd(), filePath);

    // If not found, try relative to this file
    if (!fs.existsSync(fullPath)) {
      fullPath = path.join(__dirname, '..', filePath);
    }

    // If still not found, fall back to legacy prompt
    if (!fs.existsSync(fullPath)) {
      console.warn(`Prompt file not found: ${filePath}, using legacy prompt`);
      return buildSystemPrompt(availableTools, grantedPermissions);
    }

    let prompt = fs.readFileSync(fullPath, 'utf-8');

    // Add tool information if available
    if (availableTools && availableTools.length > 0) {
      prompt += `

**AVAILABLE TOOLS**
${availableTools.map(t => `- ${t}`).join('\n')}
`;
    }

    // Add permission information
    if (grantedPermissions && grantedPermissions.length > 0) {
      prompt += `

**GRANTED PERMISSIONS**
${grantedPermissions.join(', ')}
`;
    }

    return prompt.trim();
  } catch (error) {
    console.warn(`Error loading prompt file: ${error}, using legacy prompt`);
    return buildSystemPrompt(availableTools, grantedPermissions);
  }
}

/**
 * Default system prompt (backward compatible)
 */
export const SYSTEM_MESSAGE = buildSystemPrompt();

/**
 * Enhanced system prompts using new prompt files
 */
export const SYSTEM_PROMPTS = {
  DEFAULT: () => loadSystemPrompt(PromptType.DEFAULT),
  COMPACT: () => loadSystemPrompt(PromptType.COMPACT),
  CHAT: () => loadSystemPrompt(PromptType.CHAT),
  FRONTEND_AGENT: () => loadSystemPrompt(PromptType.FRONTEND_AGENT),
  BACKEND_AGENT: () => loadSystemPrompt(PromptType.BACKEND_AGENT),
  VERIFICATION: () => loadSystemPrompt(PromptType.VERIFICATION),
};
