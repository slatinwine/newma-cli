# Lessons Learned: Implementing `/init` Command

## Overview

This document captures key lessons learned while implementing the `/init` command for the Newma (牛码) CLI project. The goal was to create a command that would scan an entire project and generate a comprehensive AI-powered summary.

## Table of Contents

1. [AI Prompt Engineering](#ai-prompt-engineering)
2. [Handling AI Output](#handling-ai-output)
3. [Performance Optimization](#performance-optimization)
4. [Testing Strategy](#testing-strategy)
5. [Common Pitfalls](#common-pitfalls)
6. [Best Practices](#best-practices)

---

## AI Prompt Engineering

### Lesson 1: Be Explicit About Output Format

**Problem**: AI was returning its thinking process instead of clean markdown.

**Initial Approach**:
```typescript
const prompt = `Please analyze this project and generate a comprehensive summary...
Please provide a structured summary with:
1. Project Overview
2. Tech Stack
...`;
```

**Issue**: AI interpreted this as a request to show its work.

**Solution**:
```typescript
const prompt = `Analyze the following project files and generate a markdown document.

REQUIREMENTS:
- Output ONLY the markdown document above
- Start immediately with "## Project Overview"
- Do NOT include explanations, thinking process, or meta-commentary
- Use proper markdown formatting`;
```

**Key Takeaway**:
- Use explicit "REQUIREMENTS" or "CONSTRAINTS" sections
- Be directive: "Output ONLY..."
- Use negative constraints: "Do NOT include..."
- Specify the exact starting format

### Lesson 2: Don't Overwhelm the AI with Data

**Problem**: Sending entire project files caused AI to hallucinate or return garbage.

**Initial Approach**:
```typescript
const prompt = `PROJECT STRUCTURE:
${JSON.stringify(projectInfo, null, 2)}  // 200+ files with full content
`;
```

**Issue**:
- Token explosion
- AI overwhelmed by data volume
- Unusual output formats

**Solution**:
```typescript
// Create simplified file previews
const fileSummary = files.map(file => {
  const content = projectInfo[file];
  const preview = content.split('\n').slice(0, 5).join('\n').substring(0, 200);
  return `- **${file}**:\n\`\`\`\n${preview}\n\`\`\``;
}).join('\n\n');

const prompt = `## Files to Analyze

${fileSummary}`;
```

**Key Takeaway**:
- Limit content: First 5 lines, max 200 characters
- Use previews instead of full content
- Structure data clearly (markdown lists, not JSON)
- Consider token limits in prompts

---

## Handling AI Output

### Lesson 3: Post-Process AI Responses

**Problem**: Even with good prompts, AI sometimes includes extra content.

**Initial Approach**:
```typescript
const summary = await chatAI(config, prompt);
return summary;  // Trust the AI completely
```

**Issue**: Output included thinking process, meta-commentary, etc.

**Solution**:
```typescript
let rawSummary = await chatAI(config, prompt);

// Extract the actual markdown
const overviewMatch = rawSummary.match(/## Project Overview[\s\S]*$/m);
if (overviewMatch) {
  summary = overviewMatch[0];
}

return summary;
```

**Key Takeaway**:
- Never trust AI output 100%
- Use regex or parsing to extract needed content
- Look for known markers (headers, patterns)
- Have fallbacks for when extraction fails

### Lesson 4: Test AI Prompts in Isolation

**Problem**: Testing `/init` required full project scan (60+ seconds).

**Solution**: Create isolated test files
```typescript
// test-improved-prompt.ts
const mockProjectInfo = {
  'src/cli.ts': `import ...`,
  'package.json': `{...}`,
  'README.md': `# Project...`
};

// Test prompt with small dataset
const summary = await chatAI(config, prompt);
console.log(summary);
```

**Key Takeaway**:
- Create unit tests for AI prompts
- Use small, controlled datasets
- Test prompt iterations quickly (seconds vs minutes)
- Verify output quality before full integration

---

## Performance Optimization

### Lesson 5: Batch Processing for Large File Sets

**Problem**: Scanning 200+ files caused timeouts or memory issues.

**Initial Approach**:
```typescript
// Try to scan everything at once
const projectInfo = await scanDirectory(root, {
  listOnly: false,
  maxFiles: 200  // Too many!
});
```

**Issue**: Slow, memory-intensive, potential timeouts.

**Solution**:
```typescript
const BATCH_SIZE = 5;

// Step 1: Get file list only (fast)
const fileList = await scanDirectory(root, {
  listOnly: true,
  maxFiles: 1000
});

// Step 2: Process in batches
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);

  // Read only this batch
  for (const file of batch) {
    const content = await fs.readFile(file, 'utf-8');
    const preview = content.split('\n').slice(0, 200);
    allProjectInfo[file] = preview.join('\n');
  }

  // Small delay to avoid overwhelming
  await new Promise(resolve => setTimeout(resolve, 50));
}
```

**Key Takeaway**:
- Separate "list" from "read" operations
- Process in small batches (5-10 items)
- Add delays between batches
- Show progress to user

### Lesson 6: Filter Unnecessary Content Early

**Problem**: Scanning node_modules, .git, dist wastes time and tokens.

**Solution**:
```typescript
const files = Object.keys(fileList).filter(file => {
  const excludePatterns = [
    'node_modules/',
    '.git/',
    'dist/',
    'coverage/'
  ];

  return !excludePatterns.some(pattern => file.startsWith(pattern));
});
```

**Key Takeaway**:
- Filter as early as possible
- Know what doesn't need scanning
- Save time and tokens
- Reduce noise for AI

---

## Testing Strategy

### Lesson 7: Progressive Testing

**Approach**:
1. **Unit Test** (`test-improved-prompt.ts`)
   - Small mock dataset (3 files)
   - Test prompt quality
   - Verify output format
   - Fast iteration (seconds)

2. **Integration Test** (`test-init.sh`)
   - Real project scan
   - Full pipeline
   - Verify KODE.md creation
   - Slower but comprehensive

3. **Manual Test**
   - Interactive REPL
   - Real-world usage
   - User experience validation

**Key Takeaway**:
- Test at multiple levels
- Start fast and small
- Progress to full integration
- Don't skip manual testing

---

## Common Pitfalls

### Pitfall 1: Assuming AI Understands Context

**Wrong**:
```typescript
"Generate a summary"  // Too vague
```

**Right**:
```typescript
"Generate a markdown document with these exact sections:
## Project Overview
## Tech Stack
..."
```

### Pitfall 2: Trusting AI Output Blindly

**Wrong**:
```typescript
return await chatAI(config, prompt);
```

**Right**:
```typescript
let output = await chatAI(config, prompt);

// Validate and clean
if (!output.trim()) {
  return fallbackOutput;
}

// Extract relevant portion
const match = output.match(/## Project Overview/);
return match ? match[0] : output;
```

### Pitfall 3: Not Handling Errors Gracefully

**Wrong**:
```typescript
const content = await fs.readFile(file, 'utf-8');
```

**Right**:
```typescript
try {
  const content = await fs.readFile(file, 'utf-8');
  allProjectInfo[file] = content;
} catch (err) {
  // Skip unreadable files, don't fail entire operation
  allProjectInfo[file] = `[Error: ${err.message}]`;
}
```

---

## Best Practices

### 1. Prompt Engineering

**DO**:
- Use explicit requirements sections
- Specify exact output format
- Include examples if helpful
- Use negative constraints ("Do NOT include...")
- Test prompts in isolation

**DON'T**:
- Be vague or ambiguous
- Assume AI knows what you want
- Send massive amounts of data
- Skip prompt testing

### 2. Output Processing

**DO**:
- Assume AI output needs cleaning
- Use regex/parsing to extract content
- Have fallbacks for failures
- Validate output quality

**DON'T**:
- Trust AI output 100%
- Skip post-processing
- Assume consistent format
- Forget error handling

### 3. Performance

**DO**:
- Process in batches
- Filter unnecessary data early
- Show progress to users
- Add delays between heavy operations

**DON'T**:
- Process everything at once
- Scan known useless directories
- Leave users wondering if it's working
- Overwhelm the system

### 4. Testing

**DO**:
- Create unit tests for AI prompts
- Test with small datasets first
- Progress to integration tests
- Do manual testing

**DON'T**:
- Only test with full system
- Skip unit testing
- Assume it works without verification
- Forget edge cases

---

## Code Examples

### Complete Pattern: AI Prompt + Processing

```typescript
// 1. Prepare data
const fileSummary = files.map(file => {
  const preview = getContentPreview(projectInfo[file]);
  return `- **${file}**:\n\`\`\`\n${preview}\n\`\`\``;
}).join('\n\n');

// 2. Create prompt with explicit requirements
const prompt = `Analyze the following project files.

## Files to Analyze
${fileSummary}

Generate a markdown document with:
## Project Overview
## Tech Stack
...

REQUIREMENTS:
- Output ONLY the markdown document
- Start with "## Project Overview"
- No thinking process or meta-commentary`;

// 3. Call AI
let rawSummary = await chatAI(config, prompt);

// 4. Extract and clean
let summary = rawSummary;
const match = rawSummary.match(/## Project Overview[\s\S]*$/m);
if (match) {
  summary = match[0];
}

// 5. Fallback
if (!summary.trim()) {
  summary = getFallbackSummary();
}

return summary;
```

---

## Metrics and Results

### Before Optimization
- **Files Scanned**: 10 (limit)
- **AI Output Quality**: Poor (garbled, thinking process)
- **User Experience**: Confusing output
- **Test Iteration Time**: 60+ seconds per test

### After Optimization
- **Files Scanned**: 119 (filtered from 204)
- **AI Output Quality**: Good (clean markdown)
- **User Experience**: Clear, structured summary
- **Test Iteration Time**: 20 seconds (unit test)

---

## Conclusion

Implementing the `/init` command required careful attention to:

1. **AI Prompt Engineering**: Be explicit, constrain output, test iteratively
2. **Output Processing**: Never trust AI blindly, always clean and validate
3. **Performance**: Batch processing, smart filtering, progress feedback
4. **Testing**: Unit tests first, integration tests second, manual tests last

The most important lesson: **AI is a tool that requires careful engineering, not magic**. Treat it like any other unreliable external service—validate, clean, and have fallbacks.

---

**Document Version**: 1.0
**Last Updated**: 2026-01-18
**Author**: Newma (牛码) Development Team
**Status**: Complete ✅
