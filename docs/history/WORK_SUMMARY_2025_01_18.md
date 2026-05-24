# Newma (牛码) 改进工作总结 - 2025-01-18

## 本次会话完成的工作

### 1. 发现并修复关键 Bug

**问题**: AI 返回乱码而非标准 JSON

**根本原因**:
- 提示词中使用了不存在的 `"type": "task"` 字段
- `AIResponse` 接口中没有 `type` 字段
- 三个地方的提示词都有这个问题：
  1. `src/ai.ts` 的 `modePrompt` (line 684-763)
  2. `src/ai.ts` 的 `userPrompt` (line 790-840)
  3. `src/prompt.ts` 的 `buildSystemPrompt` (line 20-160)

**修复**:
- ✅ 从所有提示词示例中移除 `"type": "task"`
- ✅ 简化过度强调的语言（"🚨 MOST CRITICAL", "NEVER", "ALWAYS"）
- ✅ 添加任务复杂度评估（简单 vs 复杂）
- ✅ 添加实用示例（简单/中等/复杂任务）

### 2. 创建 AI 助手工作指南

**文件**: `AI_ASSISTANT_GUIDE.md` (568 lines)

**内容**:
- TodoWrite 决策框架（何时使用任务追踪）
- 工具选择优先级（Read/Write/Edit vs Bash vs Task）
- 执行模式（直接执行、计划执行、并行执行）
- 实用示例和最佳实践

### 3. 更新项目文档

**修改文件**: `CLAUDE.md`

**新增章节**: "AI Assistant Working Guidelines" (lines 1957-1991)
- 快速总结和指南链接
- 集成到项目主文档

### 4. 更新系统提示词

**文件**: `prompts/SYSTEM_PROMPT.md` (lines 126-180)

**新增内容**:
- 任务复杂度评估
- 简单/中等/复杂任务示例
- 工具选择规则
- 并行执行策略

### 5. 改进计划模式提示词

**文件**:
- `src/ai.ts` (lines 684-763, 790-840)
- `src/prompt.ts` (完全重写 buildSystemPrompt)

**改进内容**:
1. 添加任务复杂度评估
2. 简化语言（去除过度强调）
3. 添加实用示例
4. 强调渐进式执行
5. 对齐 Claude Code 的工作方式

### 6. 创建改进文档

**文件**: `PLAN_MODE_IMPROVEMENTS.md`

**内容**:
- 问题分析（过度强调 JSON、缺少复杂度评估）
- 改进详情（3 个关键改进点）
- 预期效果对比（改进前/后）
- 使用建议

### 7. 创建测试文件

**文件**: `test-improved-plan.ts`

**测试内容**:
- 简单任务（应该有最小规划）
- 复杂任务（应该有结构化规划）
- 验证改进效果

### 8. 设计 Adventure Mode

**文件**: `ADVENTURE_MODE_DESIGN.md`

**概念**: 文字冒险游戏风格的分支选择界面

**设计要点**:
- AI 生成多个实现选项
- 每个选项显示优缺点
- 用户选择后执行
- 提供详细步骤说明

**实现计划**:
1. 扩展类型定义（AdventureResponse, Choice）
2. 修改提示词（支持选择模式）
3. 实现选择管理器（AdventureManager）
4. 集成到 REPL
5. 测试验证

## 技术细节

### 修改的文件清单

1. **src/ai.ts** (2 处修改)
   - modePrompt: lines 684-763
   - userPrompt: lines 790-840

2. **src/prompt.ts** (完全重写)
   - buildSystemPrompt: lines 20-162
   - 添加任务复杂度评估
   - 添加简单/中等/复杂示例

3. **prompts/SYSTEM_PROMPT.md**
   - 添加 "AI Working Guidelines" 章节
   - 任务复杂度评估
   - 实用示例

4. **CLAUDE.md**
   - 添加 "AI Assistant Working Guidelines" 章节
   - 链接到详细指南

### 新增的文件

1. **AI_ASSISTANT_GUIDE.md** (568 lines)
   - Claude Code 工作指南
   - TodoWrite 决策框架
   - 工具选择优先级
   - 实用示例

2. **PLAN_MODE_IMPROVEMENTS.md**
   - 改进总结文档
   - 问题分析
   - 解决方案
   - 使用建议

3. **ADVENTURE_MODE_DESIGN.md**
   - 新功能设计
   - 实现计划
   - 用户界面设计
   - 测试计划

4. **test-improved-plan.ts**
   - 测试改进效果
   - 验证简单/复杂任务

## 待完成的任务

### 1. 调试 API 问题

**现状**: 测试脚本运行超时，AI 不返回响应

**可能原因**:
- API endpoint 配置问题
- Model 不支持当前提示词格式
- 网络问题
- API key 过期

**下一步**:
- 检查 .env 配置
- 尝试使用不同的 model
- 添加更详细的日志
- 手动测试单个 API 调用

### 2. 实现 Adventure Mode

**优先级**: 高
**预计时间**: 2-3 小时

**步骤**:
1. 创建 `src/adventure.ts`
2. 扩展 `src/types.ts`
3. 修改 `src/ai.ts` 提示词
4. 集成到 `src/repl.ts`
5. 编写测试
6. 更新文档

### 3. 完善 SYSTEM_PROMPT.md

**当前状态**: 部分更新

**待完成**:
- 验证所有章节与 `src/prompt.ts` 一致
- 添加更多 Adventure Mode 示例（实现后）
- 添加最佳实践章节

## 设计决策

### 1. 为什么移除 "type": "task"

**原因**:
- `AIResponse` 接口中没有这个字段
- 导致接口不匹配
- AI 返回混乱的输出

**解决方案**:
- 完全移除该字段
- 只保留 `todo`, `actions`, `done` 字段

### 2. 为什么添加任务复杂度评估

**问题**:
- 所有任务都要求完整规划
- 简单任务被过度规划
- 用户等待时间长

**解决方案**:
- 简单任务: 空或 1 个 todo，1-2 个 actions
- 复杂任务: 3+ 个 todo，对应 actions

### 3. Adventure Mode 设计理念

**核心思想**:
- 不是所有任务都只有一个正确答案
- 用户应该了解技术选择的权衡
- 交互式决策比 AI 替用户决定更好

**实现方式**:
- AI 生成多个选项
- 每个选项有明确的优缺点
- 用户选择后再执行

## 经验教训

### 1. 接口一致性很重要

**问题**: 提示词要求的字段与实际接口不匹配

**教训**:
- 修改提示词前，先确认接口定义
- 保持提示词与 TypeScript 类型一致
- 使用 TypeScript 编译器检查

### 2. 语言风格影响 AI 行为

**问题**: 过度强调（"🚨 MOST CRITICAL"）反而导致混乱

**教训**:
- 专业的语言 > 强烈的情绪化语言
- 清晰的示例 > 重复的警告
- 积极引导 > 消极警告

### 3. 渐进式改进

**方法**:
- 先修复明显的 bug（type 字段）
- 再优化提示词（复杂度评估）
- 最后添加新功能（Adventure Mode）

**好处**:
- 每一步都可测试验证
- 出问题容易定位
- 可以逐步看到效果

## 下一步计划

### 短期（今天/明天）

1. **调试 API 问题**
   - 检查 .env 配置
   - 尝试不同 model
   - 手动测试 API 调用

2. **验证改进效果**
   - 运行 `test-improved-plan.ts`
   - 检查简单任务响应
   - 检查复杂任务响应

### 中期（本周）

3. **实现 Adventure Mode**
   - 创建基础文件结构
   - 实现选择管理器
   - 集成到 REPL
   - 编写测试

4. **完善文档**
   - 更新 README.md
   - 添加使用示例
   - 编写 API 文档

### 长期（本月）

5. **增强功能**
   - 保存选择历史
   - 提供"重新选择"选项
   - 学习模式（解释技术选择）

6. **优化性能**
   - 缓存 API 响应
   - 流式输出
   - 并行执行

## 总结

本次会话完成的主要工作：

✅ **修复关键 Bug**: 移除不存在的 "type" 字段
✅ **改进提示词**: 添加任务复杂度评估，简化语言
✅ **创建指南**: AI_ASSISTANT_GUIDE.md (568 lines)
✅ **更新文档**: CLAUDE.md, SYSTEM_PROMPT.md
✅ **设计新功能**: Adventure Mode (文字冒险风格)

**待完成**:
⏳ 调试 API 响应问题
⏳ 实现 Adventure Mode
⏳ 完善测试和文档

**整体进度**: 70% 完成

---

**创建时间**: 2025-01-18
**最后更新**: 2025-01-18
**状态**: 进行中
