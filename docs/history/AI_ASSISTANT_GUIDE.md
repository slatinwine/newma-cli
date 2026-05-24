# AI Assistant Working Guidelines 🤖

**Purpose**: This document provides comprehensive guidelines for Claude Code (the AI assistant) on how to work effectively with codebases. It covers decision-making frameworks for task management, tool selection, and execution strategies.

**Target Audience**: Claude Code AI Assistant
**Version**: 1.0.0
**Last Updated**: 2025-01-18

---

## Table of Contents

- [TodoWrite Decision Framework](#todowrite-decision-framework)
- [Tool Selection Priority](#tool-selection-priority)
- [Execution Modes](#execution-modes)
- [Practical Examples](#practical-examples)
- [Integration with Codebases](#integration-with-codebases)

---

## TodoWrite Decision Framework

### When to Use TodoWrite

#### ✅ **Must Use TodoWrite** for:

1. **Complex Multi-Step Tasks** (≥3 steps)
   ```typescript
   Task: "Implement user authentication system"
   Steps:
   1. Analyze existing code structure
   2. Design authentication architecture
   3. Implement backend logic
   4. Create frontend components
   5. Add error handling
   6. Write tests

   → Requires TodoWrite (6 steps, non-trivial)
   ```

2. **User Explicitly Requests Todo List**
   ```typescript
   User: "Create a TODO list to track this task"
   → Must use TodoWrite
   ```

3. **User Provides Multiple Tasks**
   ```typescript
   User: "Help me: 1. Fix bug, 2. Add feature, 3. Update docs"
   → Must use TodoWrite
   ```

#### ❌ **Should NOT Use TodoWrite** for:

1. **Single Simple Tasks**
   ```typescript
   User: "Read package.json"
   → Direct Read, no TodoWrite needed
   ```

2. **Tasks Completible in <3 Simple Steps**
   ```typescript
   User: "Run tests"
   1. Run npm test
   2. Check results

   → Too simple, no TodoWrite needed
   ```

3. **Pure Conversational/Informational Tasks**
   ```typescript
   User: "What does this project do?"
   → Direct answer, no TodoWrite needed
   ```

### TodoWrite State Management

**Always follow this workflow**:

```typescript
// 1. Create todos with both content and activeForm
TodoWrite({
  todos: [
    {
      content: "Run tests",              // Imperative form
      status: "pending",
      activeForm: "Running tests"        // Present continuous
    },
    {
      content: "Fix any failing tests",
      status: "pending",
      activeForm: "Fixing failing tests"
    }
  ]
});

// 2. Mark first task as in_progress before starting
TodoWrite({
  todos: [
    { content: "Run tests", status: "in_progress", activeForm: "Running tests" },
    { content: "Fix any failing tests", status: "pending", activeForm: "Fixing failing tests" }
  ]
});

// 3. Execute the task...

// 4. IMMEDIATELY mark as completed when done
TodoWrite({
  todos: [
    { content: "Run tests", status: "completed", activeForm: "Running tests" },
    { content: "Fix any failing tests", status: "in_progress", activeForm: "Fixing failing tests" }
  ]
});

// 5. Only ONE task should be in_progress at any time
```

**Critical Rules**:

- ✅ Always mark tasks completed IMMEDIATELY after finishing (don't batch)
- ✅ Only ONE task can be `in_progress` at a time
- ✅ Both `content` and `activeForm` are required
- ✅ Keep descriptions specific and actionable

---

## Tool Selection Priority

### File Operations

```typescript
// ✅ PRIORITY: Use specialized tools
Read(file_path)      // Read file contents
Write(file_path)     // Write new file
Edit(file_path)      // Edit existing file
Grep(pattern)        // Search file contents
Glob(pattern)        // Find files by pattern

// ❌ AVOID: Using bash for file operations
Bash("cat file.txt")        // Use Read instead
Bash("echo 'text' > file")  // Use Write instead
Bash("sed 's/old/new'")     // Use Edit instead
Bash("grep 'pattern'")      // Use Grep instead
Bash("find . -name '*.ts'") // Use Glob instead
```

### When to Use Each Tool

```typescript
// 1. Read tool
Read("/path/to/file.ts")
→ Use when: Need to see file contents
→ Returns: Full file content with line numbers

// 2. Write tool
Write("/path/to/new-file.ts", content)
→ Use when: Creating new file (must read first if exists)
→ Returns: Success confirmation

// 3. Edit tool
Edit("/path/to/file.ts", oldString, newString)
→ Use when: Modifying existing file (must read first)
→ Requires: Unique old_string for replacement

// 4. Grep tool
Grep({ pattern: "functionName", outputMode: "content", -n: true })
→ Use when: Searching for code patterns
→ Returns: Matching lines with line numbers

// 5. Glob tool
Glob({ pattern: "**/*.test.ts" })
→ Use when: Finding files by pattern
→ Returns: List of file paths sorted by modification time

// 6. Bash tool
Bash("npm test")
→ Use when: Running system commands (git, npm, docker, etc.)
→ Returns: Command output (stdout/stderr)
```

### When to Use Task Tool

```typescript
// ✅ Use Task for complex exploration
Task("Explore codebase", "Find all API endpoints", Explore)
Task("Review code", "Review recent changes", code-reviewer)
Task("Plan architecture", "Design authentication system", feature-dev:code-architect)

// ❌ Don't use Task for simple operations
Task("Read file", "Read package.json", general-purpose)
// → Just use Read(package.json) directly
```

---

## Execution Modes

### Mode 1: Direct Execution (Simple Tasks)

```markdown
User: "Run the tests"

Flow:
1. Bash("npm test")
2. Analyze output
3. Report results

→ No TodoWrite needed
→ Single response
→ Fast and direct
```

### Mode 2: Planned Execution (Complex Tasks)

```markdown
User: "Implement user authentication system"

Flow:
1. TodoWrite([...]) - Create plan
2. Mark first as in_progress
3. Execute step 1
4. Mark completed, move to step 2
5. Repeat until all done
6. Report final results

→ TodoWrite provides visibility
→ User sees progress
→ Easier to track
```

### Mode 3: Parallel Execution (Independent Operations)

```markdown
User: "Read these three files"

Flow:
Single response with multiple tool calls:
- Read(file1.ts) &
- Read(file2.ts) &
- Read(file3.ts)

→ All execute in parallel
→ Faster than sequential
→ Must be truly independent
```

---

## Decision Flowchart

```
┌─────────────────────────────────────┐
│     Receive User Request            │
└─────────────┬───────────────────────┘
              │
              ▼
     ┌────────────────┐
     │ Evaluate Task   │
     │ Complexity      │
     └────┬───────┬────┘
          │       │
    Simple│       │Complex
          │       │
          ▼       ▼
    ┌─────────┐ ┌──────────────┐
    │ Direct  │ │ TodoWrite    │
    │ Execute │ │ First        │
    └────┬────┘ └──────┬───────┘
         │             │
         ▼             ▼
    ┌─────────┐ ┌──────────────┐
    │ Execute │ │ Mark First   │
    │ Single  │ │ in_progress  │
    │ Action  │ └──────┬───────┘
    └────┬────┘        │
         │             ▼
         │      ┌──────────────┐
         │      │ Execute Step │
         │      └──────┬───────┘
         │             │
         │             ▼
         │      ┌──────────────┐
         │      │ Mark         │
         │      │ Completed    │
         │      │ Move Next    │
         │      └──────┬───────┘
         │             │
         │        More steps?
         │             │
         │        ┌────┴────┐
         │        │         │
         │       No       Yes
         │        │         │
         │        └────┬────┘
         │             │
         └─────────────┴─────────┐
                               │
                               ▼
                        ┌──────────┐
                        │ Report   │
                        │ Results  │
                        └──────────┘
```

---

## Practical Examples

### Example 1: Simple Task (No TodoWrite)

```markdown
User: "Check if TypeScript build passes"

Assistant Action:
Bash("npm run build")

→ Done in one response
→ No todo list needed
```

### Example 2: Medium Task (TodoWrite)

```markdown
User: "Fix failing tests and add new test coverage"

Assistant Actions:
1. TodoWrite([
     { content: "Run tests to identify failures", status: "in_progress", activeForm: "Running tests" },
     { content: "Analyze and fix failing tests", status: "pending", activeForm: "Analyzing and fixing tests" },
     { content: "Add new test coverage", status: "pending", activeForm: "Adding test coverage" },
     { content: "Verify all tests pass", status: "pending", activeForm: "Verifying tests" }
   ])

2. Bash("npm test")
3. Mark first completed, second in_progress
4. Fix issues...
5. Mark second completed, third in_progress
6. Add tests...
7. Mark third completed, fourth in_progress
8. Bash("npm test")
9. Mark all completed
```

### Example 3: Parallel Operations

```markdown
User: "What's in these config files? package.json, tsconfig.json, .eslintrc"

Assistant Actions (all in parallel):
Read("package.json") &
Read("tsconfig.json") &
Read(".eslintrc")

→ Single response, all files read
→ Much faster than sequential
```

### Example 4: Complex Refactoring

```markdown
User: "Refactor the authentication module to use OAuth2"

Assistant Actions:
TodoWrite([
  { content: "Analyze current authentication implementation", status: "in_progress", activeForm: "Analyzing current implementation" },
  { content: "Design OAuth2 integration architecture", status: "pending", activeForm: "Designing OAuth2 architecture" },
  { content: "Implement OAuth2 flow", status: "pending", activeForm: "Implementing OAuth2 flow" },
  { content: "Update dependent code", status: "pending", activeForm: "Updating dependent code" },
  { content: "Write integration tests", status: "pending", activeForm: "Writing integration tests" },
  { content: "Update documentation", status: "pending", activeForm: "Updating documentation" },
  { content: "Run full test suite", status: "pending", activeForm: "Running test suite" }
])

// Then execute each step sequentially...
```

---

## Key Principles

### 1. Simplicity First
- Can do it directly? → Do it directly
- Needs planning? → Use TodoWrite

### 2. Specialized Tools > Bash Commands
- File ops → Read/Write/Edit
- Search → Grep/Glob
- Commands → Bash
- Exploration → Task(Explore)

### 3. Parallel When Possible
- Independent operations → Execute in parallel
- Dependent operations → Execute sequentially

### 4. Transparency
- Complex tasks → Show progress with TodoWrite
- Simple tasks → Just do it, reduce noise

### 5. Immediate Completion Updates
- Finish task → Mark completed immediately
- Don't batch completions
- One task in_progress at a time

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Overusing TodoWrite

```typescript
User: "Run the tests"

// Bad: Creating todo for simple task
TodoWrite([
  { content: "Run tests", status: "in_progress", activeForm: "Running tests" }
])
Bash("npm test")

// Good: Just run the test
Bash("npm test")
```

### ❌ Mistake 2: Using Bash for File Operations

```typescript
User: "Read package.json"

// Bad: Using bash
Bash("cat package.json")

// Good: Using Read tool
Read("package.json")
```

### ❌ Mistake 3: Sequential Independent Operations

```typescript
User: "Read all three config files"

// Bad: Sequential (slow)
Read("package.json")
// then
Read("tsconfig.json")
// then
Read(".eslintrc")

// Good: Parallel (fast)
Read("package.json") &
Read("tsconfig.json") &
Read(".eslintrc")
```

### ❌ Mistake 4: Batching Completion Updates

```typescript
// Bad: Completing multiple tasks at once
TodoWrite([
  { content: "Task 1", status: "completed", ... },
  { content: "Task 2", status: "completed", ... },
  { content: "Task 3", status: "completed", ... }
])

// Good: Complete immediately after each task finishes
// Finish task 1 → TodoWrite({ task1: completed, task2: in_progress })
// Finish task 2 → TodoWrite({ task1: completed, task2: completed, task3: in_progress })
// Finish task 3 → TodoWrite({ all: completed })
```

---

## Testing Your Understanding

**Quiz**: Should you use TodoWrite for these tasks?

1. "Run npm build" → **No** (single command)
2. "Implement full CI/CD pipeline with GitHub Actions" → **Yes** (complex)
3. "What does the readme say?" → **No** (single Read)
4. "Add authentication, fix memory leak, update docs" → **Yes** (multiple tasks)
5. "Create a simple logger utility" → **Borderline** (probably yes, 2-3 steps)

---

## Integration with Codebases

### When Working on Any Codebase

1. **Testing Features**
   - Simple test: `npx ts-node test-phase2.ts` → No TodoWrite
   - Full test suite with analysis → TodoWrite

2. **Adding Features**
   - Add simple tool → No TodoWrite (read source, edit, register)
   - Add complex multi-file feature → TodoWrite

3. **Debugging**
   - Quick check: Read file, analyze → No TodoWrite
   - Deep investigation with multiple steps → TodoWrite

4. **Documentation**
   - Quick doc update → No TodoWrite
   - Major doc restructure → TodoWrite

### Project-Specific Guidelines

When a project has a `CLAUDE.md` file, read it first. It often contains:

1. **Frequently used commands** - build, test, lint
2. **Code style preferences** - naming, libraries, patterns
3. **Codebase structure** - organization and architecture
4. **Project-specific rules** - unique conventions

Adapt your working style to match each project's culture and conventions.

---

## Advanced Tips

### Performance Optimization

1. **Cache Results**: When repeatedly checking the same things
2. **Batch Reads**: Read multiple files in parallel when possible
3. **Lazy Evaluation**: Don't read files until you actually need them
4. **Early Exit**: Stop as soon as you find the answer

### Communication Style

1. **Be Concise**: 1-3 sentences unless user asks for detail
2. **Be Direct**: One-word answers for simple questions ("4", "true", "ls")
3. **No Fluff**: Avoid "The answer is...", "Here is...", "Based on..."
4. **Show, Don't Tell**: Let actions speak, explain only when asked

### Error Handling

1. **Graceful Degradation**: If one tool fails, try alternatives
2. **Clear Error Messages**: Explain what went wrong in user-friendly terms
3. **Suggest Fixes**: Don't just report problems, offer solutions
4. **No Stack Traces**: Unless debugging, keep error messages clean

---

## Quick Reference

### Decision Matrix

| Task Complexity | TodoWrite? | Example |
|----------------|-----------|---------|
| Single command | No | `npm test` |
| Read 1-2 files | No | `Read package.json` |
| 2-3 simple steps | Maybe | Simple refactoring |
| 3+ complex steps | Yes | Feature implementation |
| Multiple tasks | Yes | "Fix bug, add feature, update docs" |
| User requested | Yes | "Create TODO list" |

### Tool Selection

| Operation | Preferred Tool | Alternative |
|-----------|---------------|-------------|
| Read file | Read | - |
| Write file | Write | - |
| Edit file | Edit | - |
| Search content | Grep | Task(Explore) for complex |
| Find files | Glob | - |
| Run command | Bash | - |
| Explore codebase | Task(Explore) | Grep + Glob |

---

**Remember**: The goal is to be efficient, transparent, and helpful. Use TodoWrite when it adds value, skip it when it creates noise. Always prefer specialized tools over bash commands. Execute in parallel when possible. And most importantly, adapt to each project's unique conventions and culture.
