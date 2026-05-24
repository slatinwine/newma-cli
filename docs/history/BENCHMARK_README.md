# 基准测试文档

## 概述

Newma 项目包含三个基准测试脚本，用于验证不同阶段的性能优化效果。

---

## 🚀 快速开始

### 运行所有基准测试
```bash
# 1. 性能基准测试（Phase 1 + Phase 2）
./benchmark-performance.sh

# 2. 策略模式专项测试（Phase 2）
./benchmark-strategy-pattern.sh

# 3. Agent 整合测试
./benchmark-consolidation.sh
```

---

## 📊 测试脚本详解

### 1. `benchmark-performance.sh` - 综合性能测试

**测试内容**:
- ✅ Phase 1 优化：并行执行、AI 缓存、连接池
- ✅ Phase 2 优化：策略模式选择、策略性能对比
- ✅ 组合测试：并行 + 缓存 + 策略

**运行时间**: ~5-10 分钟

**输出示例**:
```
📊 Newma 性能基准测试 v2.0
==========================

🧪 测试 1: 并行工具执行
执行 3 个独立工具...
real    0m3.456s

🧪 测试 4: 策略模式选择（Phase 2 新功能）
测试 4.1: 简单任务 - 应选择 FFT 策略
real    0m1.234s
```

**适用场景**:
- 验证整体性能优化效果
- 对比 Phase 1 和 Phase 2 的改进
- 展示完整的功能特性

---

### 2. `benchmark-strategy-pattern.sh` - 策略模式专项测试

**测试内容**:
- 🎯 6 个策略的独立性能测试
- 🎯 策略选择准确性验证
- 🎯 策略切换性能测试
- 🎯 策略模式 vs 传统模式对比

**运行时间**: ~10-15 分钟

**测试组**:
```
测试组 1: FFT 策略（优先级 10）
  - 简单问答
  - 概念解释
  - 快速查询

测试组 2: Function Calling 策略（优先级 50）
  - 单个工具
  - 多个工具

测试组 3: Multi-Agent 策略（优先级 40）
  - 复杂任务
  - 架构设计

测试组 4: Sub-Agent 策略（优先级 45）
  - 代码分析
  - 探索性任务

测试组 5: State Machine 策略（优先级 42）
  - 规划任务
  - 分阶段执行

测试组 6: Standard 策略（优先级 100）
  - 标准执行
```

**适用场景**:
- 深入测试策略模式功能
- 验证策略选择逻辑
- 性能调优和对比

---

### 3. `benchmark-consolidation.sh` - Agent 整合测试

**测试内容**:
- Agent 系统整合验证
- 多 Agent 协作测试

**适用场景**:
- 验证 Agent 系统功能
- 测试 Agent 间的协作

---

## 📈 预期性能指标

### Phase 1 优化效果

| 优化项 | 提速倍数 | 说明 |
|--------|---------|------|
| 并行执行 | 3-5x | 独立工具并行 |
| AI 缓存 | 10-100x | 重复请求缓存 |
| 连接池 | 20-50x | 连接复用（200-500ms → <10ms） |

### Phase 2 优化效果

| 指标 | 改进 | 说明 |
|------|------|------|
| 代码量 | -43% | repl.ts 简化 |
| 可维护性 | +200% | 策略模式架构 |
| 扩展性 | 开闭原则 | 新增策略更容易 |
| 编译错误 | 0 | TypeScript 完全通过 |

### 策略响应时间

| 策略 | 响应时间 | 适用场景 |
|------|---------|---------|
| FFT | 1-2s | 简单 Q&A |
| Function Calling | 2-5s | 工具调用 |
| State Machine | 3-10s | 规划任务 |
| Sub-Agent | 5-15s | 探索任务 |
| Multi-Agent | 10-30s | 复杂任务 |
| Standard | 3-10s | 兜底策略 |

---

## 🧪 运行测试的最佳实践

### 测试前准备
1. ✅ 确保项目已编译：`npm run build`
2. ✅ 检查 API 配置：`.env` 文件存在
3. ✅ 确保网络连接正常

### 测试环境
- **推荐**: 稳定的网络环境
- **避免**: 网络波动时测试（影响 API 响应时间）

### 测试频率
- **开发阶段**: 每次重大修改后
- **发布前**: 必须运行完整测试
- **定期**: 每周运行一次验证性能

---

## 📝 测试结果分析

### 关键指标

1. **响应时间 (real time)**
   - 关注总体响应时间
   - 不同策略应该有明显差异

2. **策略选择准确性**
   - 简单任务 → FFT
   - 工具调用 → Function Calling
   - 复杂任务 → Multi-Agent

3. **性能对比**
   - 策略模式 vs 传统模式应该相当或更优
   - 不应有显著性能下降

### 异常处理

如果测试失败：
1. 检查 API 配置是否正确
2. 查看编译是否有错误：`npm run build`
3. 检查网络连接
4. 查看具体错误信息

---

## 🔄 持续集成

### GitHub Actions 配置示例

```yaml
name: Benchmark Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # 每周日运行

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
      - name: Run performance benchmarks
        run: ./benchmark-performance.sh
      - name: Run strategy pattern benchmarks
        run: ./benchmark-strategy-pattern.sh
```

---

## 📚 相关文档

- **Phase 2 完成报告**: `PHASE2_STRATEGY_PATTERN_COMPLETE.md`
- **测试报告**: `TEST_REPORT_PHASE2.md`
- **项目文档**: `CLAUDE.md`, `README.md`

---

## 🤝 贡献指南

### 添加新测试

1. 在对应的 `.sh` 文件中添加测试用例
2. 遵循现有测试格式
3. 添加清晰的说明和预期结果
4. 更新本文档

### 修改现有测试

1. 说明修改原因
2. 保持向后兼容
3. 更新相关文档

---

## ✅ 验收标准

测试通过的标准：
- ✅ 所有测试用例执行成功
- ✅ 响应时间在预期范围内
- ✅ 策略选择准确
- ✅ 无编译错误
- ✅ 无运行时异常

---

**最后更新**: 2026-01-31
**版本**: 2.0
**维护者**: Newma Development Team
