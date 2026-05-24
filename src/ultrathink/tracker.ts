/**
 * Reasoning Tracker
 *
 * Tracks all reasoning steps during ultrathink execution:
 * - Thought tree generation and evaluation
 * - Plan generation and comparison
 * - ReAct reasoning traces
 * - Performance metrics
 *
 * This data is later serialized to JSON + Markdown files for debugging and analysis.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ThoughtNode,
  ThoughtTree,
  ActionPlan,
  PlanAlternatives,
  ReActStep,
  ReActTrace,
  ThoughtState,
} from './types';

// ============================================================================
// TRACKED EVENTS
// ============================================================================

/**
 * Types of events that can be tracked
 */
export enum TrackedEventType {
  // Thought tree events
  THOUGHT_GENERATED = 'thought-generated',
  THOUGHT_EVALUATED = 'thought-evaluated',
  THOUGHT_PRUNED = 'thought-pruned',
  THOUGHT_SELECTED = 'thought-selected',

  // Plan events
  PLAN_GENERATED = 'plan-generated',
  PLAN_EVALUATED = 'plan-evaluated',
  PLAN_SELECTED = 'plan-selected',
  PLAN_REJECTED = 'plan-rejected',

  // ReAct events
  REACT_STEP = 'react-step',
  REACT_THINK = 'react-think',
  REACT_ACT = 'react-act',
  REACT_OBSERVE = 'react-observe',
  REACT_CORRECT = 'react-correct',

  // System events
  API_CALL = 'api-call',
  STAGE_START = 'stage-start',
  STAGE_COMPLETE = 'stage-complete',
}

/**
 * Base interface for all tracked events
 */
export interface TrackedEvent {
  type: TrackedEventType;
  timestamp: number;
  data: Record<string, any>;
}

// ============================================================================
// TRACKED DATA STRUCTURES
// ============================================================================

/**
 * Extended thought node with tracking info
 */
export interface TrackedThought extends ThoughtNode {
  evaluationHistory?: ThoughtEvaluation[]; // All evaluations of this thought
  generationTime?: number; // Time to generate (ms)
  evaluationTime?: number; // Time to evaluate (ms)
  parentScore?: number; // Score of parent thought (for analysis)
}

/**
 * Evaluation record for a thought
 */
export interface ThoughtEvaluation {
  timestamp: number;
  score: number;
  reasoning: string; // LLM's explanation
  method: 'llm' | 'heuristic' | 'value-function';
  batchSize?: number; // If evaluated in a batch
  batchIndex?: number; // Position in batch
}

/**
 * Extended action plan with tracking info
 */
export interface TrackedPlan extends ActionPlan {
  evaluationHistory?: PlanEvaluation[];
  generationTime?: number;
  evaluationTime?: number;
  rejectionReasons?: string[]; // Why this plan was rejected
}

/**
 * Evaluation record for a plan
 */
export interface PlanEvaluation {
  timestamp: number;
  score: number;
  reasoning: string;
  stage: 'quick' | 'detailed'; // Which evaluation stage
  comparedTo?: string[]; // Other plan IDs compared against
}

/**
 * Extended ReAct step with tracking info
 */
export interface TrackedReActStep extends ReActStep {
  thoughtTime?: number; // Time to generate thought (ms)
  actionTime?: number; // Time to execute action (ms)
  contextSize?: number; // Size of context sent to API (tokens)
  contextSummary?: string; // What context was included
}

/**
 * API call tracking
 */
export interface APICallRecord {
  timestamp: number;
  endpoint: string; // 'chat/completions' or similar
  stage: 'planning' | 'verification' | 'generation';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latency: number; // Time taken (ms)
  cached: boolean; // Whether response was from cache
  metadata: {
    model: string;
    function?: string; // Which function made the call
    thoughtId?: string; // Associated thought (if any)
    planId?: string; // Associated plan (if any)
    stepNumber?: number; // ReAct step number (if any)
  };
}

/**
 * Performance metrics for a stage
 */
export interface StageMetrics {
  stageName: string;
  startTime: number;
  endTime: number;
  duration: number; // ms
  apiCalls: number;
  totalTokens: number;
  cachedTokens: number; // Tokens saved by caching
  operations: {
    thoughtsGenerated: number;
    thoughtsEvaluated: number;
    plansGenerated: number;
    plansEvaluated: number;
    reactSteps: number;
  };
}

// ============================================================================
// REASONING TRACKER
// ============================================================================

/**
 * Main tracker class for ultrathink reasoning process
 */
export class ReasoningTracker {
  private events: TrackedEvent[] = [];
  private thoughts: Map<string, TrackedThought> = new Map();
  private plans: Map<string, TrackedPlan> = new Map();
  private reactTrace: TrackedReActStep[] = [];
  private apiCalls: APICallRecord[] = [];
  private stages: Map<string, StageMetrics> = new Map();

  private currentStage: string | null = null;
  private stageStartTime: number = 0;

  private sessionId: string;
  private outputDir: string;

  constructor(outputDir: string) {
    this.sessionId = this.generateSessionId();
    this.outputDir = outputDir;
  }

  // ---------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // ---------------------------------------------------------------------------

  private generateSessionId(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return `${date}-${time}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // ---------------------------------------------------------------------------
  // EVENT TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Track a generic event
   */
  trackEvent(type: TrackedEventType, data: Record<string, any>): void {
    const event: TrackedEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.events.push(event);
  }

  // ---------------------------------------------------------------------------
  // THOUGHT TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Track thought generation
   */
  trackThoughtGenerated(thought: ThoughtNode, generationTime: number): void {
    const trackedThought: TrackedThought = {
      ...thought,
      generationTime,
    };

    this.thoughts.set(thought.id, trackedThought);

    this.trackEvent(TrackedEventType.THOUGHT_GENERATED, {
      thoughtId: thought.id,
      depth: thought.depth,
      parentId: thought.parentId,
      generationTime,
    });
  }

  /**
   * Track thought evaluation
   */
  trackThoughtEvaluated(
    thoughtId: string,
    score: number,
    reasoning: string,
    method: 'llm' | 'heuristic' | 'value-function',
    evaluationTime: number,
    batchInfo?: { batchSize: number; batchIndex: number }
  ): void {
    const thought = this.thoughts.get(thoughtId);
    if (!thought) {
      throw new Error(`Thought ${thoughtId} not found in tracker`);
    }

    const evaluation: ThoughtEvaluation = {
      timestamp: Date.now(),
      score,
      reasoning,
      method,
      batchSize: batchInfo?.batchSize,
      batchIndex: batchInfo?.batchIndex,
    };

    if (!thought.evaluationHistory) {
      thought.evaluationHistory = [];
    }
    thought.evaluationHistory.push(evaluation);

    thought.score = score; // Update current score
    thought.state = ThoughtState.EVALUATED;
    thought.evaluationTime = evaluationTime;

    this.trackEvent(TrackedEventType.THOUGHT_EVALUATED, {
      thoughtId,
      score,
      method,
      evaluationTime,
      batchInfo,
    });
  }

  /**
   * Track thought pruning
   */
  trackThoughtPruned(thoughtId: string, reason: string): void {
    const thought = this.thoughts.get(thoughtId);
    if (thought) {
      thought.state = ThoughtState.PRUNED;
    }

    this.trackEvent(TrackedEventType.THOUGHT_PRUNED, {
      thoughtId,
      reason,
    });
  }

  /**
   * Track thought selection (for expansion)
   */
  trackThoughtSelected(thoughtId: string, reason: string): void {
    const thought = this.thoughts.get(thoughtId);
    if (thought) {
      thought.state = ThoughtState.SELECTED;
    }

    this.trackEvent(TrackedEventType.THOUGHT_SELECTED, {
      thoughtId,
      reason,
    });
  }

  // ---------------------------------------------------------------------------
  // PLAN TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Track plan generation
   */
  trackPlanGenerated(plan: ActionPlan, generationTime: number): void {
    const trackedPlan: TrackedPlan = {
      ...plan,
      generationTime,
    };

    this.plans.set(plan.id, trackedPlan);

    this.trackEvent(TrackedEventType.PLAN_GENERATED, {
      planId: plan.id,
      actionsCount: plan.actions.length,
      confidence: plan.confidence,
      riskLevel: plan.riskLevel,
      generationTime,
    });
  }

  /**
   * Track plan evaluation
   */
  trackPlanEvaluated(
    planId: string,
    score: number,
    reasoning: string,
    stage: 'quick' | 'detailed',
    evaluationTime: number,
    comparedTo?: string[]
  ): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found in tracker`);
    }

    const evaluation: PlanEvaluation = {
      timestamp: Date.now(),
      score,
      reasoning,
      stage,
      comparedTo,
    };

    if (!plan.evaluationHistory) {
      plan.evaluationHistory = [];
    }
    plan.evaluationHistory.push(evaluation);

    plan.evaluationTime = evaluationTime;

    this.trackEvent(TrackedEventType.PLAN_EVALUATED, {
      planId,
      score,
      stage,
      evaluationTime,
      comparedTo,
    });
  }

  /**
   * Track plan selection
   */
  trackPlanSelected(planId: string, reason: string): void {
    this.trackEvent(TrackedEventType.PLAN_SELECTED, {
      planId,
      reason,
    });
  }

  /**
   * Track plan rejection
   */
  trackPlanRejected(planId: string, reason: string): void {
    const plan = this.plans.get(planId);
    if (plan) {
      if (!plan.rejectionReasons) {
        plan.rejectionReasons = [];
      }
      plan.rejectionReasons.push(reason);
    }

    this.trackEvent(TrackedEventType.PLAN_REJECTED, {
      planId,
      reason,
    });
  }

  // ---------------------------------------------------------------------------
  // REACT TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Track a ReAct step
   */
  trackReActStep(step: TrackedReActStep): void {
    this.reactTrace.push(step);
    this.trackEvent(TrackedEventType.REACT_STEP, {
      stepNumber: step.stepNumber,
      success: step.success,
      thoughtTime: step.thoughtTime,
      actionTime: step.actionTime,
    });
  }

  /**
   * Track ReAct thinking
   */
  trackReActThink(
    stepNumber: number,
    thought: string,
    thoughtTime: number,
    contextSize: number
  ): void {
    this.trackEvent(TrackedEventType.REACT_THINK, {
      stepNumber,
      thought,
      thoughtTime,
      contextSize,
    });
  }

  /**
   * Track ReAct acting
   */
  trackReActAct(
    stepNumber: number,
    action: any,
    actionTime: number
  ): void {
    this.trackEvent(TrackedEventType.REACT_ACT, {
      stepNumber,
      action,
      actionTime,
    });
  }

  /**
   * Track ReAct observation
   */
  trackReActObserve(
    stepNumber: number,
    observation: string
  ): void {
    this.trackEvent(TrackedEventType.REACT_OBSERVE, {
      stepNumber,
      observation,
    });
  }

  /**
   * Track ReAct self-correction
   */
  trackReActCorrection(
    stepNumber: number,
    reason: string
  ): void {
    this.trackEvent(TrackedEventType.REACT_CORRECT, {
      stepNumber,
      reason,
    });
  }

  // ---------------------------------------------------------------------------
  // API CALL TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Track an API call
   */
  trackAPICall(call: APICallRecord): void {
    this.apiCalls.push(call);
    this.trackEvent(TrackedEventType.API_CALL, {
      endpoint: call.endpoint,
      stage: call.stage,
      totalTokens: call.totalTokens,
      latency: call.latency,
      cached: call.cached,
    });
  }

  // ---------------------------------------------------------------------------
  // STAGE TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Start tracking a stage
   */
  startStage(stageName: string): void {
    if (this.currentStage) {
      this.endStage(this.currentStage);
    }

    this.currentStage = stageName;
    this.stageStartTime = Date.now();

    this.trackEvent(TrackedEventType.STAGE_START, {
      stageName,
    });
  }

  /**
   * End tracking a stage
   */
  endStage(stageName: string): void {
    const endTime = Date.now();
    const duration = endTime - this.stageStartTime;

    // Calculate metrics for this stage
    const stageApiCalls = this.apiCalls.filter(
      call => call.timestamp >= this.stageStartTime && call.timestamp <= endTime
    );

    const metrics: StageMetrics = {
      stageName,
      startTime: this.stageStartTime,
      endTime,
      duration,
      apiCalls: stageApiCalls.length,
      totalTokens: stageApiCalls.reduce((sum, call) => sum + call.totalTokens, 0),
      cachedTokens: stageApiCalls.filter(c => c.cached).reduce((sum, call) => sum + call.totalTokens, 0),
      operations: {
        thoughtsGenerated: this.events.filter(e =>
          e.type === TrackedEventType.THOUGHT_GENERATED &&
          e.timestamp >= this.stageStartTime &&
          e.timestamp <= endTime
        ).length,
        thoughtsEvaluated: this.events.filter(e =>
          e.type === TrackedEventType.THOUGHT_EVALUATED &&
          e.timestamp >= this.stageStartTime &&
          e.timestamp <= endTime
        ).length,
        plansGenerated: this.events.filter(e =>
          e.type === TrackedEventType.PLAN_GENERATED &&
          e.timestamp >= this.stageStartTime &&
          e.timestamp <= endTime
        ).length,
        plansEvaluated: this.events.filter(e =>
          e.type === TrackedEventType.PLAN_EVALUATED &&
          e.timestamp >= this.stageStartTime &&
          e.timestamp <= endTime
        ).length,
        reactSteps: this.events.filter(e =>
          e.type === TrackedEventType.REACT_STEP &&
          e.timestamp >= this.stageStartTime &&
          e.timestamp <= endTime
        ).length,
      },
    };

    this.stages.set(stageName, metrics);

    this.trackEvent(TrackedEventType.STAGE_COMPLETE, {
      stageName,
      duration,
      apiCalls: metrics.apiCalls,
      totalTokens: metrics.totalTokens,
    });

    this.currentStage = null;
  }

  // ---------------------------------------------------------------------------
  // DATA EXPORT
  // ---------------------------------------------------------------------------

  /**
   * Get all tracked data as a structured object
   */
  getTrackedData(): TrackedSessionData {
    return {
      sessionId: this.sessionId,
      outputDir: this.outputDir,
      events: this.events,
      thoughts: Array.from(this.thoughts.values()),
      plans: Array.from(this.plans.values()),
      reactTrace: this.reactTrace,
      apiCalls: this.apiCalls,
      stages: Array.from(this.stages.values()),
      summary: this.generateSummary(),
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(): SessionSummary {
    const totalTokens = this.apiCalls.reduce((sum, call) => sum + call.totalTokens, 0);
    const cachedTokens = this.apiCalls.filter(c => c.cached).reduce((sum, call) => sum + call.totalTokens, 0);
    const totalDuration = Array.from(this.stages.values()).reduce((sum, stage) => sum + stage.duration, 0);

    return {
      sessionId: this.sessionId,
      startTime: this.events[0]?.timestamp || Date.now(),
      endTime: this.events[this.events.length - 1]?.timestamp || Date.now(),
      totalDuration,
      totalEvents: this.events.length,
      totalApiCalls: this.apiCalls.length,
      totalTokens,
      cachedTokens,
      tokensSaved: cachedTokens,
      savingsPercentage: totalTokens > 0 ? ((cachedTokens / totalTokens) * 100) : 0,
      thoughtsGenerated: this.thoughts.size,
      thoughtsEvaluated: Array.from(this.thoughts.values()).filter(t => t.evaluationHistory).length,
      thoughtsPruned: Array.from(this.thoughts.values()).filter(t => t.state === ThoughtState.PRUNED).length,
      plansGenerated: this.plans.size,
      plansEvaluated: Array.from(this.plans.values()).filter(p => p.evaluationHistory).length,
      reactSteps: this.reactTrace.length,
      stagesCompleted: this.stages.size,
    };
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create output directory: ${this.outputDir}`);
    }
  }

  /**
   * Save tracked data to JSON file
   */
  async saveToJSON(filename = 'reasoning-trace.json'): Promise<string> {
    await this.ensureOutputDir();

    const filepath = path.join(this.outputDir, filename);
    const data = this.getTrackedData();

    await fs.writeFile(
      filepath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    return filepath;
  }

  /**
   * Save tracked data to file (alias for saveToJSON)
   */
  async save(filename?: string): Promise<string> {
    return this.saveToJSON(filename);
  }
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Complete tracked session data
 */
export interface TrackedSessionData {
  sessionId: string;
  outputDir: string;
  events: TrackedEvent[];
  thoughts: TrackedThought[];
  plans: TrackedPlan[];
  reactTrace: TrackedReActStep[];
  apiCalls: APICallRecord[];
  stages: StageMetrics[];
  summary: SessionSummary;
}

/**
 * Session summary statistics
 */
export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime: number;
  totalDuration: number; // ms
  totalEvents: number;
  totalApiCalls: number;
  totalTokens: number;
  cachedTokens: number;
  tokensSaved: number;
  savingsPercentage: number;
  thoughtsGenerated: number;
  thoughtsEvaluated: number;
  thoughtsPruned: number;
  plansGenerated: number;
  plansEvaluated: number;
  reactSteps: number;
  stagesCompleted: number;
}
