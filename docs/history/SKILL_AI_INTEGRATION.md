# Skill AI Integration Guide

**Inspired by**: OpenDeepWiki's Agent Skills Mechanism
**Date**: 2026-02-10
**Status**: ✅ Phase 1 Complete

## Overview

Newma's skill system now integrates directly with OpenAI Function Calling, allowing AI to discover and execute skills automatically. This implementation is inspired by [OpenDeepWiki's Agent Skills mechanism](https://mp.weixin.qq.com/s/U43xX8T1vKdhqHccL0Qbng).

### Key Features

✅ **AI-Driven Skill Discovery** - AI automatically selects appropriate skills based on user input
✅ **OpenAI Function Calling Integration** - Skills are converted to standard tool definitions
✅ **allowed-tools Mechanism** - Skills can declare which tools they need
✅ **Enhanced Metadata** - License, compatibility, version, author fields
✅ **Skill Registry** - JSON-based skill management
✅ **Skill Executor** - Handles skill execution with caching and error handling

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Tool Integration                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Input → AI Analysis → Tool Call Selection              │
│                    ↓                                          │
│         ┌─────────────────────────┐                          │
│         │   OpenAI Tools List     │                          │
│         ├─────────────────────────┤                          │
│         │ • Built-in Tools        │                          │
│         │ • Skills (converted)    │  ← tool-converter.ts      │
│         └─────────────────────────┘                          │
│                    ↓                                          │
│         Skill Function Call                                   │
│                    ↓                                          │
│         ┌─────────────────────────┐                          │
│         │   Skill Executor        │  ← executor.ts            │
│         │ • Execute Python skill  │                          │
│         │ • Cache results         │                          │
│         │ • Track usage           │                          │
│         └─────────────────────────┘                          │
│                    ↓                                          │
│         Return Result to AI                                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## New Components

### 1. Tool Converter (`src/skills/tool-converter.ts`)

Converts skill metadata to OpenAI Function Calling format.

**Key Functions**:
- `skillToOpenAITool()` - Convert single skill
- `skillsToOpenAITools()` - Convert multiple skills
- `filterSkillsByAllowedTools()` - Filter by tool permissions
- `extractSkillName()` - Extract skill name from function call
- `isSkillFunctionCall()` - Check if call is for a skill

**Example**:
```typescript
import { skillsToOpenAITools } from './skills/tool-converter';

const tools = skillsToOpenAITools(skills);
// Returns:
// [{
//   type: 'function',
//   function: {
//     name: 'skill_code-review',
//     description: 'Skill: Code review expert...\nWhen to use: ...',
//     parameters: { type: 'object', properties: {...} }
//   }
// }]
```

### 2. Skill Registry (`src/skills/registry.ts`)

Lightweight JSON-based registry for managing installed skills.

**Features**:
- Record installed skills with metadata
- Track usage statistics
- Search and filter skills
- Enable/disable skills
- Version management (semver)

**Registry Location**: `.kode/skills/registry.json`

**Key Methods**:
- `registerSkill()` - Register new skill
- `unregisterSkill()` - Remove skill
- `updateSkill()` - Update skill entry
- `searchSkills()` - Search with filters
- `recordUsage()` - Track skill usage

**Example**:
```typescript
import { SkillRegistry } from './skills/registry';

const registry = new SkillRegistry();
await registry.initialize();

await registry.registerSkill(entry);
const skills = registry.searchSkills({ enabled: true });
```

### 3. Skill Executor (`src/skills/executor.ts`)

Executes skills and returns results to AI.

**Features**:
- Execute skill with context
- Result caching (TTL: 5 minutes)
- Error handling
- Usage tracking

**Key Methods**:
- `executeSkill()` - Execute skill by name
- `executeSkillAtPath()` - Execute skill at path
- `clearCache()` - Clear result cache

**Example**:
```typescript
import { SkillExecutor } from './skills/executor';

const executor = new SkillExecutor(skillManager, registry);
const result = await executor.executeSkill('code-review', input, context);
```

### 4. Enhanced Metadata (`src/skills/simple-loader.ts`)

Extended skill metadata with OpenDeepWiki-inspired fields.

**New Fields**:
```yaml
---
name: code-review
description: Expert code review specialist
license: MIT
compatibility:
  - gpt-4
  - claude-3
  - glm-4
allowedTools:
  - read_file
  - search_code
author: Your Name
version: 1.0.0
hasScripts: true
hasReferences: false
hasAssets: false
timeout: 120
async: false
---
```

## AI Integration

### Modified Functions

**`buildToolDefinitions()`** - Now includes skills:
```typescript
export function buildToolDefinitions(
  registry: ToolRegistry,
  skillManager?: SimpleSkillManager  // NEW
): any[]
```

**`callAI()`** - Added skillManager parameter:
```typescript
export async function callAI(
  // ... existing parameters
  skillManager?: SimpleSkillManager  // NEW
): Promise<ExtendedAIResponse>
```

**`chatAI()`** - Added skillManager parameter:
```typescript
export async function chatAI(
  // ... existing parameters
  skillManager?: SimpleSkillManager  // NEW
): Promise<string>
```

### How It Works

1. **Tool Discovery**: AI receives combined list of built-in tools + skills
2. **Skill Selection**: AI chooses appropriate skill based on description
3. **Execution**: Skill executor runs the skill and returns result
4. **Response**: AI uses skill result to complete task

## Example Workflow

### Step 1: Create a Skill

**SKILL.md**:
```yaml
---
name: git-expert
description: Git operations expert
type: hybrid
tags: [git, version-control]
triggers:
  - git commit
  - create branch
  - merge conflict
allowedTools:
  - run_command
---
```

### Step 2: AI Discovers Skill

```typescript
const skillManager = new SimpleSkillManager();
await skillManager.discoverSkills();

const response = await callAI(config, projectInfo, "Create a new branch", ..., skillManager);
```

### Step 3: AI Calls Skill

AI receives tool definition:
```json
{
  "type": "function",
  "function": {
    "name": "skill_git-expert",
    "description": "Skill: Git operations expert...",
    "parameters": {
      "type": "object",
      "properties": {
        "input": { "type": "string" },
        "context": { "type": "object" }
      }
    }
  }
}
```

AI returns:
```json
{
  "tool_calls": [{
    "function": {
      "name": "skill_git-expert",
      "arguments": "{\"input\":\"Create a new branch feature-x\"}"
    }
  }]
}
```

### Step 4: Execute Skill

```typescript
const executor = new SkillExecutor(skillManager, registry);
const result = await executor.executeSkill('git-expert', 'Create a new branch feature-x');
```

## allowed-tools Mechanism

Skills can declare which tools they need using the `allowedTools` field:

```yaml
---
allowedTools:
  - read_file
  - search_code
  - run_command
---
```

**Filtering Logic**:
- If skill declares `allowedTools`, only enable if all tools are available
- If no `allowedTools`, skill is always enabled
- Checked before converting skill to tool definition

**Implementation**:
```typescript
const availableTools = toolRegistry.list().map(t => t.name);
const enabledSkills = filterSkillsByAllowedTools(allSkills, availableTools);
```

## Usage Statistics

Registry tracks skill usage:

```typescript
await registry.recordUsage('git-expert');
```

**Stats Available**:
- `usageCount` - Times executed
- `lastUsedAt` - Last execution timestamp
- Total statistics across all skills

## Future Enhancements (Phase 2)

### Skill Validator
Validate SKILL.md format:
- Name format (kebab-case)
- Required fields
- allowed-tools syntax

### Skill Installer
Install skills from ZIP/URL:
```bash
newma skill install skill.zip
newma skill install https://example.com/skill.zip
```

### CLI Commands
```bash
newma skill list              # List installed skills
newma skill enable <name>      # Enable skill
newma skill disable <name>     # Disable skill
newma skill uninstall <name>   # Remove skill
newma skill validate <path>    # Validate skill
```

## Testing

Manual testing steps:

1. **Create Test Skill**:
   ```bash
   mkdir -p .kode/skills/test-skill
   cat > .kode/skills/test-skill/SKILL.md << 'EOF'
   ---
   name: test-skill
   description: Test skill for AI integration
   type: knowledge
   triggers:
     - test
     - hello
   ---
   You are a test skill. Say hello!
   EOF
   ```

2. **Run Newma with Skills**:
   ```bash
   npx newma-cli -i
   > /skills load
   > Say hello
   ```

3. **Verify AI Integration**:
   - AI should discover `skill_test-skill` in tools list
   - AI should call skill when "hello" is detected
   - Skill should execute and return result

## Design Decisions

### JSON Registry vs Database
**Choice**: JSON file (`.kode/skills/registry.json`)
**Reason**: Simpler, no external dependencies, sufficient for CLI tool

### Python Execution
**Choice**: Keep existing Python executor
**Reason**: Already works, well-tested, supports complex logic

### Function Name Prefix
**Choice**: `skill_` prefix (e.g., `skill_code-review`)
**Reason**: Clear distinction from built-in tools, avoids conflicts

### Cache TTL
**Choice**: 5 minutes (300 seconds)
**Reason**: Balance between freshness and performance

## Performance Impact

- **Tool List Size**: +1 tool per skill (minimal impact)
- **AI Response Time**: No change (skills filtered client-side)
- **Execution Time**: Added skill execution overhead (managed by executor)

## Security Considerations

- Skills run with same permissions as main process
- `allowedTools` mechanism provides basic permission control
- Timeout protection (default: 120s)
- Cache poisoning prevention (TTL-based invalidation)

## Troubleshooting

### Skill Not Appearing in AI Tools

**Check**:
1. Skill enabled in registry?
2. `allowedTools` satisfied?
3. Name format valid (kebab-case)?

### Skill Execution Failing

**Check**:
1. Python executor path correct?
2. SKILL.md syntax valid?
3. Required tools available?

### High Memory Usage

**Solution**:
- Clear skill executor cache: `executor.clearCache()`
- Reduce cache TTL in options

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Project overview
- [ENHANCED_SKILL_SYSTEM_COMPLETE.md](./ENHANCED_SKILL_SYSTEM_COMPLETE.md) - Skill system details
- [OpenDeepWiki Article](https://mp.weixin.qq.com/s/U43xX8T1vKdhqHccL0Qbng) - Inspiration source

## Credits

- **Inspired by**: [OpenDeepWiki's Agent Skills Mechanism](https://mp.weixin.qq.com/s/U43xX8T1vKdhqHccL0Qbng) by tokengo
- **Implementation**: Newma (牛码) Development Team
- **Date**: 2026-02-10
