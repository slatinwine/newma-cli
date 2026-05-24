# 快速入门：系统提示词

## 5 分钟上手

### 1. 基础使用（无需代码更改）

现有的 Newma (牛码) CLI 会自动使用新的系统提示词：

```bash
# 默认使用改进的系统提示词
npx newma-cli "add a login page"

# 在 REPL 模式下
npx newma-cli -i
```

### 2. 选择专门的提示词类型

如果你在代码中使用 Newma (牛码)，可以选择不同的提示词：

```typescript
import { loadSystemPrompt, PromptType } from '@kode/cli';

// 默认提示词（推荐）
const prompt = loadSystemPrompt(PromptType.DEFAULT);

// 简洁模式（大型代码库）
const prompt = loadSystemPrompt(PromptType.COMPACT);

// 前端任务
const prompt = loadSystemPrompt(PromptType.FRONTEND_AGENT);

// 后端任务
const prompt = loadSystemPrompt(PromptType.BACKEND_AGENT);

// 验证完成
const prompt = loadSystemPrompt(PromptType.VERIFICATION);
```

### 3. 示例场景

#### 场景 A: 创建 React 组件
```bash
npx newma-cli "create a user profile card component with avatar, name, and email"
```

Newma (牛码) 会自动使用 Frontend Agent 专门化提示词。

#### 场景 B: 创建 API 端点
```bash
npx newma-cli "add a user registration endpoint with email validation"
```

Newma (牛码) 会自动使用 Backend Agent 专门化提示词。

#### 场景 C: 验证任务完成
```typescript
// 执行操作后
const verifyPrompt = loadSystemPrompt(PromptType.VERIFICATION);
const result = await callAI(config, projectInfo, requirement, verifyPrompt, history);

if (result.done) {
  console.log('✅ 完成！');
}
```

## 提示词文件位置

```
kode/
├── SYSTEM_PROMPT.md              # 主系统提示词
└── prompts/
    ├── agent-frontend.md         # Frontend Agent
    ├── agent-backend.md          # Backend Agent
    ├── mode-verification.md      # 验证模式
    └── mode-compact.md           # 紧凑模式
```

## 自定义提示词

### 修改默认提示词

编辑 `SYSTEM_PROMPT.md` 来自定义 AI 的行为：

```markdown
## 自定义规则
- 始终使用 TypeScript
- 遵循项目命名约定
- 添加 JSDoc 注释
```

### 添加新的提示词类型

1. 创建新文件 `prompts/agent-testing.md`
2. 在 `src/prompt.ts` 中添加：
```typescript
export enum PromptType {
  // ... 现有的
  TESTING_AGENT = 'testing-agent',
}

const promptFiles: Record<PromptType, string> = {
  // ... 现有的
  [PromptType.TESTING_AGENT]: 'prompts/agent-testing.md',
};
```

## 最佳实践

### DO ✅
- 使用默认提示词作为起点
- 为专门任务使用专门的 Agent
- 在验证阶段使用 Verification 模式
- Token 受限时使用 Compact 模式
- 根据项目需求自定义提示词

### DON'T ❌
- 不要同时使用多个专门提示词
- 不要在不匹配的场景使用专门提示词
- 不要忽略向后兼容性
- 不要删除 `SYSTEM_PROMPT.md`

## 常见问题

### Q: 我需要修改现有代码吗？
A: 不需要！新的提示词系统向后兼容。现有代码继续工作。

### Q: 如何选择正确的提示词？
A:
- **默认**: 90% 的情况
- **Frontend**: UI/组件/样式
- **Backend**: API/数据库/服务器
- **Verification**: QA 阶段
- **Compact**: Token 受限

### Q: 提示词文件可以删除吗？
A: 可以删除，系统会自动回退到旧版提示词。但建议保留以获得更好的体验。

### Q: 如何回退到旧版提示词？
A:
```typescript
// 使用旧版函数
const prompt = buildSystemPrompt(tools, permissions);
```

## 进阶使用

### CLI 选项（未来版本）
```bash
# 指定提示词类型
npx newma-cli --prompt-type frontend "create a navbar component"

# 紧凑模式
npx newma-cli --prompt-type compact "fix the typo in README.md"

# REPL 模式下切换
npx newma-cli -i
> /prompt frontend  # 切换到前端提示词
> /prompt backend   # 切换到后端提示词
> /prompt default   # 切换回默认
```

### 多 Agent 系统
```typescript
// Frontend Agent
const frontendAgent = new FrontendAgent();
frontendAgent.setSystemPrompt(loadSystemPrompt(PromptType.FRONTEND_AGENT));

// Backend Agent
const backendAgent = new BackendAgent();
backendAgent.setSystemPrompt(loadSystemPrompt(PromptType.BACKEND_AGENT));

// 自动选择
const agent = coordinator.selectBestAgent(requirement);
await agent.execute(requirement);
```

## 获取帮助

- 完整文档: `PROMPTS.md`
- 系统提示词: `SYSTEM_PROMPT.md`
- 总结: `SYSTEM_PROMPT_SUMMARY.md`
- GitHub Issues: https://github.com/your-repo/kode/issues

---

**记住**: 新的提示词系统完全向后兼容。你可以继续使用旧的方式，或者逐步采用新的功能。

**开始使用**: 无需任何更改，直接运行 `npx newma-cli` 即可享受改进的系统提示词！
