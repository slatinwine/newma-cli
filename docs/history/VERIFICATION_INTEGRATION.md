# 验证系统集成文档

## 概述

Newma (牛码) CLI 整合了两个验证系统，形成智能的三阶段验证流程：

1. **Pre-execution Verification** (执行前) - 检查是否需要执行
2. **Stage 1: Quick Checks** (执行后) - 快速自动化检查
3. **Stage 2: AI-Powered Verification** (执行后) - ReAct 智能验证

## 验证流程

```
用户输入 requirement
    ↓
AI 生成 action plan
    ↓
┌─────────────────────────────────┐
│ Pre-execution ReAct Verification│
│ (检查是否已经满足)               │
└─────────────────────────────────┘
    ↓
[如果 satisfied] → 完成
[如果不满足] ↓
    ↓
执行 actions
    ↓
┌─────────────────────────────────┐
│ Stage 1: Quick Checks           │
│ - TypeScript compilation        │
│ - Linting (ESLint)              │
│ - Tests (if available)          │
│ - Build check                   │
└─────────────────────────────────┘
    ↓
[如果失败] → 显示错误
[如果通过] ↓
    ↓
┌─────────────────────────────────┐
│ Stage 2: ReAct Verification     │
│ - AI 智能分析执行结果            │
│ - Think-Act-Observe 循环        │
│ - 自动检测和修复问题             │
│ - 最多 5 次迭代                  │
└─────────────────────────────────┘
    ↓
完成
```

## 各阶段详解

### Stage 0: Pre-execution Verification (执行前)

**触发条件**: `--verify` + `--ultrathink` + 之前有执行历史

**目的**: 检查之前的执行是否已经满足 requirement，避免不必要的操作

**优点**:
- 避免重复工作
- 节省时间和 API 调用（~5-10 秒 vs 30-50 秒）
- 智能判断完成状态

### Stage 1: Quick Checks (快速自动化检查)

**触发条件**: Actions 执行完成后

**内容**:
1. **Syntax Check** (必需) - TypeScript 编译
2. **Linting** (可选) - ESLint 检查
3. **Test Suite** (可选) - 运行测试
4. **Build Check** (必需) - 构建项目

**优点**:
- 快速反馈（~3-10 秒）
- 捕捉明显的错误
- Stage 1 失败时跳过 Stage 2（节省 AI 调用）

### Stage 2: ReAct Verification (AI 智能验证)

**触发条件**: `--verify` + `--ultrathink` + Stage 1 通过 + 有执行历史

**ReAct 循环**:
```
Think (分析) → Act (修复) → Observe (验证)
     ↓              ↓              ↓
   不满足?     执行修复      检查结果
     ↓                            ↓
   是 ←────────────────────── 满足
     ↓
完成 (最多 5 次迭代)
```

**优点**:
- AI 深度理解代码意图
- 自动检测隐藏问题
- 智能生成修复方案
- 提供详细的分析和推理（~15-30 秒）

## 使用场景

| 场景 | 命令 | 验证级别 |
|------|------|----------|
| 基础使用 | `npx newma-cli "task"` | 无验证 |
| 快速验证 | `npx newma-cli --verify "task"` | Stage 1 only |
| 完整验证 | `npx newma-cli --verify --ultrathink "task"` | Stage 0 + 1 + 2 |
| 交互模式 | `npx newma-cli -i`<br>`> /set ultrathink true`<br>`> /set verify true` | 完整验证 |

## 性能考虑

### API 调用次数

| 场景 | Pre-execution | Stage 1 | Stage 2 | 总计 |
|------|--------------|----------|----------|------|
| 基础使用 | 0 | 0 | 0 | 0 |
| 快速验证 | 0 | 0 | 0 | 0 |
| 完整验证 (首次) | 0 | 0 | 5-10 | 5-10 |
| 完整验证 (再次) | 3 | 0 | 5-10 | 8-13 |

### 时间开销

- **Pre-execution**: ~5-10 秒（3 次迭代）
- **Stage 1**: ~3-10 秒（自动化检查）
- **Stage 2**: ~15-30 秒（5 次迭代）

**总计**: 约 23-50 秒（完整验证）

### 优化建议

1. **首次使用快速验证**（Stage 1 only）
2. **第二次使用完整验证**（Stage 0 + 1 + 2）
3. **开发阶段使用基础验证**，生产环境使用完整验证

## 向后兼容性

✅ **默认行为（无破坏性变更）**:
- 默认不运行任何验证
- `--verify` 只运行 Stage 1（快速检查）
- `--verify --ultrathink` 运行完整验证流程

✅ **所有选项都是 opt-in**:
```bash
# 基础模式（无验证）
npx newma-cli "task"

# 快速验证
npx newma-cli --verify "task"

# 完整验证
npx newma-cli --verify --ultrathink "task"
```

## 代码集成

**关键代码段** (src/repl.ts):

1. **Pre-execution verification** (行 361-396):
```typescript
if (mode === 'verify' && this.session.isUltrathinkEnabled()) {
  const previousHistory = this.session.getTracker().getHistory();

  if (previousHistory.length > 0) {
    const verifyResult = await verifyWithReAct(
      config, projectInfo, requirement,
      previousHistory, 3  // 快速检查（3 次迭代）
    );

    if (verifyResult.satisfied) {
      return;  // 已满足，不执行新的 actions
    }
  }
}
```

2. **Post-execution verification** (行 503-548):
```typescript
// Stage 1
const vr = await this.verifier.verify(projectRoot, 'fast');

if (vr.passed) {
  // Stage 2
  if (this.session.isUltrathinkEnabled() && mode === 'verify') {
    const history = this.session.getTracker().getHistory();
    const verifyResult = await verifyWithReAct(
      config, currentProjectInfo,
      requirement, history, 5  // 深度验证（5 次迭代）
    );
  }
}
```

## 总结

重构后的验证系统：

1. ✅ **更智能** - AI 驱动的三阶段验证
2. ✅ **更高效** - 避免不必要的操作
3. ✅ **更可靠** - 自动检测和修复问题
4. ✅ **向后兼容** - 零破坏性变更
5. ✅ **可配置** - 用户选择验证级别

---

**版本**: 3.1.0
**更新日期**: 2026-01-17
**相关文件**:
- `src/verifier.ts` (Stage 1)
- `src/ultrathink/verifier.ts` (Stage 2)
- `src/repl.ts` (集成点)
- `CLAUDE.md` (开发文档)
