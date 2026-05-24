# newma API 模式多轮推理优化

**版本**: 3.5.0
**日期**: 2026-02-11
**目标**: 提升 CL-bench 通过率从 1.74% 到 3.5%+

---

## 📊 问题诊断

根据 `/Users/mac/cltest/cl-bench/FINAL_COMPARISON_REPORT.md` 测试报告：

**当前问题**：
- **通过率**: 1.74% (33/1898)
- **对比**: Claude Code 5.54% (差距 **3.19倍**)
- **速度**: 13.6s/样本 (比 Claude Code 快 2.9x)
- **核心缺陷**: 缺少多轮推理和验证机制

**根本原因**：
- 测试使用 `--api` 模式（infer_agent.py:169）
- API 模式只有**单次 AI 调用**（src/api.ts:30-65）
- **完全未使用**已有的 Loop 模式功能（src/loop/core/ai-flow-controller.ts:814-949）
- **完全未使用**已有的 ReAct 验证系统（src/ultrathink/verifier.ts）

---

## 🎯 优化方案

### 架构设计

```
API 模式质量级别
├── Level 1: 快速模式 (Fast)
│   ├── 单次 AI 调用
│   ├── 无验证
│   └── 向后兼容（保持 13.6s 速度）
│
├── Level 2: 标准模式 (Standard) - **默认**
│   ├── 2轮推理循环
│   ├── 轻量级验证
│   ├── 自动反馈优化
│   └── 预期 +100% 通过率提升
│
└── Level 3: 深度模式 (Deep)
    ├── 3轮推理循环
    ├── AI 自我评估验证
    ├── 完整错误反馈
    └── 预期 +200-300% 通过率提升
```

### 实施细节

#### 1. API 验证器（src/api-verifier.ts，新建）

**功能**：
- 响应长度验证（最小50-100字符）
- JavaScript/TypeScript 语法检查
- AI 自我评估（通过/失败判断）
- 置信度评分（0.0-1.0）

**关键接口**：
```typescript
export class APIVerifier {
  async quickVerify(
    requirement: string,
    response: string,
    options: QuickVerifyOptions
  ): Promise<VerificationResult>
}

export interface VerificationResult {
  passed: boolean;
  reason?: string;
  confidence: number; // 0-1
}
```

#### 2. API 模式 Loop 支持（src/api.ts，重构）

**新增函数**：
- `runApiModeWithLoop()` - 多轮推理核心函数
- `extractFinalResponse()` - 提取最终响应

**Loop 逻辑**：
```typescript
while (iteration < maxIterations && !satisfied) {
  // Phase 1: Plan - 使用 think 模式
  const planResult = await callAI(config, projectInfo, input, 'think', [], ...);

  // Phase 2: Execute - 跟踪工具调用（API 模式不实际执行）
  const actions = planResult.actions || [];

  // Phase 3: Verify - 使用 quickVerify()
  const verifyResult = await quickVerify(config, projectRoot, input, response, options);

  if (verifyResult.passed) {
    satisfied = true;
  } else {
    // 添加失败反馈，继续下一轮
    input += `\n[Failed: ${verifyResult.reason}]`;
  }
}
```

**迭代策略**：
- **Level 1**: 1次迭代，无验证
- **Level 2**: 2次迭代，基础验证（长度+语法）
- **Level 3**: 3次迭代，完整验证（+AI 评估）

#### 3. CLI 选项（src/cli.ts，修改）

**新增选项**：
```bash
--api-level <level>  # 1=fast, 2=standard (default), 3=deep
```

**向后兼容**：
- Level 1 保持原有单次调用行为
- 默认值 2 确保立即获得质量提升
- 不影响现有 `--api` 模式用户

#### 4. 单元测试（test/test-api-loop.ts，新建）

**测试覆盖**：
- ✅ Level 1 快速模式逻辑
- ✅ Level 2 标准模式迭代
- ✅ Level 3 深度模式验证
- ✅ API 验证器各功能
- ✅ Loop metadata 跟踪

#### 5. 集成测试脚本（test-clbench-integration.sh，新建）

**功能**：
- 小规模 CL-bench 测试（10-100样本）
- 自动化测试流程
- 结果对比基线
- 通过率统计

---

## 📁 文件清单

| 文件 | 状态 | 说明 |
|------|--------|------|
| `src/api-verifier.ts` | ✅ 新建 | API 验证器（387行）|
| `src/api-verifier.d.ts` | ✅ 新建 | 类型声明 |
| `src/api.ts` | ✅ 重构 | Loop 支持（+280行）|
| `src/cli.ts` | ✅ 修改 | 新增 `--api-level` 选项 |
| `test/test-api-loop.ts` | ✅ 新建 | 单元测试（280行）|
| `test-clbench-integration.sh` | ✅ 新建 | 集成测试（150行）|
| `API_LOOP_OPTIMIZATION.md` | ✅ 新建 | 本文档 |

---

## 🚀 使用方法

### 基础使用（向后兼容）

```bash
# Level 1: 快速模式（原有行为）
echo "Create fibonacci function" | npx newma-cli --api

# Level 2: 标准模式（推荐）
echo "Create fibonacci function" | npx newma-cli --api --api-level 2

# Level 3: 深度模式（高质量需求）
echo "Implement binary search tree" | npx newma-cli --api --api-level 3
```

### CL-bench 测试

```bash
# 使用新的 API level 选项重新运行测试
cd /Users/mac/cltest/cl-bench

# 修改 infer_agent.py 使用 --api-level
# 1. 在 infer_agent.py:169 添加 --api-level 参数
# 2. 将 level 作为参数传递

# Level 2: 标准测试（预期 +100% 通过率）
python3 infer_agent.py --agent newma \
  --input CL-bench-bing.jsonl \
  --samples 100 \
  --api-level 2

# Level 3: 深度测试（预期 +200-300% 通过率）
python3 infer_agent.py --agent newma \
  --input CL-bench-bing.jsonl \
  --samples 100 \
  --api-level 3
```

---

## 📊 预期效果

### 通过率提升

| Level | 迭代次数 | 验证方式 | 预期通过率 | 提升 |
|-------|----------|----------|------------|------|
| 1 | 1 | 无 | 1.74% | 0% (基线) |
| 2 | 2 | 长度+语法 | **3.5%** | **+100%** |
| 3 | 3 | +AI 自我评估 | **5-6%** | **+200-300%** |

### 速度影响

| Level | 预期时间 | 对比 |
|-------|----------|------|
| 1 | 13-15s | 保持原有速度 |
| 2 | 30-40s | 2-3x 慢，但质量更高 |
| 3 | 60-90s | 4-6x 慢，接近 Claude Code 质量 |

**结论**：
- **速度换质量**：用时间换取更高通过率
- **灵活选择**：用户可根据需求选择合适级别
- **渐进提升**：从 1.74% → 3.5% → 5-6%

---

## 🔄 迭代优化计划

### 短期（1-2周）

1. ✅ **完成基础 Loop 模式集成**
2. ✅ **实现轻量级验证器**
3. ✅ **添加 CLI 选项**
4. 🔄 **运行小规模测试验证**
5. ⏳ **根据反馈微调验证阈值**
6. ⏳ **优化 prompt 提示词**

### 中期（1个月）

1. ⏳ **实现 ReAct 验证集成**
2. ⏳ **添加 Few-Shot 学习示例**
3. ⏳ **优化错误反馈机制**
4. ⏳ **实现渐进式验证缓存**

### 长期（2-3个月）

1. ⏳ **完整 ReAct Loop 集成**
2. ⏳ **工具执行能力**（如果可行）
3. ⏳ **自我纠错和修复**
4. ⏳ **性能优化**（并行验证）

---

## ✅ 验证清单

### 编译验证
- [x] TypeScript 编译通过（API 模块无错误）
- [x] 类型检查通过（api-verifier.d.ts）
- [x] 向后兼容（Level 1 保持原行为）

### 功能验证
- [x] Level 1 单次调用（快速模式）
- [x] Level 2 双迭代（标准模式）
- [x] Level 3 三迭代（深度模式）
- [x] 验证器长度检查
- [x] 验证器语法检查
- [x] 验证器 AI 自我评估
- [ ] 小规模 CL-bench 测试（待执行）
- [ ] 通过率提升验证（待测试）
- [ ] 性能基准测试（待执行）

---

## 📖 相关文档

- [CL-bench 测试报告](/Users/mac/cltest/cl-bench/FINAL_COMPARISON_REPORT.md)
- [Loop 模式实现](/Users/mac/kode/src/loop/core/ai-flow-controller.ts:814-949)
- [ReAct 验证系统](/Users/mac/kode/src/ultrathink/verifier.ts)
- [API 模式文档](/Users/mac/kode/src/api.ts)

---

**最后更新**: 2026-02-11
**维护者**: newma 开发团队
