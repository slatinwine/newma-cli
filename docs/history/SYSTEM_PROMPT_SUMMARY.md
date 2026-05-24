# 系统提示词优化总结

## 项目概述

基于对 `/Users/mac/Downloads/system_prompts_leaks-main` 目录中 105+ 个系统提示词的分析，我为 Newma (牛码) 项目设计并实现了一套企业级的系统提示词架构。

## 分析成果

### 研究的来源
- **OpenAI**: GPT-5, GPT-4.5, Codex CLI, Agent Mode
- **Anthropic**: Claude Code, Claude 4.5 Sonnet, Plan Mode
- **Google**: Gemini 2.5/3.0, CLI Tool
- **xAI**: Grok 3/4
- **其他**: Perplexity, Notion AI, Raycast AI

### 发现的关键模式

1. **清晰的身份定位**
   - 明确 AI 的角色和能力边界
   - 知识截止日期
   - 当前日期和环境上下文

2. **简洁性优先**
   - CLI 工具强调 1-3 句话的输出
   - 单词答案用于简单问题
   - 避免不必要的前言和后记

3. **分层安全策略**
   - 恶意代码检测和拒绝
   - 金融活动限制
   - 隐私信息保护
   - Prompt injection 防护

4. **工具使用规范**
   - 何时使用特定工具
   - 并行执行优化
   - 权限控制
   - 工具使用的前言消息

5. **规划-执行-验证闭环**
   - 明确的任务分解
   - 进度跟踪
   - 自动验证
   - 完成标准

6. **结构化输出**
   - Markdown 格式
   - 引用系统
   - 进度报告

## 创建的文件

### 1. 主系统提示词
**文件**: `SYSTEM_PROMPT.md`
**大小**: ~600 行
**内容**:
- 核心身份和使命
- 性格和沟通风格
- 安全和安全策略
- 执行模型（单 Agent、多 Agent、REPL）
- 输出格式规范
- 工具使用指南
- Git 集成
- 代码风格
- 环境感知
- 错误处理
- 性能优化

### 2. 专门化提示词

#### Frontend Agent (`prompts/agent-frontend.md`)
**专门用于**:
- UI 组件开发
- 样式系统（CSS、Tailwind）
- 前端框架（React、Vue、Angular）
- 状态管理
- 可访问性
- 性能优化

#### Backend Agent (`prompts/agent-backend.md`)
**专门用于**:
- API 开发（REST、GraphQL）
- 数据库操作
- 认证授权
- 服务器逻辑
- 安全最佳实践

#### Verification Mode (`prompts/mode-verification.md`)
**专门用于**:
- 验证任务完成
- 质量检查
- 代码审查
- 测试验证

#### Compact Mode (`prompts/mode-compact.md`)
**专门用于**:
- Token 受限场景
- 大型代码库
- 简单任务
- 快速响应

### 3. 代码更新

#### `src/prompt.ts`
**新增功能**:
```typescript
// 新增枚举类型
export enum PromptType {
  DEFAULT = 'default',
  COMPACT = 'compact',
  FRONTEND_AGENT = 'frontend-agent',
  BACKEND_AGENT = 'backend-agent',
  VERIFICATION = 'verification',
}

// 新增加载函数
export function loadSystemPrompt(
  type: PromptType = PromptType.DEFAULT,
  availableTools?: string[],
  grantedPermissions?: string[]
): string

// 新增便捷导出
export const SYSTEM_PROMPTS = {
  DEFAULT: () => loadSystemPrompt(PromptType.DEFAULT),
  COMPACT: () => loadSystemPrompt(PromptType.COMPACT),
  FRONTEND_AGENT: () => loadSystemPrompt(PromptType.FRONTEND_AGENT),
  BACKEND_AGENT: () => loadSystemPrompt(PromptType.BACKEND_AGENT),
  VERIFICATION: () => loadSystemPrompt(PromptType.VERIFICATION),
};
```

**向后兼容**:
- 保留了原有的 `buildSystemPrompt()` 函数
- 保留了 `SYSTEM_MESSAGE` 常量
- 所有现有代码无需修改

### 4. 文档

#### `PROMPTS.md`
**完整的用户指南**:
- 概述和架构
- 使用示例
- 最佳实践
- 集成指南
- 扩展指南
- 故障排除

## 关键特性

### 1. 模块化设计
每个提示词都是独立的文件，易于：
- 维护和更新
- 测试和调试
- 扩展和定制

### 2. 渐进增强
用户可以选择：
- **默认提示词**: 适用于大多数场景
- **专门化提示词**: 针对特定任务
- **紧凑模式**: Token 受限场景

### 3. 向后兼容
现有代码无需修改，继续使用旧版提示词：
```typescript
// 旧代码仍然有效
const prompt = buildSystemPrompt(tools, permissions);

// 新代码提供更多选项
const prompt = loadSystemPrompt(PromptType.DEFAULT, tools, permissions);
```

### 4. 自动降级
如果提示词文件不存在，自动回退到旧版提示词：
```typescript
// 如果文件不存在，自动使用 buildSystemPrompt()
const prompt = loadSystemPrompt(PromptType.DEFAULT);
```

### 5. 上下文感知
提示词自动包含：
- 可用工具列表
- 授予的权限
- 环境详情

## 使用示例

### 基础使用
```typescript
import { loadSystemPrompt, PromptType } from './src/prompt';

// 使用默认提示词
const prompt = loadSystemPrompt(PromptType.DEFAULT);

// 前端任务
const frontendPrompt = loadSystemPrompt(PromptType.FRONTEND_AGENT);

// 后端任务
const backendPrompt = loadSystemPrompt(PromptType.BACKEND_AGENT);

// 验证阶段
const verificationPrompt = loadSystemPrompt(PromptType.VERIFICATION);

// Token 受限场景
const compactPrompt = loadSystemPrompt(PromptType.COMPACT);
```

### 与 AI 集成
```typescript
// 规划阶段
const planPrompt = loadSystemPrompt(PromptType.DEFAULT, tools, permissions);
const plan = await callAI(config, projectInfo, requirement, planPrompt);

// 执行阶段
await executeActions(plan.actions);

// 验证阶段
const verifyPrompt = loadSystemPrompt(PromptType.VERIFICATION);
const result = await callAI(config, projectInfo, requirement, verifyPrompt, history);

if (result.done) {
  console.log('✅ 任务完成');
} else {
  console.log('❌ 需要更多工作');
}
```

### 多 Agent 系统
```typescript
// 前端 Agent
const frontendAgent = new FrontendAgent(toolExecutor, tracker);
frontendAgent.setSystemPrompt(loadSystemPrompt(PromptType.FRONTEND_AGENT));

// 后端 Agent
const backendAgent = new BackendAgent(toolExecutor, tracker);
backendAgent.setSystemPrompt(loadSystemPrompt(PromptType.BACKEND_AGENT));

// 协调器选择合适的 Agent
const agent = coordinator.selectAgent(requirement);
await agent.execute(requirement);
```

## 优势总结

### 与旧版提示词相比

#### 旧版提示词 (`buildSystemPrompt()`)
- ❌ 固定内容，无法定制
- ❌ 无法针对不同场景优化
- ❌ 难以维护和更新
- ❌ 没有专门的 Agent 提示词

#### 新版提示词系统 (`loadSystemPrompt()`)
- ✅ 模块化文件，易于维护
- ✅ 多种提示词类型，适应不同场景
- ✅ 专门的 Agent 提示词
- ✅ 紧凑模式节省 Token
- ✅ 向后兼容，无需修改现有代码
- ✅ 自动降级，确保稳定性

### 与业界领先的系统相比

我们借鉴了：
- **GPT-5 Agent**: 自主性、工具使用、并行执行
- **Claude Code**: 简洁性、CLAUDE.md 集成
- **Codex CLI**: 前言消息、规划指南
- **Gemini**: 多模态能力、搜索集成

我们创新了：
- **Phase-based 架构**: 4 个开发阶段的渐进增强
- **Rollback 系统**: Git 检查点和自动恢复
- **模块化文件**: 易于定制和扩展
- **Agent 专业化**: 前端/后端专门的 Agent

## 未来改进

### 短期（1-2 个月）
1. 添加更多 Agent 提示词
   - Testing Agent
   - DevOps Agent
   - Documentation Agent

2. 优化现有提示词
   - 根据实际使用反馈
   - A/B 测试不同版本
   - 性能指标追踪

3. CLI 集成
   - 添加 `--prompt-type` 选项
   - REPL 模式下的提示词切换
   - 用户自定义提示词支持

### 中期（3-6 个月）
1. 动态提示词组装
   - 根据任务自动选择提示词
   - 组合多个提示词模块
   - 上下文感知的提示词调整

2. 学习系统
   - 从执行历史学习
   - 优化提示词效果
   - 个性化提示词

3. 社区贡献
   - 用户提交的提示词
   - 提示词市场
   - 最佳实践分享

### 长期（6-12 个月）
1. 提示词版本管理
   - 版本控制和追踪
   - A/B 测试框架
   - 回滚能力

2. 多语言支持
   - 国际化提示词
   - 文化适应性
   - 本地化最佳实践

3. 高级特性
   - 提示词编译和优化
   - 动态提示词生成
   - AI 驱动的提示词改进

## 总结

成功创建了一套基于业界最佳实践的系统提示词架构，包括：

### 创建的文件
1. ✅ `SYSTEM_PROMPT.md` - 主系统提示词
2. ✅ `prompts/agent-frontend.md` - Frontend Agent
3. ✅ `prompts/agent-backend.md` - Backend Agent
4. ✅ `prompts/mode-verification.md` - Verification Mode
5. ✅ `prompts/mode-compact.md` - Compact Mode
6. ✅ `PROMPTS.md` - 完整文档
7. ✅ 更新 `src/prompt.ts` - 代码集成

### 关键成果
- 📊 分析了 105+ 个系统提示词
- 🎯 提取了 6 大核心模式
- 🔧 创建了 5 个专门化提示词
- 🚀 实现了模块化架构
- ✅ 保持了向后兼容性
- 📖 提供了完整文档

### 价值
- **更好的用户体验**: 更准确、更专业的响应
- **更高的效率**: Token 节省、更快响应
- **更强的专业性**: 专门化的 Agent
- **更好的可维护性**: 模块化、可扩展
- **更安全**: 安全策略和验证

---

**版本**: 3.0.0
**日期**: 2025-01-17
**基于**: OpenAI GPT-5, Anthropic Claude Code, Google Gemini 等业界领先系统的最佳实践
