# Newma (牛码) CLI - Comprehensive Manual Testing Plan

**目标**: 系统化测试 Newma (牛码) CLI 的所有模式，记录体验问题和改进建议

**测试日期**: 2026-01-26
**测试人员**: Claude Code Agent
**版本**: 3.3.1

## 测试环境

```bash
node --version  # v22.x
npm --version   # Latest
Working Dir: /Users/mac/kode
```

## Phase 1: Execution Modes 测试

### Test 1.1: Standard Mode

**命令**:
```bash
npx newma-cli -i
> /set executionMode standard
> /plan 列出当前目录的所有 TypeScript 文件
```

**测试要点**:
- [ ] 命令是否执行成功
- [ ] 输出格式是否清晰
- [ ] 是否有错误提示
- [ ] 响应时间是否合理

**预期行为**:
- 使用标准 AI 调用
- 生成 JSON 格式的计划
- 直接执行任务

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 1.2: Function-Calling Mode

**命令**:
```bash
npx newma-cli -i
> /set executionMode function-calling
> /plan 创建一个简单的测试文件
```

**测试要点**:
- [ ] 是否使用 OpenAI Function Calling API
- [ ] 工具调用是否正确
- [ ] 响应格式是否符合预期
- [ ] 错误处理是否完善

**预期行为**:
- 使用 `tools` 参数
- AI 返回 `tool_calls`
- 系统解析并执行工具

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 1.3: Two-Phase Mode

**命令**:
```bash
npx newma-cli -i
> /set executionMode two-phase
> /plan 添加错误处理到现有代码
```

**测试要点**:
- [ ] 是否明确区分规划和执行阶段
- [ ] 用户确认流程是否清晰
- [ ] 两阶段切换是否流畅
- [ ] 是否可以中断执行

**预期行为**:
- Phase 1: 生成计划，等待确认
- Phase 2: 执行计划中的步骤
- 清晰的阶段提示

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 1.4: Multi-Agent Mode

**命令**:
```bash
npx newma-cli -i
> /set executionMode multi-agent
> /plan 重构后端 API 和前端组件
```

**测试要点**:
- [ ] 是否正确分配任务给不同 agent
- [ ] Agent 协调是否顺畅
- [ ] 并行执行是否有效
- [ ] 结果聚合是否完整

**预期行为**:
- Frontend Agent 处理前端任务
- Backend Agent 处理后端任务
- Coordinator 协调执行

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 1.5: Subagent Mode (Default)

**命令**:
```bash
npx newma-cli -i
> /plan 添加用户认证功能
```

**测试要点**:
- [ ] Planning Subagent 是否只使用只读工具
- [ ] Execution Subagent 是否有完整权限
- [ ] 两阶段切换是否清晰
- [ ] 用户确认机制是否友好

**预期行为**:
- Phase 1: Planning Subagent 分析并生成计划
- 用户确认
- Phase 2: Execution Subagent 执行计划

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

## Phase 2: AI Commands 测试

### Test 2.1: /plan Command

**命令**:
```bash
npx newma-cli -i
> /plan 创建一个新的 REST API 端点
```

**测试要点**:
- [ ] 计划生成是否详细
- [ ] 是否显示风险评估
- [ ] 时间估算是否合理
- [ ] 是否可以修改计划
- [ ] 是否可以拒绝计划

**预期行为**:
- 生成结构化的执行计划
- 显示预计时间和风险
- 等待用户确认

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 2.2: /do Command

**命令**:
```bash
npx newma-cli -i
> /do 修复 ESLint 报错
```

**测试要点**:
- [ ] 是否直接执行（无计划阶段）
- [ ] 执行速度是否快于 /plan
- [ ] 是否有执行摘要
- [ ] 错误处理是否及时

**预期行为**:
- 直接执行任务
- 显示执行进度
- 提供执行结果

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 2.3: Default Chat Mode

**命令**:
```bash
npx newma-cli -i
> TypeScript 中什么是泛型？
```

**测试要点**:
- [ ] 是否识别为对话（非任务）
- [ ] 回复是否自然
- [ ] 是否尝试执行工具
- [ ] 响应速度是否快

**预期行为**:
- 纯 AI 对话
- 不执行任何工具
- 自然语言回复

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 2.4: /execute Command (if exists)

**命令**:
```bash
npx newma-cli -i
> /execute npm test
```

**测试要点**:
- [ ] 命令是否执行
- [ ] 输出是否显示
- [ ] 错误是否捕获

**预期行为**:
_待确认命令是否存在_

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 2.5: /verify Command

**命令**:
```bash
npx newma-cli -i
> /verify
```

**测试要点**:
- [ ] 是否自动检测验证阶段
- [ ] 验证是否全面
- [ ] 结果是否清晰
- [ ] 失败时是否自动修复

**预期行为**:
- 运行 TypeScript, ESLint, Tests
- 显示验证结果
- 自动修复问题

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 2.6: /loop Command (if exists)

**命令**:
```bash
npx newma-cli -i
> /loop 实现用户登录
```

**测试要点**:
- [ ] 是否执行完整的 plan→execute→verify 循环
- [ ] 迭代次数控制是否有效
- [ ] 是否提前终止
- [ ] 最终验证是否通过

**预期行为**:
_待确认命令是否存在_

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

## Phase 3: Planning Algorithms 测试

### Test 3.1: FFT (Fast and Frugal Tree)

**命令**:
```bash
npx newma-cli -i
> /set useFFT true
> /plan 什么是闭包？
```

**测试要点**:
- [ ] 响应是否快速（1-2秒）
- [ ] 决策路径是否显示
- [ ] 是否适合简单问题
- [ ] 复杂任务是否降级

**预期行为**:
- 快速响应
- 显示决策路径
- 适合简单问答

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 3.2: Landmark Counting

**命令**:
```bash
npx newma-cli -i
> /set useLandmark true
> /plan 添加数据库连接
```

**测试要点**:
- [ ] 里程碑是否清晰
- [ ] 依赖关系是否正确
- [ ] 执行顺序是否合理
- [ ] 时间估算是否准确

**预期行为**:
- 基于里程碑的计划
- 拓扑排序的执行顺序
- 3-5秒响应时间

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 3.3: ToT (Tree of Thoughts)

**命令**:
```bash
npx newma-cli -i
> /set ultrathink true
> /plan 设计微服务架构
```

**测试要点**:
- [ ] 是否生成多个方案
- [ ] 思考树是否显示
- [ ] 方案选择是否合理
- [ ] 是否有价值评分

**预期行为**:
- 多路径推理
- 方案比较
- 选择最优方案

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 3.4: Auto Algorithm Selection

**命令**:
```bash
npx newma-cli -i
> /set autoAlgorithm true  # (default)
> /plan [various tasks]
```

**测试要点**:
- [ ] 简单问题是否使用 FFT
- [ ] 中等任务是否使用 Landmark
- [ ] 复杂任务是否使用 ToT
- [ ] 选择是否透明

**预期行为**:
- 自动识别任务复杂度
- 选择合适算法
- 显示选择原因

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

## Phase 4: REPL Commands 测试

### Test 4.1: /set Command

**命令**:
```bash
npx newma-cli -i
> /set
> /set executionMode subagent
> /set functionCalling true
```

**测试要点**:
- [ ] 帮助信息是否完整
- [ ] 设置是否生效
- [ ] 当前值是否显示
- [ ] 无效值是否拒绝

**预期行为**:
- 显示所有配置选项
- 实时更新配置
- 验证输入有效性

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 4.2: /status Command

**命令**:
```bash
npx newma-cli -i
> /status
```

**测试要点**:
- [ ] 信息是否全面
- [ ] 格式是否清晰
- [ ] 统计是否准确
- [ ] 配置是否正确显示

**预期行为**:
- 显示会话状态
- 显示执行统计
- 显示当前配置

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 4.3: /history Command

**命令**:
```bash
npx newma-cli -i
> /history
```

**测试要点**:
- [ ] 历史是否完整
- [ ] 格式是否易读
- [ ] 是否可以搜索
- [ ] 是否可以重用

**预期行为**:
- 显示所有命令
- 显示执行结果
- 可滚动查看

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 4.4: /clear Command

**命令**:
```bash
npx newma-cli -i
> /clear
```

**测试要点**:
- [ ] 屏幕是否清理
- [ ] 会话状态是否保留
- [ ] 历史是否保留

**预期行为**:
- 清空屏幕
- 保留会话

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 4.5: /help Command

**命令**:
```bash
npx newma-cli -i
> /help
```

**测试要点**:
- [ ] 帮助是否完整
- [ ] 示例是否清晰
- [ ] 格式是否友好
- [ ] 是否分分类

**预期行为**:
- 显示所有命令
- 提供使用示例
- 清晰的分组

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 4.6: /exit Command

**命令**:
```bash
npx newma-cli -i
> /exit
```

**测试要点**:
- [ ] 退出是否干净
- [ ] 资源是否释放
- [ ] 是否有告别信息
- [ ] 会话是否保存

**预期行为**:
- 显示会话摘要
- 清理资源
- 正常退出

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

## Phase 5: Edge Cases & Error Handling

### Test 5.1: Invalid Input

**命令**:
```bash
npx newma-cli -i
> /invalid-command
> /set invalid-option
```

**测试要点**:
- [ ] 错误信息是否清晰
- [ ] 是否有建议
- [ ] 是否不崩溃

**预期行为**:
- 友好的错误提示
- 提供建议
- 继续运行

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 5.2: Interrupt Handling

**命令**:
```bash
npx newma-cli -i
> /plan [long task]
> ^C (Ctrl+C)
```

**测试要点**:
- [ ] 是否立即中断
- [ ] 资源是否清理
- [ ] 状态是否一致
- [ ] 是否可以继续

**预期行为**:
- 取消当前操作
- 保留会话
- 显示中断信息

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 5.3: API Errors

**命令**:
```bash
# Simulate API failure
OPENAI_API_KEY=invalid npx newma-cli -i
> /plan test
```

**测试要点**:
- [ ] 错误是否捕获
- [ ] 重试是否有效
- [ ] 信息是否友好
- [ ] 是否有降级

**预期行为**:
- 显示错误原因
- 尝试重试
- 不崩溃

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

## Phase 6: User Experience 测试

### Test 6.1: First-Time User Experience

**场景**: 用户首次使用 Newma (牛码)

**测试要点**:
- [ ] 欢迎信息是否友好
- [ ] 默认配置是否合理
- [ ] 帮助是否易于找到
- [ ] 学习曲线是否平缓

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 6.2: Performance

**测试要点**:
- [ ] 启动时间
- [ ] 命令响应时间
- [ ] AI 调用延迟
- [ ] 内存使用

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

### Test 6.3: Output Readability

**测试要点**:
- [ ] 颜色使用是否合理
- [ ] 格式是否一致
- [ ] 信息密度是否适中
- [ ] 是否有冗余输出

**实际体验**:
_待测试_

**问题记录**:
_待记录_

---

## UX Issue Categories

### 1. Critical Issues ( blockers)
- 系统崩溃或数据丢失
- 核心功能无法使用
- 安全问题

### 2. Major Issues (pain points)
- 功能存在但难以使用
- 性能问题导致等待
- 错误信息不清晰
- 缺少关键功能

### 3. Minor Issues (annoyances)
- UI/UX 不一致
- 输出格式不理想
- 帮助信息不足
- 小功能缺失

### 4. Enhancement Requests (nice-to-haves)
- 新功能建议
- 优化建议
- 体验改进

---

## Testing Checklist Summary

**Execution Modes**: 5 tests
- [ ] Standard
- [ ] Function-Calling
- [ ] Two-Phase
- [ ] Multi-Agent
- [ ] Subagent

**AI Commands**: 6 tests
- [ ] /plan
- [ ] /do
- [ ] Chat mode
- [ ] /execute
- [ ] /verify
- [ ] /loop

**Planning Algorithms**: 4 tests
- [ ] FFT
- [ ] Landmark
- [ ] ToT
- [ ] Auto Selection

**REPL Commands**: 6 tests
- [ ] /set
- [ ] /status
- [ ] /history
- [ ] /clear
- [ ] /help
- [ ] /exit

**Edge Cases**: 3 tests
- [ ] Invalid Input
- [ ] Interrupt Handling
- [ ] API Errors

**UX**: 3 tests
- [ ] First-Time Experience
- [ ] Performance
- [ ] Output Readability

**Total**: 27 test scenarios

---

## Next Steps

1. 执行所有测试场景
2. 记录实际体验
3. 整理 UX 问题
4. 优先级排序
5. 生成改进建议

---

**测试记录位置**: `UX_TESTING_RESULTS.md`
**问题追踪**: `UX_ISSUES.md`
