# Newma (牛码) 基准测试系统

统一的性能基准测试框架，用于建立和追踪 Newma (牛码) 的性能指标。

## 目录结构

```
bench/
├── run-bench.ts          # 主基准测试运行器
├── config.json           # 基准测试配置
├── results/              # 历史结果目录
│   └── .gitkeep
└── README.md             # 本文档
```

## 运行基准测试

### 运行所有基准测试

```bash
npx ts-node bench/run-bench.ts
```

### 运行特定套件

```bash
# 只运行流式响应测试
npx ts-node -e "
import { Benchmarks } from './bench/run-bench';
const bench = new Benchmarks();
await bench.benchmarkStreaming();
"

# 只运行并发执行测试
npx ts-node -e "
import { Benchmarks } from './bench/run-bench';
const bench = new Benchmarks();
await bench.benchmarkParallel();
"

# 只运行缓存测试
npx ts-node -e "
import { Benchmarks } from './bench/run-bench';
const bench = new Benchmarks();
await bench.benchmarkCache();
"
```

## 基准测试套件

### 1. 流式响应基准测试

测试流式数据处理与批量处理的性能差异。

**测试项目**:
- 增量处理: 50 个小数据块处理
- 批量处理: 一次性处理所有数据

**预期结果**:
- 增量处理应该显示更好的用户感知性能
- 批量处理可能有更低的绝对时间

### 2. 并发执行基准测试

对比串行执行与并行执行的效率。

**测试项目**:
- 串行执行: 5 个操作顺序执行
- 并行执行: 5 个操作并行执行

**预期结果**:
- 并行执行应该快 3-5 倍
- 延迟时间越明显，加速比越高

### 3. 缓存系统基准测试

测试缓存系统的读写性能。

**测试项目**:
- 缓存命中: 从缓存读取已知键
- 缓存未命中: 读取不存在的键
- 缓存写入: 写入新键值对

**预期结果**:
- 缓存命中应该极快 (<1ms)
- 缓存未命中应该稍慢
- 缓存写入应该在可接受范围内

### 4. 依赖分析基准测试

测试依赖分析和拓扑排序的性能。

**测试项目**:
- 构建依赖图: 分析 20 个操作的依赖关系
- 拓扑排序: 对依赖图进行排序

**预期结果**:
- 两个操作都应该很快 (<10ms)
- 复杂度应该是 O(V + E)

## 结果解读

### 性能指标

1. **耗时 (ms)**: 操作执行时间
2. **速度 (ops/s)**: 每秒操作数
3. **内存 (MB)**: 堆内存使用量

### 基准标准

#### 流式响应
- 增量处理: <1000ms (50 个块)
- 批量处理: <500ms

#### 并发执行
- 串行执行: ~250ms (5 * 50ms)
- 并行执行: ~50ms (50ms，最快的一个)
- **加速比**: >3x

#### 缓存系统
- 缓存命中: <0.1ms
- 缓存未命中: <1ms
- 缓存写入: <1ms

#### 依赖分析
- 构建依赖图: <10ms (20 操作)
- 拓扑排序: <10ms (20 操作)

## 历史对比

### 保存基准

```bash
# 运行并保存结果
npx ts-node bench/run-bench.ts > bench/results/$(date +%Y%m%d-%H%M%S).txt

# 保存 JSON 结果
npx ts-node -e "
import { Benchmarks } from './bench/run-bench';
const bench = new Benchmarks();
await bench.runAll();
await bench.saveResults('bench/results/latest.json');
"
```

### 对比基准

```bash
# 比较两次运行
diff bench/results/before.json bench/results/after.json
```

## 性能目标

### 最低要求

- ✅ 所有测试必须通过
- ✅ 并发加速比 > 2x
- ✅ 缓存命中 < 1ms
- ✅ 依赖分析 < 20ms (20 操作)

### 理想目标

- 🎯 并发加速比 > 3x
- 🎯 缓存命中 < 0.1ms
- 🎯 依赖分析 < 10ms (20 操作)
- 🎯 总测试时间 < 10s

## 持续集成

### CI 配置

在 CI 中运行基准测试：

```yaml
# .github/workflows/benchmark.yml
name: Benchmark

on: [push, pull_request]

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
      - name: Run benchmarks
        run: npx ts-node bench/run-bench.ts
      - name: Save results
        uses: actions/upload-artifact@v2
        with:
          name: benchmark-results
          path: bench-results.json
```

## 故障排查

### 测试失败

1. **清理缓存**: `rm -rf ~/.kode/cache`
2. **强制 GC**: 添加 `--expose-gc` 标志
   ```bash
   node --expose-gc -r ts-node/register bench/run-bench.ts
   ```
3. **增加迭代次数**: 修改 `iterations` 参数

### 性能下降

1. 检查系统负载: `top` 或 `htop`
2. 关闭其他应用
3. 重启测试
4. 对比历史结果

## 扩展

### 添加新基准测试

```typescript
// 在 Benchmarks 类中添加新方法
async benchmarkMyFeature(): Promise<void> {
  console.log(chalk.cyan('\n🧪 运行我的功能基准测试...\n'));

  await this.runner.add(
    '我的功能',
    '测试场景 1',
    async () => {
      // 测试代码
    },
    100 // 迭代次数
  );
}
```

### 自定义配置

创建 `bench/config.json`:

```json
{
  "iterations": {
    "default": 100,
    "fast": 1000,
    "slow": 10
  },
  "timeout": 30000,
  "warmup": true,
  "gc": true
}
```

## 相关文档

- [CLI_AGENT_BEST_PRACTICES_REPORT.md](../CLI_AGENT_BEST_PRACTICES_REPORT.md) - 最佳实践报告
- [KODE_FINAL_OPTIMIZATION_REPORT.md](../KODE_FINAL_OPTIMIZATION_REPORT.md) - 优化报告
- [test/](../test/) - 单元测试目录

## 贡献

提交基准测试更改时，请：

1. 运行完整的基准测试套件
2. 保存结果到 `bench/results/`
3. 在 PR 中包含性能变化说明
4. 更新本文档（如果添加新测试）

---

**最后更新**: 2026-01-28
**版本**: 1.0.0
