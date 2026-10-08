/**
 * 交互式计划模式单元测试
 * 测试状态机核心逻辑
 */

import { PlanStateMachine, PlanState, NavigationAction } from '../src/plan-state-machine';

describe('PlanStateMachine', () => {
  it('should create state machine with correct initial state', () => {
    const sm = new PlanStateMachine(
      PlanState.ANALYZING,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

    expect(sm.getState()).toBe(PlanState.ANALYZING);
    expect(sm.getContext().requirement).toBe('test');
  });

  it('should transition from OPTION_SELECTION to PLAN_CONFIRMATION', async () => {
    const sm = new PlanStateMachine(
      PlanState.OPTION_SELECTION,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

    const transition = await sm.transition(NavigationAction.CONTINUE);

    expect(transition.nextState).toBe(PlanState.PLAN_CONFIRMATION);
    expect(transition.shouldExit).toBe(false);
  });

  it('should transition from OPTION_SELECTION to CANCELLED on EXIT', async () => {
    const sm = new PlanStateMachine(
      PlanState.OPTION_SELECTION,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

    const transition = await sm.transition(NavigationAction.EXIT);

    expect(transition.nextState).toBe(PlanState.CANCELLED);
    expect(transition.shouldExit).toBe(true);
  });

  it('should transition from PLAN_CONFIRMATION to EXECUTING on CONFIRM', async () => {
    const sm = new PlanStateMachine(
      PlanState.PLAN_CONFIRMATION,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

    const transition = await sm.transition(NavigationAction.CONFIRM);

    expect(transition.nextState).toBe(PlanState.EXECUTING);
    expect(transition.shouldExit).toBe(false);
  });

  it('should transition from PLAN_CONFIRMATION to OPTION_SELECTION on BACK', async () => {
    const sm = new PlanStateMachine(
      PlanState.PLAN_CONFIRMATION,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

    const transition = await sm.transition(NavigationAction.BACK);

    expect(transition.nextState).toBe(PlanState.OPTION_SELECTION);
    expect(transition.shouldExit).toBe(false);
  });

  it('should limit regeneration count', async () => {
    const sm = new PlanStateMachine(
      PlanState.OPTION_SELECTION,
      {
        requirement: 'test',
        projectInfo: {},
      },
      {
        allowRegenerate: true,
        maxRegenerations: 2,
      }
    );

    // First regenerate should work
    let transition = await sm.transition(NavigationAction.REGENERATE);
    expect(transition.nextState).toBe(PlanState.ANALYZING);

    // Set state back to OPTION_SELECTION
    sm.setState(PlanState.OPTION_SELECTION);

    // Second regenerate should work
    transition = await sm.transition(NavigationAction.REGENERATE);
    expect(transition.nextState).toBe(PlanState.ANALYZING);

    // Set state back to OPTION_SELECTION
    sm.setState(PlanState.OPTION_SELECTION);

    // Third regenerate should be blocked
    transition = await sm.transition(NavigationAction.REGENERATE);
    expect(transition.nextState).toBe(PlanState.OPTION_SELECTION);
  });

  it('should update context correctly', () => {
    const sm = new PlanStateMachine(
      PlanState.ANALYZING,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

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

    expect(sm.getContext().selectedOption).toBeDefined();
    expect(sm.getContext().selectedOption?.name).toBe('Test Plan');
  });

  it('should get correct result after execution', () => {
    const sm = new PlanStateMachine(
      PlanState.ANALYZING,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

    // Simulate successful planning
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

    sm.setState(PlanState.EXECUTING);

    const result = sm.getResult();

    expect(result.state).toBe(PlanState.EXECUTING);
    expect(result.planToExecute).toBeDefined();
    expect(result.cancelled).toBe(false);
  });

  it('should get cancelled result', () => {
    const sm = new PlanStateMachine(
      PlanState.ANALYZING,
      {
        requirement: 'test',
        projectInfo: {},
      }
    );

    sm.setState(PlanState.CANCELLED);

    const result = sm.getResult();

    expect(result.state).toBe(PlanState.CANCELLED);
    expect(result.planToExecute).toBeUndefined();
    expect(result.cancelled).toBe(true);
  });
});

console.log('\n✅ 所有单元测试设计完成！');
console.log('\n运行测试:');
console.log('  npm test -- test-interactive-planning.test.ts');
