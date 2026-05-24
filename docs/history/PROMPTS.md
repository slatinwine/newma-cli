# Newma (牛码) System Prompts Guide

## Overview

Newma (牛码) v3.0.0 includes a comprehensive system prompt architecture based on analysis of leading AI systems (OpenAI GPT-5, Anthropic Claude, Google Gemini, and others).

## Prompt Files

### Main System Prompt
- **File**: `SYSTEM_PROMPT.md`
- **Purpose**: Default comprehensive prompt for all operations
- **When to use**: Standard operations, full context available

### Specialized Prompts

#### 1. Compact Mode (`prompts/mode-compact.md`)
- **Purpose**: Token-constrained scenarios
- **When to use**:
  - Large codebases with limited context
  - Simple, straightforward tasks
  - When you need faster responses

**Usage**:
```typescript
import { loadSystemPrompt, PromptType } from './src/prompt';

const prompt = loadSystemPrompt(PromptType.COMPACT);
```

#### 2. Frontend Agent (`prompts/agent-frontend.md`)
- **Purpose**: Specialized for frontend development
- **When to use**:
  - UI component creation/modification
  - Styling and CSS
  - Frontend frameworks (React, Vue, Angular)
  - State management (Redux, Zustand, Context)

**Usage**:
```typescript
const prompt = loadSystemPrompt(PromptType.FRONTEND_AGENT);
```

**Specializes in**:
- Component architecture
- Styling systems (Tailwind, CSS-in-JS, CSS modules)
- Responsive design
- Accessibility (WCAG)
- Performance optimization

#### 3. Backend Agent (`prompts/agent-backend.md`)
- **Purpose**: Specialized for backend development
- **When to use**:
  - API endpoint development
  - Database operations
  - Authentication/authorization
  - Server-side logic

**Usage**:
```typescript
const prompt = loadSystemPrompt(PromptType.BACKEND_AGENT);
```

**Specializes in**:
- REST/GraphQL APIs
- Database design and migrations
- Security best practices
- Error handling
- Performance optimization

#### 4. Verification Mode (`prompts/mode-verification.md`)
- **Purpose**: Verify task completion
- **When to use**:
  - After executing actions
  - Quality assurance phase
  - Before marking task as done

**Usage**:
```typescript
const prompt = loadSystemPrompt(PromptType.VERIFICATION);
```

**What it checks**:
- All requirements satisfied
- Code compiles/builds
- Tests pass
- No security vulnerabilities
- Code follows conventions

## Architecture Principles

### 1. Modularity
Each prompt is self-contained and focused on a specific scenario. This makes them:
- Easier to maintain
- Faster to load
- More specialized and effective

### 2. Backward Compatibility
The legacy `buildSystemPrompt()` function is preserved, so existing code continues to work without changes.

### 3. Progressive Enhancement
Start with the default prompt, then use specialized prompts as needed:
```
Default → Compact (for simple tasks)
Default → Frontend/Backend Agent (for specialized tasks)
Default → Verification (for QA phase)
```

### 4. Context Awareness
Prompts automatically include:
- Available tools
- Granted permissions
- Environment details

## Usage Examples

### Example 1: Standard Usage (Default Prompt)
```typescript
import { loadSystemPrompt, PromptType } from './src/prompt';

// Load default comprehensive prompt
const systemPrompt = loadSystemPrompt(
  PromptType.DEFAULT,
  ['file', 'command'], // available tools
  ['read', 'write']    // granted permissions
);

// Use with AI
const response = await callAI(config, projectInfo, requirement, systemPrompt);
```

### Example 2: Frontend Task
```typescript
// User wants to create a React component
const requirement = "Add a user profile card component";

// Use frontend agent for specialized guidance
const systemPrompt = loadSystemPrompt(PromptType.FRONTEND_AGENT);

const response = await callAI(config, projectInfo, requirement, systemPrompt);
```

### Example 3: Backend Task
```typescript
// User wants to create an API endpoint
const requirement = "Add a user registration endpoint";

// Use backend agent for specialized guidance
const systemPrompt = loadSystemPrompt(PromptType.BACKEND_AGENT);

const response = await callAI(config, projectInfo, requirement, systemPrompt);
```

### Example 4: Verification Phase
```typescript
// After executing actions, verify completion
const systemPrompt = loadSystemPrompt(PromptType.VERIFICATION);

const verification = await callAI(
  config,
  projectInfo,
  originalRequirement,
  systemPrompt,
  executionHistory
);

if (verification.done) {
  console.log('✅ Task completed successfully');
} else {
  console.log('❌ More work needed');
  // Execute the new plan returned by verification
}
```

### Example 5: Token-Constrained Scenario
```typescript
// Large codebase, need to save tokens
const systemPrompt = loadSystemPrompt(PromptType.COMPACT);

const response = await callAI(config, projectInfo, requirement, systemPrompt);
```

## Best Practices

### 1. Choose the Right Prompt
- **Default**: Most cases, when you have sufficient context
- **Compact**: Large codebases, simple tasks
- **Agent**: Specialized tasks (frontend/backend)
- **Verification**: QA phase only

### 2. Combine with Execution History
Verification mode works best when you provide complete execution history:
```typescript
const verificationPrompt = loadSystemPrompt(PromptType.VERIFICATION);
const verification = await callAI(
  config,
  projectInfo,
  requirement,
  verificationPrompt,
  tracker.getHistory() // Pass execution history
);
```

### 3. Use Agent Prompts for Multi-Agent System
In multi-agent mode (Phase 3), each agent should use its specialized prompt:
```typescript
// Frontend Agent
const frontendAgent = new FrontendAgent(toolExecutor, tracker);
frontendAgent.setSystemPrompt(loadSystemPrompt(PromptType.FRONTEND_AGENT));

// Backend Agent
const backendAgent = new BackendAgent(toolExecutor, tracker);
backendAgent.setSystemPrompt(loadSystemPrompt(PromptType.BACKEND_AGENT));
```

### 4. Fall Back Gracefully
The system automatically falls back to legacy prompt if files are missing:
```typescript
// This will work even if prompt files don't exist
const prompt = loadSystemPrompt(PromptType.DEFAULT);
// Falls back to buildSystemPrompt() if file not found
```

## Integration with Existing Code

### Updating AI Calls
If you're currently using `buildSystemPrompt()`:

**Before**:
```typescript
const prompt = buildSystemPrompt(availableTools, grantedPermissions);
```

**After** (using new system):
```typescript
const prompt = loadSystemPrompt(PromptType.DEFAULT, availableTools, grantedPermissions);
```

**Or** (keep using legacy - still works!):
```typescript
const prompt = buildSystemPrompt(availableTools, grantedPermissions);
```

### CLI Usage
If adding CLI option for prompt type:
```typescript
// src/cli.ts
program
  .option('--prompt-type <type>', 'Prompt type to use', 'default')
  .parse(process.argv);

const options = program.opts();
const promptType = options.promptType === 'compact' ? PromptType.COMPACT : PromptType.DEFAULT;
const systemPrompt = loadSystemPrompt(promptType, availableTools, grantedPermissions);
```

## Prompt Design Philosophy

### What We Learned from Industry Leaders

1. **Clarity First** (Claude, GPT-5)
   - Clear role definition
   - Explicit boundaries
   - Concrete examples

2. **Conciseness** (Codex CLI, Claude Code)
   - CLI tools should be brief
   - One-word answers for simple questions
   - No unnecessary preamble/postamble

3. **Security Conscious** (All major systems)
   - Prompt injection defense
   - Malicious code refusal
   - PII protection
   - Input validation requirements

4. **Tool Awareness** (GPT-5 Agent, Claude Code)
   - When to use which tool
   - Tool permissions
   - Parallel execution

5. **Verification Focused** (Claude, GPT-5)
   - Plan → Execute → Verify loop
   - Quality checks
   - Testing requirements

6. **Agent Specialization** (GPT-5 Agent)
   - Domain expertise (frontend/backend)
   - Specialized agents for specific tasks
   - Coordination through system

### Custom Design for Newma (牛码)

Our prompt system adds:

1. **Project Context Awareness**
   - CLAUDE.md integration
   - Git history awareness
   - File tree structure

2. **Phase-based Architecture**
   - Phase 1: Infrastructure foundation
   - Phase 2: Tools & permissions
   - Phase 3: Multi-agent system
   - Phase 4: Interactive REPL

3. **Rollback Capability**
   - Git-based checkpoints
   - Automatic restoration points
   - Safe experimentations

4. **Modular File-based Prompts**
   - Easy to update
   - Easy to extend
   - Easy to test

## Extending the System

### Adding a New Prompt Type

1. **Create the prompt file**:
```bash
# Create prompts/agent-testing.md
```

2. **Add to PromptType enum**:
```typescript
// src/prompt.ts
export enum PromptType {
  DEFAULT = 'default',
  COMPACT = 'compact',
  FRONTEND_AGENT = 'frontend-agent',
  BACKEND_AGENT = 'backend-agent',
  VERIFICATION = 'verification',
  TESTING_AGENT = 'testing-agent', // NEW
}
```

3. **Update the file mapping**:
```typescript
const promptFiles: Record<PromptType, string> = {
  // ... existing mappings
  [PromptType.TESTING_AGENT]: 'prompts/agent-testing.md', // NEW
};
```

4. **Export helper** (optional):
```typescript
export const SYSTEM_PROMPTS = {
  // ... existing
  TESTING_AGENT: () => loadSystemPrompt(PromptType.TESTING_AGENT),
};
```

### Customizing Prompts

Edit the prompt files directly to customize:
- `SYSTEM_PROMPT.md` - Main system behavior
- `prompts/agent-frontend.md` - Frontend specialization
- `prompts/agent-backend.md` - Backend specialization
- `prompts/mode-verification.md` - Verification criteria
- `prompts/mode-compact.md` - Token-constrained mode

## Troubleshooting

### Prompt File Not Found
**Warning**: `Prompt file not found: prompts/foo.md, using legacy prompt`

**Solution**:
- Ensure prompt files exist in the project root
- Or ensure they exist in `dist/` after build
- Or use legacy `buildSystemPrompt()` instead

### Fallback to Legacy Prompt
If prompt files are missing, the system automatically falls back to the legacy `buildSystemPrompt()` function. This ensures backward compatibility.

### Testing Prompts
To test a prompt without executing actions:
```bash
# In REPL mode
/prompts frontend  # Use frontend agent prompt
/prompts backend   # Use backend agent prompt
/prompts default   # Use default prompt
```

## Future Improvements

Potential additions:
1. **More Agents**
   - Testing Agent
   - DevOps Agent
   - Documentation Agent

2. **Dynamic Prompt Assembly**
   - Combine multiple prompt modules
   - Context-aware prompt selection
   - Learning from past executions

3. **Prompt Versioning**
   - Track prompt versions
   - A/B testing different prompts
   - Performance metrics

4. **User Customization**
   - Allow users to add custom prompts
   - Share prompt configurations
   - Community prompt library

---

**Last Updated**: Version 3.0.0
**Based On**: Analysis of OpenAI GPT-5, Anthropic Claude Code, Google Gemini, and other leading AI systems
