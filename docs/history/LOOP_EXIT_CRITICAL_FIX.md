# ⚠️ Loop 模式自动退出的关键问题发现

**日期**: 2026-01-19
**严重性**: 🔴 严重
**状态**: 🔍 问题已定位,需要手动修复

---

## 🚨 关键发现

### 核心问题

**Simple Check 验证被错误地放在 actions 执行块内部!**

**位置**: `src/repl.ts:1889-1967`

**问题代码结构**:
```typescript
if (aiResp.actions && aiResp.actions.length > 0) {
  // Execute actions...

  // Switch to verify mode
  if (mode === 'plan') {
    this.session.setMode('verify');
  }

  // ❌ Simple Check 在这里!
  if (mode === 'verify' && iteration >= 2 && !done) {
    // 验证逻辑...
  }
}
```

### 问题分析

当 AI 返回 `done: true` 但**没有返回任何 actions** 时(这是验证通过的正确响应):
```json
{
  "todo": [],
  "actions": [],
  "done": true
}
```

代码的执行流程:
1. `if (aiResp.actions && aiResp.actions.length > 0)` → **false** (因为没有 actions)
2. **跳过整个 actions 块**
3. **Simple Check 不执行!**
4. 循环继续进入下一轮 ❌

---

## 🔧 需要的修复

### 修复方案

**将 Simple Check 移到 actions 块外部!**

**修复后的结构**:
```typescript
// Execute actions
if (aiResp.actions && aiResp.actions.length > 0) {
  // Execute all actions...

  // Switch to verify mode
  if (mode === 'plan') {
    this.session.setMode('verify');
  }
}

// ✅ Simple Check 移到这里 - 在 actions 块外部!
// 这样无论有没有 actions,都会执行验证
if (mode === 'verify' && iteration >= 2 && !done) {
  console.log(chalk.gray(`\n🔍 Checking if requirement is satisfied...\n`));

  try {
    const history = this.session.getTracker().getHistory();
    const checkPrompt = `...`;

    const checkResp = await callAI(...);

    // Parse using extractJSON (already fixed)
    const jsonStr = extractJSON(checkResp.content);
    const checkResult = JSON.parse(jsonStr);

    if (checkResult.satisfied) {
      console.log(chalk.green('\n✅ Requirement satisfied!'));
      done = true;
      break;  // ✅ 退出循环!
    }
  } catch (checkError) {
    // Handle errors...
  }
}

// Post-execution ReAct verification (also needs to check if actions were executed)
if (aiResp.actions && aiResp.actions.length > 0 && ultrathinkEnabled && iteration >= 6) {
  // ReAct verification...
}
```

### 具体修改

在 `src/repl.ts` 中,将第1889-1967行的代码块从 actions 块内部移到外部:

**当前结构** (错误):
```
第1853行: if (aiResp.actions && aiResp.actions.length > 0) {
第1854行:   // Execute actions...
第1876行:   if (mode === 'plan') { ... }
第1889行:   if (mode === 'verify' && iteration >= 2 && !done) {  ← ❌ 错误位置
第1890行:     // Simple check...
第1967行:   }
第2002行: }  ← actions 块结束
```

**正确结构** (修复后):
```
第1853行: if (aiResp.actions && aiResp.actions.length > 0) {
第1854行:   // Execute actions...
第1876行:   if (mode === 'plan') { ... }
第1881行: }  ← actions 块提前结束

第1882行: // ✅ Simple check 移到这里
第1883行: if (mode === 'verify' && iteration >= 2 && !done) {
第1884行:   // Simple check...
第1957行: }

第1958行: // ✅ Post-execution ReAct (也需要检查 actions)
第1959行: if (aiResp.actions && aiResp.actions.length > 0 && ultrathinkEnabled && iteration >= 6) {
第1960行:   // ReAct verification...
第1987行: }
```

---

## 📊 验证逻辑流程图

### 当前(错误)流程

```
┌─────────────────────────┐
│  AI 返回响应             │
└───────────┬─────────────┘
            │
            ├─ 有 actions?
            │  │
            │  ├─ YES → 执行 actions
            │  │         ├─ 切换到 verify 模式
            │  │         ├─ ⭐ Simple Check (执行!)
            │  │         └─ Post-execution ReAct
            │  │
            │  └─ NO → ❌ 跳过整个块
            │            └─ Simple Check 不执行!!
            │               └─ 继续下一轮循环 ❌
            │
            └─ 有 done=true? (在1833-1838行检查)
               └─ 如果 AI 没设置 done,不会退出
```

### 修复后流程

```
┌─────────────────────────┐
│  AI 返回响应             │
└───────────┬─────────────┘
            │
            ├─ 有 done=true?
            │  └─ YES → ✅ 立即退出 (1833-1838行)
            │
            ├─ 有 actions?
            │  └─ YES → 执行 actions → 切换模式
            │
            └─ ⭐ Simple Check (总是执行!)
               ├─ 条件: mode==='verify' && iteration>=2
               ├─ 调用 AI 验证
               ├─ 解析响应 (使用 extractJSON)
               └─ satisfied → done=true → ✅ 退出
```

---

## 🔍 为什么之前没发现

### 原因分析

1. **代码审查不够仔细** - 只看到 Simple Check 存在,没有注意到它在 actions 块内部
2. **测试场景不完整** - 可能只测试了有 actions 的场景
3. **AI 行为理解不足** - 没意识到 AI 在验证通过时应该返回空 actions + done=true

### 实际场景

**场景 1: AI 返回 done: true**
```json
{
  "todo": [],
  "actions": [],
  "done": true
}
```
- ✅ 第1833行检查 `aiResp.done === true` → **应该退出**
- 但如果 AI 没有设置 done,就无法退出

**场景 2: AI 忘记设置 done,返回空 actions**
```json
{
  "todo": [],
  "actions": []
}
```
- ❌ 第1833行检查失败 (done 是 undefined)
- ❌ actions 块不执行 (因为 actions.length === 0)
- ❌ Simple Check 不执行 (因为它在 actions 块内!)
- ❌ 循环继续 → 浪费 API 调用

**场景 3: AI 返回空 actions 但任务实际完成**
```json
{
  "todo": [],
  "actions": [],
  "done": false  // AI 误判
}
```
- ❌ 第1833行检查失败
- ❌ Simple Check 应该执行但因为错误位置而不执行
- ❌ 循环继续

---

## ✅ 已完成的修复

在之前的修复中,我们完成了:

1. **JSON 解析修复** ✅
   - 使用 robust `extractJSON`
   - 双重提取策略(content → description)
   - 位置: `src/repl.ts:1920-1952`

2. **工具调用修复** ✅
   - 传递 `availableTools` 参数
   - 位置: `src/repl.ts:1796`

3. **调试支持** ✅
   - 添加 `DEBUG_LOOP` 日志
   - 位置: `src/repl.ts:1847-1850`

4. **extractJSON 导出** ✅
   - 位置: `src/ai.ts:23`

---

## 🚀 手动修复步骤

### 步骤 1: 定位代码

打开 `src/repl.ts`,找到:
- 第1853行: `if (aiResp.actions && aiResp.actions.length > 0) {`
- 第1876-1880行: 模式切换
- 第1889-1967行: Simple Check (当前在错误位置)
- 第2003行: `}  ← actions 块结束`

### 步骤 2: 移动 Simple Check

1. **剪切** 第1882-1967行的注释和 Simple Check 代码
2. **粘贴** 到第1881行(actions 块)之后
3. **调整缩进** 减少一级(因为不再在 actions 块内)

### 步骤 3: 调整 Post-execution ReAct

确保 Post-execution ReAct 也有 `aiResp.actions` 检查:
```typescript
// 修改前
if (ultrathinkEnabled && iteration >= 6) {

// 修改后
if (aiResp.actions && aiResp.actions.length > 0 && ultrathinkEnabled && iteration >= 6) {
```

### 步骤 4: 构建验证

```bash
npm run build
```

### 步骤 5: 测试

```bash
DEBUG_LOOP=1 npx newma-cli -i
> /loop 5 Create test.txt with hello world
```

**期望输出**:
```
Iteration 1: Create test.txt
Iteration 2: [DEBUG] Mode: verify, done: false, hasActions: false
🔍 Checking if requirement is satisfied...
✅ Requirement satisfied!
Summary: 2 iterations | ✅ Completed
```

---

## 📝 代码差异

### 伪代码表示当前(错误)代码
```typescript
while (!done) {
  const aiResp = await callAI(...);

  // Check done flag
  if (mode === 'verify' && aiResp.done === true) {
    done = true;
    break;
  }

  // Execute actions block
  if (aiResp.actions && aiResp.actions.length > 0) {
    for (const action of aiResp.actions) {
      await executeAction(action);
    }

    if (mode === 'plan') {
      mode = 'verify';
    }

    // ❌ Simple check 在这里 - 只在有 actions 时执行
    if (mode === 'verify' && iteration >= 2 && !done) {
      const checkResult = await checkSatisfied();
      if (checkResult.satisfied) {
        done = true;
        break;
      }
    }
  }
  // ❌ 如果没有 actions,Simple check 不执行!
}
```

### 修复后的代码
```typescript
while (!done) {
  const aiResp = await callAI(...);

  // Check done flag
  if (mode === 'verify' && aiResp.done === true) {
    done = true;
    break;
  }

  // Execute actions block
  if (aiResp.actions && aiResp.actions.length > 0) {
    for (const action of aiResp.actions) {
      await executeAction(action);
    }

    if (mode === 'plan') {
      mode = 'verify';
    }
  }
  // ✅ actions 块结束

  // ✅ Simple check 在这里 - 总是执行!
  if (mode === 'verify' && iteration >= 2 && !done) {
    const checkResult = await checkSatisfied();
    if (checkResult.satisfied) {
      done = true;
      break;
    }
  }

  // Post-execution ReAct (只在有 actions 时执行)
  if (aiResp.actions && aiResp.actions.length > 0 && ultrathinkEnabled && iteration >= 6) {
    const verifyResult = await verifyWithReAct(...);
    if (verifyResult.satisfied) {
      done = true;
      break;
    }
  }
}
```

---

## 🎯 总结

### 三个 Bug 的完整修复

1. ✅ **JSON 解析** - `extractJSON` 函数修复
2. ✅ **工具调用** - 传递 `availableTools`
3. ⚠️ **Simple Check 位置** - **需要手动修复!**

### 关键修复

**必须将 Simple Check 从 actions 块内部移到外部!**

这是导致 loop 模式无法自动退出的**根本原因**。

### 为什么自动修复失败

- 文件被 linter 或其他进程自动修改
- Edit 工具无法匹配已修改的代码
- 需要手动定位并修改

---

**严重性**: 🔴 严重 - 导致基本功能失效
**优先级**: 🔥 最高 - 需要立即修复
**状态**: ⚠️ 问题已定位,等待手动修复

---

**创建日期**: 2026-01-19
**作者**: Claude Code
**文档**: LOOP_EXIT_CRITICAL_FIX.md
