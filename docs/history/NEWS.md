# 更新日志 v3.0.0

## 🎉 新功能：企业级系统提示词架构

基于对业界领先 AI 系统（OpenAI GPT-5、Anthropic Claude Code、Google Gemini 等）的深入分析，Newma (牛码) 现在配备了一套全新的系统提示词架构。

### ✨ 主要特性

#### 1. 模块化提示词系统
- **主系统提示词** (`SYSTEM_PROMPT.md`): 全面的默认提示词
- **Frontend Agent**: 专门用于前端开发
- **Backend Agent**: 专门用于后端开发
- **Verification Mode**: 专门用于验证任务完成
- **Compact Mode**: 用于 Token 受限场景

#### 2. 完全向后兼容
- 现有代码无需任何修改
- 保留所有旧版 API
- 自动降级到旧版提示词（如果文件缺失）

#### 3. 增强的 API
```typescript
import { loadSystemPrompt, PromptType } from '@kode/cli';

// 使用新的提示词系统
const defaultPrompt = loadSystemPrompt(PromptType.DEFAULT);
const compactPrompt = loadSystemPrompt(PromptType.COMPACT);
const frontendPrompt = loadSystemPrompt(PromptType.FRONTEND_AGENT);
const backendPrompt = loadSystemPrompt(PromptType.BACKEND_AGENT);
const verificationPrompt = loadSystemPrompt(PromptType.VERIFICATION);

// 旧版 API 仍然有效
const legacyPrompt = buildSystemPrompt(tools, permissions);
```

#### 4. Token 优化
- Compact 模式只有默认提示词的 **18%** 大小
- 在大型代码库中显著节省 Token

### 📊 性能对比

| 提示词类型 | 字符数 | 相对大小 | 适用场景 |
|-----------|--------|----------|----------|
| Default | 11,669 | 100% | 大多数场景 |
| Compact | 2,139 | 18% | Token 受限 |
| Frontend Agent | 5,154 | 44% | 前端任务 |
| Backend Agent | 6,158 | 53% | 后端任务 |
| Verification | 7,286 | 62% | 验证阶段 |

### 🚀 使用示例

#### 前端任务
```bash
npx newma-cli "create a user profile card component"
# 自动使用 Frontend Agent 提示词
```

#### 后端任务
```bash
npx newma-cli "add a user registration API endpoint"
# 自动使用 Backend Agent 提示词
```

#### Token 受限场景
```typescript
const prompt = loadSystemPrompt(PromptType.COMPACT);
const response = await callAI(config, projectInfo, requirement, prompt);
```

### 📁 新增文件

1. **SYSTEM_PROMPT.md** - 主系统提示词（11,669 字符）
2. **prompts/agent-frontend.md** - Frontend Agent 提示词
3. **prompts/agent-backend.md** - Backend Agent 提示词
4. **prompts/mode-verification.md** - 验证模式提示词
5. **prompts/mode-compact.md** - 紧凑模式提示词
6. **PROMPTS.md** - 完整文档
7. **SYSTEM_PROMPT_SUMMARY.md** - 详细总结
8. **QUICKSTART_PROMPTS.md** - 快速入门指南
9. **examples/test-prompts.ts** - 测试示例

### 🔧 代码更新

#### src/prompt.ts
- 新增 `PromptType` 枚举
- 新增 `loadSystemPrompt()` 函数
- 新增 `SYSTEM_PROMPTS` 便捷导出
- 保留 `buildSystemPrompt()` 以保持向后兼容

### 🎯 从业界最佳实践中学到的

#### 从 OpenAI GPT-5 Agent
- ✅ 自主性原则
- ✅ 工具使用规范
- ✅ 并行执行优化

#### 从 Anthropic Claude Code
- ✅ 简洁性优先
- ✅ CLAUDE.md 集成
- ✅ Git 工作流

#### 从 OpenAI Codex CLI
- ✅ 前言消息策略
- ✅ 规划指南
- ✅ 沙盒权限

#### 从 Google Gemini
- ✅ 多模态能力
- ✅ 搜索集成
- ✅ 工具调用

### 🔒 安全增强

- 恶意代码检测和拒绝
- Prompt injection 防护
- PII 保护
- 输入验证要求
- 安全的 Git 操作

### 📚 文档

- **PROMPTS.md**: 完整的使用指南
- **SYSTEM_PROMPT_SUMMARY.md**: 详细的实现总结
- **QUICKSTART_PROMPTS.md**: 5 分钟快速入门
- **examples/test-prompts.ts**: 可运行的测试示例

### ✅ 测试

所有测试通过：
- ✅ 默认提示词加载
- ✅ 紧凑提示词加载
- ✅ Frontend Agent 提示词加载
- ✅ Backend Agent 提示词加载
- ✅ Verification 提示词加载
- ✅ 工具和权限注入
- ✅ 向后兼容性
- ✅ 边缘情况处理

### 🚀 未来路线图

#### 短期（1-2 个月）
- [ ] 添加 Testing Agent
- [ ] 添加 DevOps Agent
- [ ] CLI 选项 `--prompt-type`
- [ ] REPL 模式下的提示词切换

#### 中期（3-6 个月）
- [ ] 动态提示词组装
- [ ] 学习系统
- [ ] 社区贡献

#### 长期（6-12 个月）
- [ ] 提示词版本管理
- [ ] 多语言支持
- [ ] AI 驱动的提示词改进

### 🙏 致谢

本系统基于对以下开源项目泄露的系统提示词的分析：
- OpenAI GPT-5 Agent Mode
- Anthropic Claude Code
- Google Gemini CLI
- xAI Grok
- Perplexity AI
- Notion AI
- Raycast AI
- 其他 100+ 个系统提示词

### 📞 支持

- 完整文档: `PROMPTS.md`
- 快速入门: `QUICKSTART_PROMPTS.md`
- 测试示例: `examples/test-prompts.ts`
- GitHub Issues: https://github.com/your-repo/kode/issues

---

**版本**: 3.0.0
**发布日期**: 2025-01-17
**状态**: ✅ 生产就绪

**立即开始使用**:
```bash
npx newma-cli "your requirement here"
```

无需任何配置，自动享受改进的系统提示词！🚀
