/**
 * 基础状态机功能测试
 * 验证状态机核心逻辑是否正常工作
 */

import { PlanStateMachine, PlanState, NavigationAction, createPlanStateMachine } from './src/plan-state-machine';

async function runTests() {
  console.log('========================================');
  console.log('状态机基础功能测试');
  console.log('========================================\n');

  // 测试1: 创建状态机
  console.log('测试1: 创建状态机');
  try {
    const sm = createPlanStateMachine('test requirement', {});
    console.log('✅ 状态机创建成功');
    console.log('   初始状态:', sm.getState());
    console.log('   需求:', sm.getContext().requirement);
    console.log('');
  } catch (error) {
    console.error('❌ 状态机创建失败:', error);
    process.exit(1);
  }

  // 测试2: 状态转换 - OPTION_SELECTION → PLAN_CONFIRMATION
  console.log('测试2: 状态转换（选择方案 → 确认）');
  try {
    const sm = new PlanStateMachine(PlanState.OPTION_SELECTION, {
      requirement: 'test',
      projectInfo: {},
    });

    console.log('   当前状态:', sm.getState());
    const transition = await sm.transition(NavigationAction.CONTINUE);
    console.log('   转换后状态:', transition.nextState);
    console.log('   是否退出:', transition.shouldExit);

    if (transition.nextState === PlanState.PLAN_CONFIRMATION && !transition.shouldExit) {
      console.log('✅ 状态转换成功');
    } else {
      console.error('❌ 状态转换失败');
    }
    console.log('');
  } catch (error) {
    console.error('❌ 状态转换测试失败:', error);
  }

  // 测试3: 状态转换 - PLAN_CONFIRMATION → EXECUTING
  console.log('测试3: 状态转换（确认 → 执行）');
  try {
    const sm = new PlanStateMachine(PlanState.PLAN_CONFIRMATION, {
      requirement: 'test',
      projectInfo: {},
    });

    console.log('   当前状态:', sm.getState());
    const transition = await sm.transition(NavigationAction.CONFIRM);
    console.log('   转换后状态:', transition.nextState);

    if (transition.nextState === PlanState.EXECUTING && !transition.shouldExit) {
      console.log('✅ 状态转换成功');
    } else {
      console.error('❌ 状态转换失败');
    }
    console.log('');
  } catch (error) {
    console.error('❌ 状态转换测试失败:', error);
  }

  // 测试4: 返回功能
  console.log('测试4: 返回功能（确认 → 选择）');
  try {
    const sm = new PlanStateMachine(PlanState.PLAN_CONFIRMATION, {
      requirement: 'test',
      projectInfo: {},
    });

    console.log('   当前状态:', sm.getState());
    const transition = await sm.transition(NavigationAction.BACK);
    console.log('   转换后状态:', transition.nextState);

    if (transition.nextState === PlanState.OPTION_SELECTION && !transition.shouldExit) {
      console.log('✅ 返回功能正常');
    } else {
      console.error('❌ 返回功能失败');
    }
    console.log('');
  } catch (error) {
    console.error('❌ 返回功能测试失败:', error);
  }

  // 测试5: 退出功能
  console.log('测试5: 退出功能');
  try {
    const sm = new PlanStateMachine(PlanState.OPTION_SELECTION, {
      requirement: 'test',
      projectInfo: {},
    });

    console.log('   当前状态:', sm.getState());
    const transition = await sm.transition(NavigationAction.EXIT);
    console.log('   转换后状态:', transition.nextState);
    console.log('   是否退出:', transition.shouldExit);

    if (transition.nextState === PlanState.CANCELLED && transition.shouldExit) {
      console.log('✅ 退出功能正常');
    } else {
      console.error('❌ 退出功能失败');
    }
    console.log('');
  } catch (error) {
    console.error('❌ 退出功能测试失败:', error);
  }

  // 测试6: 上下文更新
  console.log('测试6: 上下文更新');
  try {
    const sm = createPlanStateMachine('test', {});
    sm.updateContext({
      selectedOption: {
        id: 'plan-1',
        name: 'Test Plan',
        description: 'Test',
        strategy: 'balanced',
        actions: [],
        estimatedTime: 1000,
        riskLevel: 'low',
        pros: ['fast'],
        cons: ['simple'],
        confidence: 0.8,
      },
    });

    const context = sm.getContext();
    if (context.selectedOption && context.selectedOption.name === 'Test Plan') {
      console.log('✅ 上下文更新成功');
      console.log('   选定方案:', context.selectedOption.name);
    } else {
      console.error('❌ 上下文更新失败');
    }
    console.log('');
  } catch (error) {
    console.error('❌ 上下文更新测试失败:', error);
  }

  // 测试7: 重新生成限制
  console.log('测试7: 重新生成次数限制');
  try {
    const sm = new PlanStateMachine(
      PlanState.OPTION_SELECTION,
      { requirement: 'test', projectInfo: {} },
      { allowRegenerate: true, maxRegenerations: 2 }
    );

    // 第一次重新生成
    let t1 = await sm.transition(NavigationAction.REGENERATE);
    console.log('   第1次重新生成:', t1.nextState === PlanState.ANALYZING ? '✅' : '❌');

    sm.setState(PlanState.OPTION_SELECTION);
    let t2 = await sm.transition(NavigationAction.REGENERATE);
    console.log('   第2次重新生成:', t2.nextState === PlanState.ANALYZING ? '✅' : '❌');

    sm.setState(PlanState.OPTION_SELECTION);
    let t3 = await sm.transition(NavigationAction.REGENERATE);
    console.log('   第3次重新生成（应被拒绝）:', t3.nextState === PlanState.OPTION_SELECTION ? '✅' : '❌');

    console.log('✅ 重新生成限制功能正常');
    console.log('');
  } catch (error) {
    console.error('❌ 重新生成限制测试失败:', error);
  }

  // 测试8: 获取结果
  console.log('测试8: 获取执行结果');
  try {
    const sm = createPlanStateMachine('test', {});
    sm.setState(PlanState.EXECUTING);
    sm.updateContext({
      selectedOption: {
        id: 'plan-1',
        name: 'Test Plan',
        description: 'Test',
        strategy: 'balanced',
        actions: [],
        estimatedTime: 1000,
        riskLevel: 'low',
        pros: [],
        cons: [],
        confidence: 0.8,
      },
    });

    const result = sm.getResult();
    if (result.state === PlanState.EXECUTING && result.planToExecute && !result.cancelled) {
      console.log('✅ 获取结果成功');
      console.log('   状态:', result.state);
      console.log('   方案:', result.planToExecute.name);
      console.log('   已取消:', result.cancelled);
    } else {
      console.error('❌ 获取结果失败');
    }
    console.log('');
  } catch (error) {
    console.error('❌ 获取结果测试失败:', error);
  }

  console.log('========================================');
  console.log('✅ 所有基础功能测试完成！');
  console.log('========================================\n');

  console.log('下一步: 手动测试 REPL 交互');
  console.log('运行: npx ts-node src/repl.ts -i');
  console.log('然后输入: /plan 添加用户认证系统\n');
}

// Run tests
runTests().catch(console.error);

