# Newma (牛码) 改进路线图 2026

**日期**: 2026-01-25
**版本**: 3.3.0
**目标**: 系统化提升 Newma (牛码) 的成熟度和竞争力

## 📊 当前状态评估

### 代码库规模
- **源文件**: 130 个 TypeScript 文件
- **测试文件**: 10 个测试套件
- **测试覆盖率**: ~70% (目标: 85%)
- **文档**: 完整 (CLAUDE.md, README, PHASE*.md)

### 功能成熟度

| 维度 | Newma (牛码) | Codex | 差距 |
|------|------|-------|------|
| **AI 规划** | 9/10 | 7/10 | ✅ **领先** |
| **事件系统** | 10/10 | 7/10 | ✅ **领先** |
| **Loop 插件** | 8/10 | 8/10 | ✅ 相当 |
| **执行系统** | 8/10 | 9/10 | ⚠️ **落后** |
| **用户界面** | 6/10 | 9/10 | ⚠️ **落后** (缺TUI) |
| **测试质量** | 7/10 | 9/10 | ⚠️ **落后** |
| **安全性** | 6/10 | 9/10 | ⚠️ **落后** (缺沙盒) |
| **总体评分** | **7.7/10** | 8.25/10 | ⚠️ **需追赶** |

## 🎯 改进优先级矩阵

### 🔴 P0 - 关键缺失 (必须完成)

#### 1. Loop 系统集成到 REPL
**问题**: Loop 引擎已实现但未集成到主 REPL
**影响**: 新架构无法使用
**工作量**: 1-2 周
**价值**: ⭐⭐⭐⭐⭐

**具体任务**:
- [ ] 将 `LoopEngine` 集成到 `REPLManager`
- [ ] 迁移核心命令到插件系统
- [ ] 保持向后兼容性
- [ ] 添加集成测试

**文件**:
- `src/repl.ts` (修改)
- `src/loop/core/loop-engine.ts` (集成)
- `src/loop/core/ai-flow-controller.ts` (集成)

**验证标准**:
```bash
npx newma-cli -i
> /help  # 显示插件化的命令列表
```

---

#### 2. 事件源 (Event Sources) 集成到 REPL
**问题**: File Watcher, WebSocket, HTTP 已实现但未集成
**影响**: 多源事件功能无法使用
**工作量**: 1 周
**价值**: ⭐⭐⭐⭐

**具体任务**:
- [ ] 将 EventBroker 集成到 REPL 输入处理
- [ ] 添加事件源配置 API
- [ ] 实现事件源生命周期管理
- [ ] 添加使用示例

**文件**:
- `src/repl.ts` (修改)
- `src/loop/event/event-broker.ts` (集成)
- `src/loop/event/file-watcher-source.ts` (集成)
- `src/loop/event/websocket-source.ts` (集成)
- `src/loop/event/http-source.ts` (集成)

**验证标准**:
```bash
npx newma-cli -i
> /event-source add file:./src
> /event-source list
# File Watcher (watching ./src)
```

---

### 🟡 P1 - 高价值增强 (推荐)

#### 3. 测试覆盖率提升到 85%
**当前**: ~70%
**目标**: 85%
**缺口**: ~15% (约 20 个文件需要测试)
**工作量**: 1-2 周
**价值**: ⭐⭐⭐⭐

**优先测试的模块**:
1. **Loop 系统** (5 个文件)
   - `src/loop/core/loop-engine.ts`
   - `src/loop/core/ai-flow-controller.ts`
   - `src/loop/core/default-flow-controller.ts`
   - `src/loop/core/session-adapter.ts`
   - `src/loop/commands/command-manager.ts`

2. **事件系统** (3 个文件)
   - `src/loop/event/event-broker.ts`
   - `src/loop/event/event-mapper.ts`
   - `src/loop/event/readline-source.ts`

3. **核心执行** (4 个文件)
   - `src/executor-v2.ts`
   - `src/verifier.ts`
   - `src/permissions.ts`
   - `src/tools/registry.ts`

4. **AI 规划** (3 个文件)
   - `src/fft/planner.ts`
   - `src/landmark/planner.ts`
   - `src/ultrathink/planner.ts`

**测试策略**:
```bash
# 1. 为每个模块创建单元测试
test-loop-core.test.ts
test-event-broker.test.ts
test-executor-v2.test.ts
test-ai-planners.test.ts

# 2. 运行覆盖率测试
npm run test:coverage

# 3. 查看覆盖率报告
open coverage/lcov-report/index.html
```

**验证标准**:
```bash
npm run test:coverage
# coverage: 85%+ statements, 80%+ branches
```

---

#### 4. TUI (Terminal UI) 模式
**问题**: Codex 有全屏 TUI，Newma (牛码) 只有命令行
**影响**: 用户体验差距
**工作量**: 2-3 周
**价值**: ⭐⭐⭐⭐⭐

**技术选型**:
- **blessed** 或 **terminal-kit** (TUI 框架)
- **ink** (React for CLI，如果偏好 React)

**核心功能**:
1. **布局系统**
   - 主窗口 + 侧边栏
   - 任务进度面板
   - 文件树视图
   - 日志输出面板

2. **交互组件**
   - 可选择的任务列表
   - 可折叠的文件树
   - 进度条显示
   - 快捷键支持

3. **状态可视化**
   - 执行进度实时更新
   - 资源使用监控
   - 错误高亮显示

**文件结构**:
```
src/tui/
├── app.ts                 # TUI 应用主类
├── layout/
│   ├── main-layout.ts     # 主布局
│   └── sidebar.ts         # 侧边栏
├── components/
│   ├── task-list.ts       # 任务列表组件
│   ├── file-tree.ts       # 文件树组件
│   ├── progress-bar.ts    # 进度条组件
│   └── log-panel.ts       # 日志面板
└── hooks/
    └── use-keyboard.ts    # 键盘事件处理
```

**启动方式**:
```bash
npx newma-cli -i --tui
```

**参考**: Codex CLI 的 TUI 实现

**验证标准**:
```bash
npx newma-cli -i --tui
# 显示全屏界面，支持键盘导航
```

---

#### 5. 插件开发文档和示例
**问题**: Loop 插件系统已实现但缺少文档
**影响**: 社区无法贡献插件
**工作量**: 3-5 天
**价值**: ⭐⭐⭐

**文档内容**:
1. **插件快速入门**
   - 5 分钟创建第一个插件
   - 插件结构说明
   - 生命周期钩子

2. **插件 API 参考**
   - LoopPlugin 接口
   - LoopPluginContext 说明
   - FlowController API

3. **示例插件** (5 个)
   - Hello World 插件
   - 自定义命令插件
   - 事件拦截插件
   - 流控制插件
   - 数据统计插件

**文件**:
```
docs/PLUGIN_DEVELOPMENT.md
examples/loop-plugins/
├── hello-world/
│   ├── plugin.ts
│   ├── README.md
│   └── package.json
├── custom-command/
├── event-interceptor/
├── flow-controller/
└── stats-collector/
```

**验证标准**:
```bash
# 按照文档创建插件
npx newma-cli plugin create my-plugin
# 成功运行并显示 "Hello from my-plugin!"
```

---

### 🟢 P2 - 中期增强 (有价值但不紧急)

#### 6. 沙盒执行环境
**问题**: 直接执行命令有安全风险
**影响**: 生产环境安全性
**工作量**: 4-6 周
**价值**: ⭐⭐⭐⭐

**技术方案**:
1. **轻量级方案** (推荐，2-3 周)
   - 使用 node:worker_threads 隔离执行
   - 文件系统虚拟化 (memfs)
   - 资源限制 (CPU, 内存)

2. **完整方案** (备选，4-6 周)
   - Docker 容器集成
   - 完整进程隔离
   - 网络隔离

**核心功能**:
- 命令在隔离环境中执行
- 文件系统访问控制
- 资源使用限制
- 超时自动终止

**文件**:
```
src/sandbox/
├── worker-executor.ts     # Worker 线程执行器
├── filesystem-guard.ts    # 文件系统保护
├── resource-limiter.ts    # 资源限制器
└── sandbox-manager.ts     # 沙盒管理器
```

**配置**:
```typescript
{
  sandbox: {
    enabled: true,
    maxMemory: '512MB',
    maxCpuTime: 30000,
    allowedPaths: ['/home/user/project'],
    blockedCommands: ['rm -rf', 'dd', 'mkfs']
  }
}
```

**验证标准**:
```bash
npx newma-cli --sandbox
> /run rm -rf /
# Error: Command blocked by sandbox policy
```

---

#### 7. 性能优化和监控
**问题**: 缺少性能监控和优化
**影响**: 大规模项目使用体验
**工作量**: 1-2 周
**价值**: ⭐⭐⭐

**优化方向**:
1. **AI 调用优化**
   - 批量请求合并
   - 响应缓存
   - 并发控制

2. **文件扫描优化**
   - 增量扫描
   - 文件缓存
   - 并行扫描

3. **内存优化**
   - Execution history 分页
   - AST 解析结果缓存
   - WeakRefCount 使用

4. **监控指标**
   - AI 调用次数和延迟
   - 内存使用趋势
   - 文件操作耗时
   - 事件处理吞吐量

**文件**:
```
src/performance/
├── ai-cache.ts            # AI 响应缓存
├── incremental-scanner.ts # 增量扫描器
├── memory-monitor.ts      # 内存监控
└── metrics-collector.ts   # 指标收集
```

**验证标准**:
```bash
npx newma-cli --profile
# Performance Report:
# - AI calls: 45 (avg: 234ms)
# - Memory: 245MB (peak: 312MB)
# - Scan time: 1.2s
```

---

#### 8. Web UI 前端
**问题**: 仅支持命令行界面
**影响**: 远程协作和可视化
**工作量**: 4-6 周
**价值**: ⭐⭐⭐

**技术栈**:
- Next.js + shadcn/ui (React)
- WebSocket 实时通信
- Vercel AI SDK (流式响应)

**核心功能**:
1. **Web REPL**
   - 聊天界面
   - 代码编辑器
   - 文件浏览器

2. **任务可视化**
   - 任务流程图
   - 进度仪表盘
   - 日志查看器

3. **协作功能**
   - 会话分享
   - 多用户协作
   - 历史回放

**文件**:
```
web-ui/
├── app/
│   ├── page.tsx           # 主页
│   ├── repl/page.tsx      # Web REPL
│   └── dashboard/page.tsx # 仪表盘
├── components/
│   ├── chat.tsx
│   ├── code-editor.tsx
│   └── task-flow.tsx
└── lib/
    └── websocket-client.ts
```

**启动方式**:
```bash
npx newma-cli serve
# Starting web server on http://localhost:3000
```

---

### 🔵 P3 - 长期目标 (战略性)

#### 9. 企业级功能
**功能**:
- 多租户支持
- RBAC 权限控制
- SSO 单点登录
- 审计日志
- 私有化部署支持

**工作量**: 8-12 周
**价值**: ⭐⭐⭐⭐ (商业客户)

#### 10. AI 模型 Marketplace
**功能**:
- 支持多个 AI 模型
- 模型性能比较
- 自定义模型接入
- 模型路由策略

**工作量**: 3-4 周
**价值**: ⭐⭐⭐

#### 11. 插件市场
**功能**:
- 插件发布平台
- 插件搜索和安装
- 插件评价系统
- 插件开发者社区

**工作量**: 6-8 周
**价值**: ⭐⭐⭐⭐

---

## 📅 实施时间表

### Q1 2026 (1-3月)
**目标**: 完成关键缺失功能

- [x] Event sources 测试完成 ✅
- [ ] **Week 1-2**: Loop 系统集成到 REPL (P0-1)
- [ ] **Week 3**: 事件源集成到 REPL (P0-2)
- [ ] **Week 4-5**: 测试覆盖率提升到 85% (P1-3)
- [ ] **Week 6-8**: 插件开发文档 (P1-5)

**里程碑**: Loop 系统可用，测试覆盖率 85%+

### Q2 2026 (4-6月)
**目标**: 用户体验提升

- [ ] **Week 9-11**: TUI 模式 (P1-4)
- [ ] **Week 12-13**: 性能优化 (P2-7)
- [ ] **Week 14-17**: 沙盒执行 (P2-6)

**里程碑**: TUI 可用，安全性提升

### Q3 2026 (7-9月)
**目标**: 企业级功能

- [ ] **Week 18-23**: Web UI (P2-8)
- [ ] **Week 24-26**: AI 模型 Marketplace (P3-10)

**里程碑**: Web UI 可用

### Q4 2026 (10-12月)
**目标**: 生态建设

- [ ] **Week 27-34**: 插件市场 (P3-11)
- [ ] **Week 35-40**: 企业级功能 (P3-9)

**里程碑**: 插件生态建成

---

## 🎯 关键决策点

### 决策 1: Loop 集成策略
**问题**: 如何集成 Loop 引擎而不破坏现有 REPL？

**选项 A**: 渐进式迁移 ✅ 推荐
- 逐步将功能迁移到 Loop
- 保留旧 REPL 作为 fallback
- 风险低，周期长

**选项 B**: 大爆炸重写
- 直接替换为 Loop 引擎
- 风险高，周期短

**建议**: 选择 A，通过 `--loop` 标志逐步过渡

---

### 决策 2: 沙盒技术选型
**问题**: 选择轻量级还是完整方案？

**选项 A**: Worker Threads (轻量) ✅ 推荐
- 启动快，资源少
- 隔离性有限
- 适合 80% 场景

**选项 B**: Docker (完整)
- 完全隔离
- 资源重，启动慢
- 适合生产环境

**建议**: 先实现 A，B 作为可选方案

---

### 决策 3: TUI 框架选型
**问题**: 选择哪个 TUI 框架？

**选项 A**: blessed
- 成熟稳定
- 文档完善
- 学习曲线中等

**选项 B**: terminal-kit
- 功能丰富
- 性能好
- 学习曲线陡峭

**选项 C**: ink (React)
- React 生态
- 组件化开发
- 需要 React 知识

**建议**: 如果团队熟悉 React，选择 C；否则选择 A

---

## 📊 成功指标

### 技术指标
- [ ] 测试覆盖率: 70% → 85%
- [ ] 性能: AI 响应时间 < 2s
- [ ] 稳定性: 崩溃率 < 0.1%
- [ ] 安全性: 沙盒覆盖率 90%+

### 用户体验指标
- [ ] 启动时间: < 1s
- [ ] 响应延迟: < 100ms
- [ ] 错误恢复: 自动恢复率 95%+
- [ ] 文档完整度: 所有 API 有文档

### 生态指标
- [ ] 插件数量: 10+ 官方插件
- [ ] 社区贡献: 5+ 第三方插件
- [ ] 用户增长: 月活用户翻倍

---

## 🚀 立即开始的任务

### 今天就能做 (1 天内)
1. ✅ 为 `event-broker.ts` 添加单元测试
2. ✅ 为 `readline-source.ts` 添加单元测试
3. ✅ 运行测试覆盖率报告，识别优先测试的文件

### 本周完成 (5 天内)
1. 开始 Loop 系统集成到 REPL (P0-1)
2. 为 Loop 核心文件添加测试 (P1-3)
3. 创建插件开发文档大纲 (P1-5)

### 本月完成 (4 周内)
1. 完成 Loop 集成 (P0-1)
2. 完成事件源集成 (P0-2)
3. 测试覆盖率达到 80%+ (P1-3)
4. 完成插件开发文档 (P1-5)

---

## 📚 参考资源

### 竞品分析
- [Codex CLI](https://github.com/anthropics/codex) - TUI 和沙盒参考
- [Cursor](https://cursor.sh) - Web UI 参考
- [Aider](https://github.com/paul-gauthier/aider) - 性能优化参考

### 技术文档
- [Blessed 文档](https://github.com/chjj/blessed)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [Next.js 文档](https://nextjs.org/docs)

---

**最后更新**: 2026-01-25
**维护者**: Newma (牛码) Development Team
**反馈**: 请在 GitHub Issues 提出建议
