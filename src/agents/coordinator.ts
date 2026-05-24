// src/agents/coordinator.ts
/**
 * Agent Coordinator
 * Orchestrates multiple agents to complete complex tasks
 */

import {
  Agent,
  AgentTask,
  AgentContext,
  AgentResult,
  AgentCapability,
  CoordinationPlan,
  AgentMessage,
  AgentStatus,
  StreamingCallback,
  AgentExecutionOptions,
} from './types';
import { FrontendAgent } from './specialized/frontend';
import { BackendAgent } from './specialized/backend';
import { TestingAgent } from './specialized/testing';
import { DocumentationAgent } from './specialized/documentation';
import { ToolExecutor } from '../executor-v2';
import { ExecutionTracker } from '../history';
import { RollbackManager } from '../rollback';
import { Config } from '../config';
import { callAI } from '../ai';
import chalk from 'chalk';

/**
 * Agent coordinator class
 */
export class AgentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private toolExecutor: ToolExecutor;
  private tracker: ExecutionTracker;
  private rollbackManager: RollbackManager;
  private config: Config;
  private projectRoot: string;

  constructor(
    toolExecutor: ToolExecutor,
    tracker: ExecutionTracker,
    rollbackManager: RollbackManager,
    config: Config,
    projectRoot: string
  ) {
    this.toolExecutor = toolExecutor;
    this.tracker = tracker;
    this.rollbackManager = rollbackManager;
    this.config = config;
    this.projectRoot = projectRoot;

    // Initialize specialized agents
    this.initializeAgents();
  }

  /**
   * Initialize all available agents
   */
  private initializeAgents(): void {
    const frontendAgent = new FrontendAgent(this.toolExecutor, this.tracker);
    const backendAgent = new BackendAgent(this.toolExecutor, this.tracker);
    const testingAgent = new TestingAgent(this.toolExecutor, this.tracker);
    const documentationAgent = new DocumentationAgent(this.toolExecutor, this.tracker);

    this.registerAgent(frontendAgent);
    this.registerAgent(backendAgent);
    this.registerAgent(testingAgent);
    this.registerAgent(documentationAgent);
  }

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Plan task decomposition and agent assignment
   */
  async planDecomposition(userRequirement: string): Promise<CoordinationPlan> {
    console.log(chalk.cyan('\n🤖 Planning multi-agent strategy...'));

    // Call LLM to decompose the task
    const decompositionPrompt = `
You are a **Task Planning Agent**. Your job is to break down the user's requirement into smaller tasks that can be handled by specialized agents.

**AVAILABLE AGENTS:**
${this.listAgents()}

**USER REQUIREMENT:**
${userRequirement}

**OUTPUT FORMAT:**
Return a JSON object with:
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Specific task description",
      "capabilities": ["frontend" | "backend" | "database" | "testing" | etc.],
      "priority": "low" | "medium" | "high",
      "dependencies": ["task-id"] // IDs of tasks this depends on
    }
  ],
  "estimatedIterations": 3
}

**RULES:**
1. Break down complex requirements into logical steps
2. Assign appropriate capabilities to each task
3. Set up dependencies correctly (e.g., frontend depends on backend API)
4. Prioritize critical tasks
5. Keep tasks focused and achievable
`;

    try {
      const { scanDirectory } = await import('../scanner');
      const projectInfo = await scanDirectory(this.projectRoot);

      const response = await callAI(
        this.config,
        projectInfo,
        decompositionPrompt,
        'plan',
        this.tracker.getHistory()
      );

      // Parse LLM response for tasks
      const parsedResponse = this.parseDecompositionResponse(response);

      // Create full task objects
      const tasks: AgentTask[] = (parsedResponse.tasks || []).map((t: any) => ({
        id: t.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: t.description,
        capabilities: t.capabilities.map((c: string) => c as AgentCapability),
        priority: t.priority || 'medium',
        dependencies: t.dependencies || [],
        status: 'pending',
      }));

      // Calculate execution order based on dependencies
      const executionOrder = this.calculateExecutionOrder(tasks);

      return {
        tasks,
        taskGraph: this.buildTaskGraph(tasks),
        executionOrder,
        estimatedIterations: parsedResponse.estimatedIterations || 3,
      };
    } catch (error) {
      console.error(chalk.red('❌ Failed to decompose task:'), error);
      throw error;
    }
  }

  /**
   * Execute coordination plan
   */
  async executePlan(
    plan: CoordinationPlan,
    userRequirement: string,
    options?: AgentExecutionOptions
  ): Promise<AgentResult[]> {
    console.log(chalk.cyan(`\n🚀 Executing plan with ${plan.tasks.length} tasks\n`));

    const results: AgentResult[] = [];
    const context = this.createContext(userRequirement);
    const completedTasks = new Set<string>();

    // Execute tasks in dependency order
    for (const group of plan.executionOrder) {
      const groupResults = await Promise.all(
        group.map(async taskId => {
          const task = plan.tasks.find(t => t.id === taskId);
          if (!task) {
            throw new Error(`Task not found: ${taskId}`);
          }

          // Check if dependencies are met
          if (!this.areDependenciesMet(task, completedTasks)) {
            console.log(chalk.yellow(`⏳ Skipping ${task.id} - dependencies not met`));
            return null;
          }

          return await this.executeTask(task, context, options);
        })
      );

      // Collect results and mark tasks as completed
      for (const result of groupResults) {
        if (result) {
          results.push(result);
          completedTasks.add(result.taskId);

          // Update context with results
          context.sharedState.set(result.taskId, result);

          // Handle subtasks generated by agents
          if (result.nextTasks && result.nextTasks.length > 0) {
            console.log(chalk.cyan(`\n📋 Generated ${result.nextTasks.length} subtasks\n`));
            // Subtasks can be added to the plan or executed immediately
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: AgentTask,
    context: AgentContext,
    options?: AgentExecutionOptions
  ): Promise<AgentResult> {
    // Find best agent for this task
    const agent = this.selectAgent(task);

    if (!agent) {
      return {
        success: false,
        agentId: 'none',
        taskId: task.id,
        output: 'No suitable agent found',
        error: `No agent available for capabilities: ${task.capabilities.join(', ')}`,
      };
    }

    // Update task status
    task.status = 'in_progress';
    task.assignedTo = agent.id;

    console.log(chalk.blue(`\n[${agent.name}] Processing: ${task.description}`));

    try {
      const result = await agent.process(task, context, options);

      // Update task status based on result
      task.status = result.success ? 'completed' : 'failed';
      task.result = result;

      if (result.success) {
        console.log(chalk.green(`✅ [${agent.name}] Completed: ${task.description}`));
      } else {
        console.log(chalk.red(`❌ [${agent.name}] Failed: ${task.description}`));
        if (result.error) {
          console.log(chalk.red(`   Error: ${result.error}`));
        }
      }

      return result;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);

      console.error(chalk.red(`❌ [${agent.name}] Error: ${task.error}`));

      return {
        success: false,
        agentId: agent.id,
        taskId: task.id,
        output: 'Task execution failed',
        error: task.error,
      };
    }
  }

  /**
   * Select the best agent for a task
   */
  private selectAgent(task: AgentTask): Agent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.canHandle(task)) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Create agent context
   */
  private createContext(requirements: string): AgentContext {
    return {
      projectRoot: this.projectRoot,
      requirements,
      messages: [],
      sharedState: new Map(),
      config: this.config,
    };
  }

  /**
   * Calculate execution order based on dependencies
   */
  private calculateExecutionOrder(tasks: AgentTask[]): string[][] {
    const order: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(tasks.map(t => t.id));

    while (remaining.size > 0) {
      const currentGroup: string[] = [];

      for (const taskId of remaining) {
        const task = tasks.find(t => t.id === taskId)!;
        if (this.areDependenciesMet(task, completed)) {
          currentGroup.push(taskId);
        }
      }

      if (currentGroup.length === 0) {
        // Circular dependency - break by adding remaining tasks
        currentGroup.push(...Array.from(remaining));
      }

      order.push(currentGroup);
      currentGroup.forEach(id => {
        completed.add(id);
        remaining.delete(id);
      });
    }

    return order;
  }

  /**
   * Check if task dependencies are met
   */
  private areDependenciesMet(task: AgentTask, completed: Set<string>): boolean {
    return task.dependencies.every(dep => completed.has(dep));
  }

  /**
   * Build task dependency graph
   */
  private buildTaskGraph(tasks: AgentTask[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const task of tasks) {
      graph.set(task.id, task.dependencies);
    }

    return graph;
  }

  /**
   * List all available agents
   */
  private listAgents(): string {
    return Array.from(this.agents.values())
      .map(agent => {
        const caps = agent.capabilities.join(', ');
        return `- ${agent.name} (${caps}): ${agent.description}`;
      })
      .join('\n');
  }

  /**
   * Broadcast message to all agents
   */
  async broadcastMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    for (const agent of this.agents.values()) {
      await agent.handleMessage(fullMessage);
    }
  }

  /**
   * Parse LLM decomposition response
   * Extract tasks and estimated iterations from AI response
   */
  private parseDecompositionResponse(response: any): any {
    // Try to extract from actions if available
    if (response.actions && response.actions.length > 0) {
      // Check if first action has the data we need
      const firstAction = response.actions[0];
      if (firstAction.content) {
        try {
          const parsed = JSON.parse(firstAction.content);
          if (parsed.tasks) {
            return parsed;
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
    }

    // Try to parse from response directly
    // The LLM should return JSON with tasks array
    if (response.tasks) {
      return response;
    }

    // Return empty plan if no tasks found
    return {
      tasks: [],
      estimatedIterations: 3,
    };
  }
}
