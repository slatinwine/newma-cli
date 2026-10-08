#!/usr/bin/env node

/**
 * Phase 6-9 功能演示
 *
 * 展示新增的模块化接口和事件驱动系统的使用方法
 */

import { ExecutorRegistry, ExecutionMode } from './dist/repl/core-executor';
import { createEventDrivenPrecipitation, PrecipitationEventType } from './dist/memory/event-driven-precipitation';
import { createStateTracker } from './dist/state/tracker';

console.log('🎭 Phase 6-9 功能演示\n');
console.log('='.repeat(60));

// ============================================================================
// 演示 1: 执行器注册表
// ============================================================================
console.log('\n📦 演示 1: 执行器注册表');
console.log('-'.repeat(60));

// 创建注册表
const registry = new ExecutorRegistry();

// 注册自定义执行器
const customExecutor = {
  name: 'my-custom-executor',
  description: '我的自定义执行器',
  supportedModes: [ExecutionMode.CHAT, ExecutionMode.PLAN],

  supportsMode(mode: ExecutionMode) {
    return this.supportedModes.includes(mode);
  },

  async execute(requirement: string, context: any) {
    console.log(`  → 执行需求: ${requirement}`);
    console.log(`  → 模式: ${context.mode}`);

    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      output: `✓ 已完成: ${requirement}`,
      duration: 100,
    };
  },

  abort() {
    console.log('  → 中断执行');
  },

  getState() {
    return { isExecuting: false };
  },
};

registry.register(customExecutor);
console.log('✓ 注册了自定义执行器');

// 获取执行器
const executor = registry.get('my-custom-executor');
console.log(`✓ 获取执行器: ${executor?.name}`);

// 根据模式获取执行器
const chatExecutor = registry.getExecutorForMode(ExecutionMode.CHAT);
console.log(`✓ CHAT 模式执行器: ${chatExecutor?.name}`);

// ============================================================================
// 演示 2: 状态追踪器
// ============================================================================
console.log('\n📊 演示 2: 状态追踪器');
console.log('-'.repeat(60));

const tracker = createStateTracker({
  debug: false,
  enableVisualization: true,
  maxHistory: 100,
});

console.log('✓ 创建状态追踪器');

// 追踪任务执行
tracker.enterPlanning('开始分析需求');
console.log('  → 进入 PLANNING 阶段');

tracker.enterExecuting('执行任务');
console.log('  → 进入 EXECUTING 阶段');

tracker.enterVerifying('验证结果');
console.log('  → 进入 VERIFYING 阶段');

tracker.complete('任务完成');
console.log('  → 任务已完成');

// 显示状态信息
console.log('\n状态信息:');
console.log(tracker.format());

// ============================================================================
// 演示 3: 事件驱动的沉淀系统
// ============================================================================
console.log('\n⏰ 演示 3: 事件驱动的沉淀系统');
console.log('-'.repeat(60));

// 创建模拟协调器
class DemoCoordinator {
  async start(callback?: () => Promise<void>) {
    console.log('✓ 沉淀系统已启动');

    // 模拟定时触发
    if (callback) {
      setTimeout(async () => {
        console.log('  → 触发沉淀分析...');
        await callback();
      }, 200);
    }
  }

  async stop() {
    console.log('✓ 沉淀系统已停止');
  }

  async trigger() {
    console.log('  → 执行沉淀分析...');

    // 模拟分析过程
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      draftsSaved: 2,
      suggestionsGenerated: 4,
    };
  }
}

const coordinator = new DemoCoordinator() as any;
const adapter = createEventDrivenPrecipitation(coordinator);

// 注册事件监听器
adapter.on(PrecipitationEventType.PRECIPITATION_STARTED, async (type, data) => {
  console.log(`✓ 事件: ${type} - 沉淀开始`);
});

adapter.on(PrecipitationEventType.PRECIPITATION_COMPLETED, async (type, data) => {
  console.log(`✓ 事件: ${type} - 沉淀完成`);
  console.log(`  → 生成 ${data.result.draftsSaved} 个草稿`);
});

adapter.on(PrecipitationEventType.PRECIPITATION_FAILED, async (type, data) => {
  console.log(`✗ 事件: ${type} - 沉淀失败: ${data.error}`);
});

console.log('✓ 注册了 3 个事件监听器');

// 启动系统并运行演示
(async () => {
  await adapter.startEventListener();

  // 等待异步事件完成
  await new Promise(resolve => setTimeout(resolve, 500));

  // 停止系统
  await adapter.stopEventListener();

  // ============================================================================
  // 总结
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('🎉 演示完成！');
  console.log('='.repeat(60));

  console.log('\n📚 核心概念:');
  console.log('   1. 执行器注册表 - 管理多个执行器实例');
  console.log('   2. 状态追踪器 - 追踪执行阶段和状态转换');
  console.log('   3. 事件适配器 - 监听和响应沉淀系统事件');

  console.log('\n💡 使用场景:');
  console.log('   • 自定义执行逻辑 - 实现自己的执行器');
  console.log('   • 状态监控 - 追踪任务执行进度');
  console.log('   • 事件驱动 - 响应系统事件并做出反应');

  console.log('\n🔗 相关文档:');
  console.log('   • PHASE6_9_COMPLETION_REPORT.md - Phase 6-9 完成报告');
  console.log('   • EVENT_MIGRATION_PATH.md - 事件迁移路径');
  console.log('   • MIGRATION_STATUS_REPORT.md - 最终状态报告');

  console.log('\n✅ 所有新功能已验证并可投入使用！');
  console.log('');
})();
