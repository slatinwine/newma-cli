/**
 * Newma Runtime - 核心运行时
 *
 * 整合事件循环、执行器、状态机和 Agent，提供统一的运行时接口
 */

import { EventEmitter } from 'events';
import { CoreEvent, CoreEventType, AgentContext } from '../core/types';
import { EventLoop, createEventLoop, LoopContext } from '../core/event-loop';
import { ExecutorRegistry, createExecutorRegistry } from '../executors/registry';
import { ToolExecutor, createToolExecutor, ToolRegistry, createToolRegistry } from '../executors/tool-executor';
import { AIExecutor, createAIExecutor, AIClient } from '../executors/ai-executor';
import { StateMachine, createStateMachine, LoopPhase } from '../state';
// 🔥 暂时注释掉agents依赖,后续整合
// import { AgentRegistry, createAgentRegistry } from '../agents/registry';
// import { Agent, AgentDecision, AgentDecisionType } from '../agents/types';

// 🔥 临时类型定义(后续从agents/types导入)
enum AgentDecisionType {
  TOOL_CALLS = 'tool_calls',
  FINAL_RESPONSE = 'final_response',
  ERROR = 'error'
}

interface AgentDecision {
  type: AgentDecisionType;
  toolCalls?: any[];
  content?: string;
  reasoning?: string;
  events?: CoreEvent[];
  error?: Error;
}

// 🔥 临时AgentRegistry占位符(后续实现)
class AgentRegistryStub {
  async decide(): Promise<AgentDecision> {
    return { type: AgentDecisionType.FINAL_RESPONSE, content: 'Not implemented' };
  }
}

// ============================================================================
// 运行时配置
// ============================================================================

/**
 * Newma 运行时配置
 */
export interface NewmaRuntimeConfig {
  /** 项目根目录 */
  projectRoot: string;

  /** 工作目录 */
  workspaceDir?: string;

  /** AI 客户端 */
  aiClient?: AIClient;

  /** 工具注册表 */
  toolRegistry?: ToolRegistry;

  /** 最大迭代次数 */
  maxIterations?: number;

  /** 调试模式 */
  debug?: boolean;

  /** 额外配置 */
  extra?: Record<string, unknown>;
}

// ============================================================================
// 运行时状态
// ============================================================================

/**
 * 运行时状态
 */
export interface RuntimeState {
  /** 是否正在运行 */
  isRunning: boolean;

  /** 当前阶段 */
  phase: LoopPhase;

  /** 迭代次数 */
  iteration: number;

  /** 处理的事件数 */
  processedEvents: number;

  /** 开始时间 */
  startTime?: number;
}

// ============================================================================
// Newma 运行时
// ============================================================================

/**
 * Newma 运行时
 *
 * 整合所有核心模块，提供统一的接口
 */
export class NewmaRuntime {
  private eventLoop: EventLoop;
  private executorRegistry: ExecutorRegistry;
  private agentRegistry: any; // 🔥 临时使用any,后续改为AgentRegistry
  private stateMachine: StateMachine;
  private toolRegistry: ToolRegistry;
  private agentContext: AgentContext;
  private emitter = new EventEmitter();

  private state: RuntimeState = {
    isRunning: false,
    phase: LoopPhase.IDLE,
    iteration: 0,
    processedEvents: 0,
  };

  constructor(private config: NewmaRuntimeConfig) {
    // 创建 Agent 上下文
    this.agentContext = {
      projectRoot: config.projectRoot,
      config: config.extra || {},
    };

    // 创建状态机
    this.stateMachine = createStateMachine({
      maxIterations: config.maxIterations ?? 10,
    });

    // 创建执行器注册中心
    this.executorRegistry = createExecutorRegistry();

    // 创建工具注册表
    this.toolRegistry = config.toolRegistry ?? createToolRegistry();

    // 注册工具执行器
    this.executorRegistry.register(
      createToolExecutor({
        toolRegistry: this.toolRegistry,
      })
    );

    // 注册 AI 执行器（如果有客户端）
    if (config.aiClient) {
      this.executorRegistry.register(
        createAIExecutor({
          client: config.aiClient,
        })
      );
    }

    // 创建 Agent 注册中心
    // 🔥 暂时注释,后续整合agents模块
    // this.agentRegistry = createAgentRegistry();
    this.agentRegistry = new AgentRegistryStub();

    // 创建事件循环
    this.eventLoop = createEventLoop(this.agentContext, {
      debug: config.debug,
    });

    // 注册事件处理器
    this.setupEventHandlers();
  }

  // ============================================================================
  // 生命周期
  // ============================================================================

  /**
   * 启动运行时
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Runtime is already running');
    }

    this.state.isRunning = true;
    this.state.startTime = Date.now();

    // 启动事件循环
    this.eventLoop.start();

    this.emitter.emit('start');
  }

  /**
   * 停止运行时
   */
  async stop(): Promise<void> {
    if (!this.state.isRunning) return;

    this.state.isRunning = false;
    this.eventLoop.stop();

    this.emitter.emit('stop');
  }

  /**
   * 重置运行时
   */
  reset(): void {
    this.stateMachine.reset();
    this.state = {
      isRunning: false,
      phase: LoopPhase.IDLE,
      iteration: 0,
      processedEvents: 0,
    };
    this.emitter.emit('reset');
  }

  // ============================================================================
  // 交互
  // ============================================================================

  /**
   * 发送用户输入
   */
  async sendInput(input: string): Promise<void> {
    const event: CoreEvent = {
      type: CoreEventType.USER_INPUT,
      payload: { input },
      timestamp: Date.now(),
      id: `input-${Date.now()}`,
    };

    this.eventLoop.push(event);
  }

  /**
   * 启动任务
   */
  async startTask(requirement: string): Promise<void> {
    const event: CoreEvent = {
      type: CoreEventType.LOOP_START,
      payload: { requirement, maxIterations: this.config.maxIterations ?? 10 },
      timestamp: Date.now(),
      id: `task-${Date.now()}`,
    };

    this.eventLoop.push(event);
  }

  /**
   * 中断任务
   */
  abort(reason: string = 'user_abort'): void {
    this.eventLoop.abort();
  }

  /**
   * 发送 steering 消息
   */
  steer(message: string): void {
    const event: CoreEvent = {
      type: CoreEventType.STEER,
      payload: { message, priority: 'normal' },
      timestamp: Date.now(),
      id: `steer-${Date.now()}`,
    };
    this.eventLoop.steer(event);
  }

  // ============================================================================
  // 注册
  // ============================================================================

  /**
   * 注册工具
   */
  registerTool(tool: { name: string; description: string; parameters: any; execute: Function }): void {
    this.toolRegistry.set(tool.name, {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute as any,
    });
  }

  /**
   * 注册 Agent
   * 🔥 暂时注释,后续整合agents模块
   */
  // registerAgent(agent: Agent): () => void {
  //   return this.agentRegistry.register(agent);
  // }

  // ============================================================================
  // 状态查询
  // ============================================================================

  /**
   * 获取运行时状态
   */
  getState(): RuntimeState {
    return {
      ...this.state,
      phase: this.stateMachine.getCurrentPhase(),
      iteration: this.stateMachine.getIteration(),
    };
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * 获取事件循环
   */
  getEventLoop(): EventLoop {
    return this.eventLoop;
  }

  /**
   * 获取状态机
   */
  getStateMachine(): StateMachine {
    return this.stateMachine;
  }

  /**
   * 获取 Agent 注册中心
   */
  getAgentRegistry(): any { // 🔥 临时返回any,后续改为AgentRegistry
    return this.agentRegistry;
  }

  // ============================================================================
  // 事件订阅
  // ============================================================================

  /**
   * 订阅事件
   */
  on(event: string, listener: (...args: any[]) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  // ============================================================================
  // 内部方法
  // ============================================================================

  private setupEventHandlers(): void {
    // 处理用户输入
    this.eventLoop.on(CoreEventType.USER_INPUT, async (event: any, context) => {
      const decision = await this.agentRegistry.decide({
        ...this.agentContext,
        phase: this.stateMachine.getCurrentPhase(),
        iteration: this.stateMachine.getIteration(),
        eventHistory: [],
        userInput: event.payload.input,
      });

      return this.handleDecision(decision);
    });

    // 处理循环开始
    this.eventLoop.on(CoreEventType.LOOP_START, async (event: any, context) => {
      const transition = this.stateMachine.transition(event);

      if (transition.allowed) {
        this.emitter.emit('phase-change', transition.toState);

        // 启动 Agent 决策
        const decision = await this.agentRegistry.decide({
          ...this.agentContext,
          phase: this.stateMachine.getCurrentPhase(),
          iteration: 0,
          eventHistory: [],
          requirement: event.payload.requirement,
        });

        return this.handleDecision(decision);
      }

      return { success: false };
    });

    // 处理 AI 响应
    this.eventLoop.on(CoreEventType.AI_RESPONSE, async (event: any, context) => {
      const transition = this.stateMachine.transition(event);

      if (transition.allowed) {
        this.emitter.emit('phase-change', transition.toState);

        // 如果有工具调用，生成工具调用事件
        if (event.payload.toolCalls && event.payload.toolCalls.length > 0) {
          const toolCallEvents: CoreEvent[] = event.payload.toolCalls.map((tc: any) => ({
            type: CoreEventType.TOOL_CALL,
            payload: { toolCallId: tc.id, toolName: tc.name, args: tc.args },
            timestamp: Date.now(),
            id: `tool-${tc.id}`,
          }));

          return { success: true, nextEvents: toolCallEvents };
        }
      }

      return { success: true };
    });

    // 处理工具调用
    this.eventLoop.on(CoreEventType.TOOL_CALL, async (event, context) => {
      return this.executorRegistry.execute(event, {
        state: this.stateMachine.getCurrentPhase() as any,
        agentContext: this.agentContext,
        signal: context.signal,
      });
    });

    // 处理工具结果
    this.eventLoop.on(CoreEventType.TOOL_RESULT, async (event, context) => {
      const transition = this.stateMachine.transition(event);

      if (transition.allowed) {
        this.emitter.emit('phase-change', transition.toState);
      }

      return { success: true };
    });

    // 处理观测结束
    this.eventLoop.on(CoreEventType.OBSERVATION_END, async (event: any, context) => {
      const transition = this.stateMachine.transition(event);

      if (transition.allowed) {
        this.emitter.emit('phase-change', transition.toState);

        // 如果完成，发送结束事件
        if (event.payload.satisfied) {
          return {
            success: true,
            nextEvents: [
              {
                type: CoreEventType.LOOP_END,
                payload: {
                  completed: true,
                  iterations: this.stateMachine.getIteration(),
                  reason: 'completed',
                },
                timestamp: Date.now(),
                id: `end-${Date.now()}`,
              },
            ],
          };
        }
      }

      return { success: true };
    });

    // 处理循环结束
    this.eventLoop.on(CoreEventType.LOOP_END, async (event, context) => {
      this.state.isRunning = false;
      this.emitter.emit('complete', event.payload);
      return { success: true };
    });
  }

  private handleDecision(decision: AgentDecision): { success: boolean; nextEvents?: CoreEvent[]; error?: Error } {
    if (decision.type === AgentDecisionType.ERROR) {
      return {
        success: false,
        nextEvents: [],
        error: new Error(decision.reasoning),
      };
    }

    return {
      success: true,
      nextEvents: decision.events,
    };
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建 Newma 运行时
 */
export function createRuntime(config: NewmaRuntimeConfig): NewmaRuntime {
  return new NewmaRuntime(config);
}
