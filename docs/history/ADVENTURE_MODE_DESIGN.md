# Adventure Mode - Interactive Planning System

**Date**: 2025-01-18
**Feature**: Text Adventure Style Branching Interface

## 概述

将 Newma (牛码) 的规划过程改造为文字冒险游戏风格，AI 生成多个分支选项，用户选择后再执行。

## 设计方案

### 1. 响应格式扩展

**当前格式**:
```json
{
  "todo": ["Task 1", "Task 2"],
  "actions": [...]
}
```

**新格式 (Adventure Mode)**:
```json
{
  "type": "choice",
  "scenario": "你需要添加用户认证功能。有几种实现方式可选：",
  "choices": [
    {
      "id": "A",
      "title": "使用 JWT (推荐)",
      "description": "轻量级、无状态、适合微服务架构",
      "pros": ["性能好", "易于扩展", "标准化"],
      "cons": ["需要处理 token 过期"],
      "todo": ["安装 JWT 库", "实现登录接口", "添加中间件"],
      "actions": [...]
    },
    {
      "id": "B",
      "title": "使用 Session",
      "description": "传统方式，服务端存储状态",
      "pros": ["简单直观", "易于撤销"],
      "cons": ["服务器负担大", "扩展性差"],
      "todo": ["配置 session 存储", "实现登录接口", "添加 session 检查"],
      "actions": [...]
    },
    {
      "id": "C",
      "title": "使用 OAuth 2.0",
      "description": "第三方登录（Google, GitHub 等）",
      "pros": ["用户体验好", "安全"],
      "cons": ["依赖外部服务", "实现复杂"],
      "todo": ["注册 OAuth 应用", "实现回调接口", "绑定用户账号"],
      "actions": [...]
    }
  ]
}
```

### 2. 用户界面

```
═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═
   你需要添加用户认证功能
   有几种实现方式可选：
═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═

  [A] 使用 JWT (推荐)
      轻量级、无状态、适合微服务架构
      ✓ 性能好  ✓ 易于扩展  ✓ 标准化
      ✗ 需要处理 token 过期

  [B] 使用 Session
      传统方式，服务端存储状态
      ✓ 简单直观  ✓ 易于撤销
      ✗ 服务器负担大  ✗ 扩展性差

  [C] 使用 OAuth 2.0
      第三方登录（Google, GitHub 等）
      ✓ 用户体验好  ✓ 安全
      ✗ 依赖外部服务  ✗ 实现复杂

  [?] 显示每个选项的详细步骤

你的选择 [A/B/C/?]:
```

### 3. 实现计划

#### Phase 1: 扩展类型定义

**src/types.ts**:
```typescript
export interface Choice {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  todo: string[];
  actions: Action[];
}

export interface AdventureResponse {
  type: 'choice';
  scenario: string;
  choices: Choice[];
}

export type AIResponseWithAdventure = AIResponse | AdventureResponse;
```

#### Phase 2: 修改提示词

**src/ai.ts modePrompt** (plan mode):
```typescript
const modePrompt = mode === 'plan'
  ? `You are KODE, an AI development assistant.

**Task Complexity Assessment:**

**SIMPLE TASKS** (direct execution):
- Single command, <3 steps
→ Return standard AIResponse: {todo: [], actions: [...]}

**COMPLEX TASKS with multiple approaches** (adventure mode):
- Has 2+ valid implementation strategies
- User needs to make design decisions
→ Return AdventureResponse with choices

**When to generate choices:**
- User: "Add authentication" → Choices: [JWT, Session, OAuth]
- User: "Setup database" → Choices: [PostgreSQL, MongoDB, SQLite]
- User: "Build UI" → Choices: [React, Vue, Svelte]

**Adventure Response Format:**
\`\`\`json
{
  "type": "choice",
  "scenario": "Brief description of the situation",
  "choices": [
    {
      "id": "A",
      "title": "Short name",
      "description": "1-2 sentence explanation",
      "pros": ["pro1", "pro2"],
      "cons": ["con1", "con2"],
      "todo": ["step1", "step2"],
      "actions": [...]
    }
  ]
}
\`\`\`
`;
```

#### Phase 3: 实现选择处理

**src/adventure.ts** (新文件):
```typescript
import inquirer from 'inquirer';
import chalk from 'chalk';
import { AdventureResponse, Choice, Action } from './types';

export class AdventureManager {
  /**
   * Display choices and get user selection
   */
  async presentChoices(response: AdventureResponse): Promise<Choice> {
    console.log(chalk.cyan('\n' + '═'.repeat(50)));
    console.log(chalk.cyan('   ' + response.scenario));
    console.log(chalk.cyan('═'.repeat(50) + '\n'));

    const choices = response.choices.map(c => ({
      name: `${c.id} - ${c.title}`,
      value: c.id,
      short: c.id,
    }));

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: '你的选择:',
        choices: [...choices, new inquirer.Separator(), { name: '? 显示详情', value: '?details' }],
      }
    ]);

    if (selected === '?details') {
      return this.presentWithDetails(response);
    }

    return response.choices.find(c => c.id === selected)!;
  }

  /**
   * Show detailed information about each choice
   */
  async presentWithDetails(response: AdventureResponse): Promise<Choice> {
    console.log(chalk.gray('\n——— 详细信息 ———\n'));

    response.choices.forEach(choice => {
      console.log(chalk.bold(`[${choice.id}] ${choice.title}`));
      console.log(chalk.gray(choice.description));
      console.log(chalk.green('优点: ' + choice.pros.join(', ')));
      console.log(chalk.red('缺点: ' + choice.cons.join(', ')));
      console.log(chalk.yellow('步骤: ' + choice.todo.join(' → ')));
      console.log('');
    });

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: '你的选择:',
        choices: response.choices.map(c => ({ name: c.id, value: c.id })),
      }
    ]);

    return response.choices.find(c => c.id === selected)!;
  }

  /**
   * Extract actions from selected choice
   */
  executeChoice(choice: Choice): { todo: string[]; actions: Action[] } {
    return {
      todo: choice.todo,
      actions: choice.actions,
    };
  }
}
```

#### Phase 4: 集成到 REPL

**src/repl.ts**:
```typescript
import { AdventureManager } from './adventure';

// In executeRequirement method:
const adventureManager = new AdventureManager();

if (aiResponse.type === 'choice') {
  // Adventure mode: present choices
  const selectedChoice = await adventureManager.presentChoices(aiResponse);

  console.log(chalk.green('\n✓ 已选择: ' + selectedChoice.title));
  console.log(chalk.gray('执行步骤:'));
  selectedChoice.todo.forEach((step, i) => {
    console.log(chalk.gray(`  ${i + 1}. ${step}`));
  });
  console.log('');

  // Execute the selected choice
  const { todo, actions } = adventureManager.executeChoice(selectedChoice);
  await this.executeActions(todo, actions);
} else {
  // Normal mode: execute directly
  await this.executeActions(aiResponse.todo, aiResponse.actions);
}
```

### 4. 提示词示例

**src/ai.ts userPrompt**:
```typescript
let userPrompt = `
**EXAMPLES:**

Example 1 - Simple task (no choices needed):
User: "Run tests"
AI: {"todo": [], "actions": [{"type": "run", "command": "npm test"}]}

Example 2 - Complex task with choices:
User: "Add user authentication"
AI:
{
  "type": "choice",
  "scenario": "需要为应用添加用户认证功能",
  "choices": [
    {
      "id": "A",
      "title": "JWT 认证",
      "description": "使用 JSON Web Token 进行无状态认证",
      "pros": ["性能好", "易于扩展", "支持移动端"],
      "cons": ["需要处理 token 刷新"],
      "todo": ["安装 jsonwebtoken", "实现登录/注册", "添加 token 验证中间件"],
      "actions": [
        {"type": "run", "command": "npm install jsonwebtoken"},
        {"type": "create", "path": "src/auth.ts", "content": "..."}
      ]
    },
    {
      "id": "B",
      "title": "Session 认证",
      "description": "使用服务端 session 存储",
      "pros": ["实现简单", "易于管理"],
      "cons": ["服务器负担", "扩展性差"],
      "todo": ["配置 express-session", "实现登录/注册", "添加 session 检查"],
      "actions": [...]
    }
  ]
}

Example 3 - Complex task without clear alternatives:
User: "Summarize this project"
AI:
{
  "todo": ["Read README", "Analyze structure", "Generate summary"],
  "actions": [...]
}
`;
```

### 5. CLI 选项

```bash
# 禁用 adventure mode（传统模式）
npx newma-cli --no-adventure "Add authentication"

# 启用 adventure mode（默认）
npx newma-cli --adventure "Add authentication"

# 在 REPL 中切换
> /set adventure false  # 禁用
> /set adventure true   # 启用
```

## 优势

1. **更好的用户体验** - 用户了解为什么选择某个方案
2. **教育性** - 展示不同技术方案的权衡
3. **控制感** - 用户决定技术栈和实现方式
4. **透明度** - 明确显示每个选项的优缺点

## 实现优先级

### MVP (Minimum Viable Product)
1. ✅ 扩展类型定义
2. ✅ 修改提示词
3. ✅ 实现基本选择界面
4. ✅ 集成到 REPL

### 增强功能
- 📋 保存选择历史（可以回退到之前的选择）
- 🔄 提供"重新选择"选项（如果用户不满意之前的选择）
- 📊 显示推荐理由（为什么推荐某个选项）
- 🎓 学习模式（解释每个选项的适用场景）

## 测试计划

```typescript
// test-adventure-mode.ts

test('Simple task should not generate choices', async () => {
  const response = await callAI(config, projectInfo, "Run tests", 'plan');
  expect(response.type).not.toBe('choice');
});

test('Authentication task should generate choices', async () => {
  const response = await callAI(config, projectInfo, "Add authentication", 'plan');
  expect(response.type).toBe('choice');
  expect(response.choices.length).toBeGreaterThanOrEqual(2);
});

test('Each choice should have pros, cons, todo, actions', async () => {
  const response = await callAI(config, projectInfo, "Setup database", 'plan');
  response.choices.forEach(choice => {
    expect(choice.pros).toBeDefined();
    expect(choice.cons).toBeDefined();
    expect(choice.todo).toBeDefined();
    expect(choice.actions).toBeDefined();
  });
});
```

## 下一步

1. 创建 `src/adventure.ts` 文件
2. 扩展 `src/types.ts` 添加 AdventureResponse
3. 修改 `src/ai.ts` 的 plan mode 提示词
4. 集成到 `src/repl.ts`
5. 编写测试用例
6. 更新文档

**预计工作量**: 2-3 小时
**难度**: 中等
**优先级**: 高（用户体验增强）
