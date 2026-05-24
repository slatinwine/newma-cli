/**
 * 策略模式功能测试
 */

import { StrategyExecutor } from './src/execution/strategy/strategy-executor';
import { ExecutionMode, ExecutionContext } from './src/execution/strategy/types';

// Mock Config
const mockConfig: any = {
  apiKey: 'test-key',
  baseUrl: 'https://api.test.com',
  model: 'test-model',
  useFFT: true,
  executionMode: 'standard',
  useStrategy: true,
};

// Mock Session
const mockSession: any = {
  getConfig: () => mockConfig,
  getProjectRoot: () => '/tmp/test',
  getTracker: () => ({
    getHistory: () => [],
  }),
};

async function testStrategyExecutor() {
  console.log('🧪 策略模式功能测试\n');
  console.log('=' .repeat(60));

  // 测试 1: 策略执行器初始化
  console.log('\n📋 测试 1: 策略执行器初始化');
  try {
    const executor = new StrategyExecutor();
    console.log('✅ StrategyExecutor 实例化成功');

    const strategies = executor.getRegisteredStrategies();
    console.log(`✅ 已注册 ${strategies.length} 个策略:`);
    strategies.forEach(s => {
      console.log(`   - ${s.name} (优先级: ${s.priority})`);
    });
  } catch (error: any) {
    console.log('❌ 初始化失败:', error.message);
    return;
  }

  // 测试 2: FFT 策略 canHandle
  console.log('\n📋 测试 2: FFT 策略 canHandle 检测');
  try {
    const { FFTStrategy } = await import('./src/execution/strategy/fft-strategy');
    const fftStrategy = new FFTStrategy();

    // 简单任务
    const simpleContext: any = {
      requirement: '什么是闭包？',
      mode: ExecutionMode.FFT,
      config: { ...mockConfig, useFFT: true },
      session: mockSession,
    };

    const canHandleSimple = await fftStrategy.canHandle(simpleContext);
    console.log(`✅ 简单任务 "${simpleContext.requirement}": ${canHandleSimple ? '✓ FFT 可处理' : '✗ FFT 不可处理'}`);

    // 复杂任务
    const complexContext: any = {
      requirement: '实现一个完整的用户认证系统',
      mode: ExecutionMode.FFT,
      config: { ...mockConfig, useFFT: true },
      session: mockSession,
    };

    const canHandleComplex = await fftStrategy.canHandle(complexContext);
    console.log(`✅ 复杂任务 "${complexContext.requirement}": ${canHandleComplex ? '✓ FFT 可处理' : '✗ FFT 不可处理'}`);
  } catch (error: any) {
    console.log('❌ FFT 策略测试失败:', error.message);
  }

  // 测试 3: Standard 策略兜底
  console.log('\n📋 测试 3: Standard 策略兜底');
  try {
    const { StandardStrategy } = await import('./src/execution/strategy/standard-strategy');
    const standardStrategy = new StandardStrategy();

    const context: any = {
      requirement: '任意任务',
      mode: ExecutionMode.STANDARD,
      config: mockConfig,
      session: mockSession,
    };

    const canHandle = await standardStrategy.canHandle(context);
    console.log(`✅ Standard 策略兜底: ${canHandle ? '✓ 总是可处理' : '✗ 不可处理'}`);
  } catch (error: any) {
    console.log('❌ Standard 策略测试失败:', error.message);
  }

  // 测试 4: 策略优先级排序
  console.log('\n📋 测试 4: 策略优先级排序');
  try {
    const executor = new StrategyExecutor();
    const strategies = executor.getRegisteredStrategies();

    console.log('✅ 策略按优先级排序:');
    strategies.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name.padEnd(25)} (priority: ${s.priority})`);
    });

    // 验证排序
    const priorities = strategies.map(s => s.priority);
    const isSorted = priorities.every((p, i) => i === 0 || priorities[i - 1] <= p);
    console.log(`✅ 优先级排序正确: ${isSorted ? '✓ 是' : '✗ 否'}`);
  } catch (error: any) {
    console.log('❌ 优先级测试失败:', error.message);
  }

  // 测试 5: 多 Agent 策略条件检查
  console.log('\n📋 测试 5: Multi-Agent 策略条件检查');
  try {
    const { MultiAgentStrategy } = await import('./src/execution/strategy/multi-agent-strategy');
    const multiAgentStrategy = new MultiAgentStrategy();

    // 未启用 multi-agent
    const disabledContext: any = {
      requirement: '实现一个复杂的系统',
      mode: ExecutionMode.MULTI_AGENT,
      config: { ...mockConfig, executionMode: 'standard' },
      session: mockSession,
    };

    const canHandleDisabled = await multiAgentStrategy.canHandle(disabledContext);
    console.log(`✅ Multi-Agent 未启用: ${canHandleDisabled ? '✗ 不应该处理' : '✓ 正确拒绝'}`);

    // 启用 multi-agent
    const enabledContext: any = {
      requirement: '实现一个复杂的系统',
      mode: ExecutionMode.MULTI_AGENT,
      config: { ...mockConfig, executionMode: 'multi-agent' },
      session: mockSession,
    };

    const canHandleEnabled = await multiAgentStrategy.canHandle(enabledContext);
    console.log(`✅ Multi-Agent 已启用: ${canHandleEnabled ? '✓ 正确处理' : '✗ 应该处理'}`);
  } catch (error: any) {
    console.log('❌ Multi-Agent 策略测试失败:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 策略模式功能测试完成！\n');
}

// 运行测试
testStrategyExecutor().catch(error => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});
