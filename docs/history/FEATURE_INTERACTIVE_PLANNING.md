# FFT Planner - Interactive Planning Feature

**Date**: 2026-01-24
**Feature**: Interactive questions before generating complex task options
**Version**: 3.2.2

## Overview

When the FFT planner detects a **complex task**, instead of immediately generating 3 generic options, it now asks the user **clarifying questions** to better understand their needs, then generates **customized options** based on their answers.

## User Experience Flow

### Before (Generic Options)
```
⚡ [FFT] Complexity: COMPLEX
💡 Complex task detected - multiple options available

📊 Multiple Implementation Options
  [1] 保守方案 (MVP)
  [2] 激进方案 (完整重构)
  [3] 平衡方案 (渐进式)

? Select option: [3]
```

### After (Interactive Planning)
```
⚡ [FFT] Complexity: COMPLEX

📋 为了更好地为您定制方案，请回答几个问题
(也可以选择跳过，使用默认设置生成通用方案)

? 是否回答几个问题以定制方案？ (Y/n)

> Y

? 1. 您的技术经验水平？
  ❌ 🌱 初学者 - 刚接触这些技术
  ✅ 🌿 有一定经验 - 使用过相关技术
  ❌ 🌳 专家 - 深入理解且有项目经验

? 2. 项目规模？
  ✅ 👤 个人项目 - 自己使用或学习
  ❌ 👥 小团队 - 2-5人协作
  ❌ 🏢 企业级 - 多团队、大规模用户

? 3. 时间要求？
  ❌ 🔥 紧急 - 需要尽快完成
  ✅ ⏰ 正常 - 标准开发周期
  ❌ 📅 灵活 - 不着急，可以慢慢来

? 4. 最看重什么？
  ❌ ⚡ 开发速度 - 快速上线
  ✅ ⚖️ 平衡 - 速度和质量兼顾
  ❌ 💎 代码质量 - 可维护性和最佳实践

✅ 已记录您的偏好，正在生成定制方案...

⚡ [FFT] Generated 3 options (customized for your needs)

📊 Multiple Implementation Options
  [1] 保守方案 (MVP)
  [2] 激进方案 (完整重构)
  [3] 平衡方案 (渐进式) ← 推荐，基于您的偏好
```

## Questions Asked

### 1. 技术经验水平 (Experience)
- **初学者** (beginner): 刚接触这些技术
- **有一定经验** (intermediate): 使用过相关技术
- **专家** (expert): 深入理解且有项目经验

**Influence on Options**:
- Beginner → More detailed comments, simpler patterns
- Expert → Advanced patterns, best practices

### 2. 项目规模 (Project Scale)
- **个人项目** (personal): 自己使用或学习
- **小团队** (small-team): 2-5人协作
- **企业级** (enterprise): 多团队、大规模用户

**Influence on Options**:
- Personal → Simple setup, minimal tooling
- Small-team → Basic collaboration tools
- Enterprise → Full CI/CD, monitoring, scalability

### 3. 时间要求 (Time Constraint)
- **紧急** (urgent): 需要尽快完成
- **正常** (normal): 标准开发周期
- **灵活** (flexible): 不着急，可以慢慢来

**Influence on Options**:
- Urgent → Fastest path, skip optimizations
- Normal → Balanced approach
- Flexible → Can invest in better architecture

### 4. 最看重什么 (Priority)
- **开发速度** (speed): 快速上线
- **代码质量** (quality): 可维护性和最佳实践
- **平衡** (balance): 速度和质量兼顾

**Influence on Options**:
- Speed → Quick implementation, tech debt acceptable
- Quality → Refactoring, testing, documentation
- Balance → Sensible trade-offs

## How It Works

### Technical Implementation

**File**: `src/fft/planner.ts`

#### 1. Type Definition (src/fft/types.ts)
```typescript
export interface ClarifyingAnswers {
  experience: 'beginner' | 'intermediate' | 'expert';
  projectScale: 'personal' | 'small-team' | 'enterprise';
  timeConstraint: 'urgent' | 'normal' | 'flexible';
  priority: 'speed' | 'quality' | 'balance';
}
```

#### 2. Interactive Questions (askClarifyingQuestions)
```typescript
private async askClarifyingQuestions(
  requirement: string
): Promise<ClarifyingAnswers | undefined> {
  // Ask if user wants to answer questions
  const { shouldAsk } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldAsk',
    message: '是否回答几个问题以定制方案？',
    default: true,
  }]);

  if (!shouldAsk) {
    return undefined; // Use defaults
  }

  // Ask 4 questions using inquirer.js
  const answers = await inquirer.prompt([...]);
  return answers;
}
```

#### 3. Enhanced Prompt Generation
```typescript
private buildMultipleOptionsPrompt(
  requirement: string,
  projectInfo: Record<string, string>,
  userProfile?: string,
  answers?: ClarifyingAnswers  // ← NEW
): string {
  let prompt = `REQUIREMENT: ${requirement}...`;

  // Add user preferences to prompt
  if (answers) {
    prompt += `
USER PREFERENCES:
- Experience: ${answers.experience}
- Project Scale: ${answers.projectScale}
- Time Constraint: ${answers.timeConstraint}
- Priority: ${answers.priority}

IMPORTANT: Generate options that match these preferences!
- If user is beginner → prioritize simple solutions
- If user wants speed → prioritize quick implementation
- If user wants quality → prioritize best practices
`;
  }

  return prompt;
}
```

#### 4. Integration Point
```typescript
private async generateMultipleOptions(
  input: FFTPlanInput,
  complexityAnalysis: ComplexityAnalysis
): Promise<FFTPlanOption[]> {
  // Ask questions first
  const answers = await this.askClarifyingQuestions(requirement);

  // Generate with answers
  const prompt = this.buildMultipleOptionsPrompt(
    requirement,
    projectInfo,
    userProfile,
    answers  // ← Pass to AI
  );

  // ... generate options
}
```

## Example Customizations

### Scenario 1: Beginner + Personal Project + Speed
**User Answers**:
- Experience: beginner
- Project Scale: personal
- Time: urgent
- Priority: speed

**Generated Options**:
```
[1] 保守方案
    → Vue 3 Composition API (simplest)
    → Express.js (minimal setup)
    → File system storage (no database)
    → No testing framework (skip for speed)

[2] 激进方案
    → Nuxt.js (opinionated, less choices)
    → Built-in file handling
    → Auto-deployment to Vercel

[3] 平衡方案
    → Vue 3 with Vite (fast dev)
    → Spring Boot (easier config)
    → In-memory H2 database (no setup)
```

### Scenario 2: Expert + Enterprise + Quality
**User Answers**:
- Experience: expert
- Project Scale: enterprise
- Time: flexible
- Priority: quality

**Generated Options**:
```
[1] 保守方案
    → Vue 3 + TypeScript + Pinia
    → Spring Boot + Spring Security
    → PostgreSQL + Redis caching
    → Jest + Supertest testing
    → Docker + K8s deployment

[2] 激进方案
    → Microservices architecture
    → Event-driven (Kafka)
    → Distributed tracing (Jaeger)
    → CI/CD pipeline (GitLab CI)
    → Multi-region deployment

[3] 平衡方案
    → Modular monolith
    → Spring Cloud Gateway
    → Redis + PostgreSQL
    ├── JUnit integration tests
    ├── Docker Compose for local dev
```

## Benefits

### 1. **Better Alignment**
Options match user's actual needs and constraints

### 2. **Reduced Cognitive Load**
Don't need to mentally adapt generic options

### 3. **Faster Decision Making**
Relevant pros/cons based on your situation

### 4. **More Realistic Estimates**
Time estimates consider your experience level

### 5. **Optional Feature**
Can skip questions and use defaults if preferred

## Design Decisions

### Why 4 Questions?
- **Fewer** (1-2): Not enough information
- **More** (5+): User fatigue, diminishing returns
- **4 questions**: Sweet spot (10-15 seconds)

### Why These 4 Dimensions?
1. **Experience**: Determines complexity level
2. **Scale**: Determines architecture choices
3. **Time**: Determines trade-off tolerance
4. **Priority**: Final decision maker

These cover the main factors that influence implementation approach.

### Why Inquirer.js?
- Interactive CLI prompts (native feel)
- Support for different question types (list, confirm, input)
- Easy to integrate with existing REPL
- Well-maintained library

### Why "Skip" Option?
- Not everyone wants to answer questions
- Power users might prefer standard options
- Reduces friction for quick tasks

## Future Improvements

### 1. Adaptive Questions
- Ask fewer questions for simpler tasks
- Ask more questions for very complex tasks

### 2. Question History
- Remember previous answers in session
- "Same as last time" quick option

### 3. Custom Questions
- Allow users to define their own questions
- Project-specific question templates

### 4. Smart Defaults
- Detect experience from git history
- Detect scale from package.json dependencies
- Auto-fill when possible

### 5. Multi-language Support
- Currently Chinese only
- Add English questions for English users

## Usage

```bash
# Interactive mode
npx newma-cli -i

# Complex task triggers questions
> /plan 写一个网站，实现 html 上传下载功能。前端 vue，后端 java

# Or skip questions
? 是否回答几个问题以定制方案？ (Y/n) n
# → Generates generic options
```

## Related Files

- `src/fft/planner.ts` - Main implementation
- `src/fft/types.ts` - Type definitions
- `src/repl.ts` - REPL integration
- `FEATURE_INTERACTIVE_PLANNING.md` - This document

## Testing

Manual testing checklist:
- [x] Questions appear for complex tasks
- [x] Skip option works
- [x] Answers are passed to AI correctly
- [x] Generated options reflect preferences
- [x] Build succeeds
- [ ] Unit tests for prompt generation
- [ ] Integration tests with mock AI

---

**Author**: Claude Code
**Last Updated**: 2026-01-24
**Status**: Implemented ✅
**Version**: 3.2.2
