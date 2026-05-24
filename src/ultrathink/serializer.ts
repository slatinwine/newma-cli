/**
 * Reasoning Serializer
 *
 * Serializes tracked reasoning data into human-readable formats:
 * - Markdown reports (with ASCII tree visualization)
 * - Performance analysis
 * - ReAct trace visualization
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ThoughtState } from './types';
import {
  TrackedSessionData,
  TrackedThought,
  TrackedPlan,
  TrackedReActStep,
  SessionSummary,
} from './tracker';

// ============================================================================
// SERIALIZER CLASS
// ============================================================================

export class ReasoningSerializer {
  private data: TrackedSessionData;
  private outputDir: string;

  constructor(data: TrackedSessionData, outputDir: string) {
    this.data = data;
    this.outputDir = outputDir;
  }

  // ---------------------------------------------------------------------------
  // MAIN EXPORT FUNCTION
  // ---------------------------------------------------------------------------

  /**
   * Export all reports (JSON + Markdown files)
   */
  async exportAll(): Promise<{
    json: string;
    summaryMd: string;
    thoughtTreeMd: string;
    plansMd: string;
    reactTraceMd: string;
    performanceMd: string;
  }> {
    await this.ensureOutputDir();

    const results = {
      json: await this.exportJSON(),
      summaryMd: await this.exportSummaryReport(),
      thoughtTreeMd: await this.exportThoughtTreeReport(),
      plansMd: await this.exportPlansReport(),
      reactTraceMd: await this.exportReActTraceReport(),
      performanceMd: await this.exportPerformanceReport(),
    };

    return results;
  }

  // ---------------------------------------------------------------------------
  // JSON EXPORT
  // ---------------------------------------------------------------------------

  /**
   * Export full data as JSON
   */
  async exportJSON(filename = 'reasoning-trace.json'): Promise<string> {
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(this.data, null, 2), 'utf-8');
    return filepath;
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------

  /**
   * Export session summary as Markdown
   */
  async exportSummaryReport(filename = 'SUMMARY.md'): Promise<string> {
    const filepath = path.join(this.outputDir, filename);
    const markdown = this.generateSummaryMarkdown();
    await fs.writeFile(filepath, markdown, 'utf-8');
    return filepath;
  }

  private generateSummaryMarkdown(): string {
    const summary = this.data.summary;
    const lines: string[] = [];

    lines.push('# 🎯 Ultrathink Reasoning Session Summary');
    lines.push('');
    lines.push(`**Session ID**: \`${summary.sessionId}\``);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📊 Overall Statistics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Duration | ${this.formatDuration(summary.totalDuration)} |`);
    lines.push(`| Total Events | ${summary.totalEvents} |`);
    lines.push(`| API Calls | ${summary.totalApiCalls} |`);
    lines.push('');
    lines.push('## 💰 Token Usage');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Tokens | ${summary.totalTokens.toLocaleString()} |`);
    lines.push(`| Cached Tokens | ${summary.cachedTokens.toLocaleString()} |`);
    lines.push(`| Tokens Saved | ${summary.tokensSaved.toLocaleString()} |`);
    lines.push(`| Savings | **${summary.savingsPercentage.toFixed(1)}%** |`);
    lines.push('');
    lines.push('## 🌳 Thought Tree Statistics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Thoughts Generated | ${summary.thoughtsGenerated} |`);
    lines.push(`| Thoughts Evaluated | ${summary.thoughtsEvaluated} |`);
    lines.push(`| Thoughts Pruned | ${summary.thoughtsPruned} |`);
    lines.push('');
    lines.push('## 📋 Plan Statistics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Plans Generated | ${summary.plansGenerated} |`);
    lines.push(`| Plans Evaluated | ${summary.plansEvaluated} |`);
    lines.push('');
    lines.push('## 🔄 ReAct Verification');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| ReAct Steps | ${summary.reactSteps} |`);
    lines.push('');
    lines.push('## ⏱️  Stage Breakdown');
    lines.push('');
    lines.push('| Stage | Duration | API Calls | Tokens |');
    lines.push('|-------|----------|-----------|--------|');

    for (const stage of this.data.stages) {
      lines.push(
        `| ${stage.stageName} | ${this.formatDuration(stage.duration)} | ` +
        `${stage.apiCalls} | ${stage.totalTokens.toLocaleString()} |`
      );
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Generated by Kode Ultrathink Reasoning Tracker*');

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // THOUGHT TREE REPORT
  // ---------------------------------------------------------------------------

  /**
   * Export thought tree visualization as Markdown
   */
  async exportThoughtTreeReport(filename = 'THOUGHT_TREE.md'): Promise<string> {
    const filepath = path.join(this.outputDir, filename);
    const markdown = this.generateThoughtTreeMarkdown();
    await fs.writeFile(filepath, markdown, 'utf-8');
    return filepath;
  }

  private generateThoughtTreeMarkdown(): string {
    const lines: string[] = [];

    lines.push('# 🌳 Thought Tree Visualization');
    lines.push('');
    lines.push(`**Session ID**: \`${this.data.sessionId}\``);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Tree Structure');
    lines.push('');
    lines.push('```');
    lines.push(this.generateASCIITree());
    lines.push('```');
    lines.push('');
    lines.push('## Legend');
    lines.push('');
    lines.push('- ✅ `SOLVED` - Thought leads to solution');
    lines.push('- 🔍 `EVALUATED` - Thought has been evaluated');
    lines.push('- 🌱 `SELECTED` - Thought selected for expansion');
    lines.push('- ✂️  `PRUNED` - Thought discarded during search');
    lines.push('- ❌ `FAILED` - Thought leads to dead end');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Thought Details');
    lines.push('');

    // Group thoughts by depth
    const thoughtsByDepth = new Map<number, TrackedThought[]>();
    for (const thought of this.data.thoughts) {
      const list = thoughtsByDepth.get(thought.depth) || [];
      list.push(thought);
      thoughtsByDepth.set(thought.depth, list);
    }

    // Display thoughts by depth
    for (const [depth, thoughts] of Array.from(thoughtsByDepth.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(`### Depth ${depth}`);
      lines.push('');

      for (const thought of thoughts) {
        lines.push(`#### Thought ${thought.id.substring(0, 8)}...`);
        lines.push('');
        lines.push(`**State**: ${this.getStateIcon(thought.state)} ${thought.state}`);
        lines.push('');
        lines.push(`**Content**:`);
        lines.push('```');
        lines.push(thought.content);
        lines.push('```');
        lines.push('');

        if (thought.score !== undefined) {
          lines.push(`**Score**: ${thought.score.toFixed(2)}`);
          lines.push('');
        }

        if (thought.evaluationHistory && thought.evaluationHistory.length > 0) {
          lines.push('**Evaluation History**:');
          lines.push('');
          for (const evaluation of thought.evaluationHistory) {
            lines.push(`- [${new Date(evaluation.timestamp).toISOString()}] ` +
                      `Score: ${evaluation.score.toFixed(2)} (${evaluation.method})`);
            if (evaluation.reasoning) {
              lines.push(`  Reasoning: ${evaluation.reasoning.substring(0, 100)}...`);
            }
          }
          lines.push('');
        }

        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate ASCII tree visualization
   */
  private generateASCIITree(): string {
    const roots = this.data.thoughts.filter(t => t.parentId === null);
    if (roots.length === 0) {
      return '(No thoughts generated)';
    }

    const lines: string[] = [];

    for (const root of roots) {
      this.renderThoughtNode(root, '', true, lines);
    }

    return lines.join('\n');
  }

  /**
   * Recursively render a thought node as ASCII tree
   */
  private renderThoughtNode(
    thought: TrackedThought,
    prefix: string,
    isLast: boolean,
    lines: string[]
  ): void {
    const connector = isLast ? '└──' : '├──';
    const icon = this.getStateIcon(thought.state);
    const score = thought.score !== undefined ? ` (${thought.score.toFixed(2)})` : '';

    lines.push(`${prefix}${connector} ${icon} Thought ${thought.id.substring(0, 6)}...${score}`);

    // Find children
    const children = this.data.thoughts.filter(t => t.parentId === thought.id);

    if (children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      children.sort((a, b) => (b.score || 0) - (a.score || 0)); // Sort by score

      for (let i = 0; i < children.length; i++) {
        this.renderThoughtNode(children[i], childPrefix, i === children.length - 1, lines);
      }
    }
  }

  private getStateIcon(state: ThoughtState): string {
    switch (state) {
      case ThoughtState.SOLVED:
        return '✅';
      case ThoughtState.EVALUATED:
        return '🔍';
      case ThoughtState.SELECTED:
        return '🌱';
      case ThoughtState.PRUNED:
        return '✂️';
      case ThoughtState.FAILED:
        return '❌';
      case ThoughtState.PENDING:
        return '⏳';
      case ThoughtState.EVALUATING:
        return '⚙️';
      case ThoughtState.EXPANDED:
        return '🌳';
      default:
        return '❓';
    }
  }

  // ---------------------------------------------------------------------------
  // PLANS REPORT
  // ---------------------------------------------------------------------------

  /**
   * Export plan comparison as Markdown
   */
  async exportPlansReport(filename = 'PLANS.md'): Promise<string> {
    const filepath = path.join(this.outputDir, filename);
    const markdown = this.generatePlansMarkdown();
    await fs.writeFile(filepath, markdown, 'utf-8');
    return filepath;
  }

  private generatePlansMarkdown(): string {
    const lines: string[] = [];

    lines.push('# 📋 Action Plans Comparison');
    lines.push('');
    lines.push(`**Session ID**: \`${this.data.sessionId}\``);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Sort plans by final score
    const sortedPlans = [...this.data.plans].sort((a, b) => {
      const scoreA = a.evaluationHistory?.[a.evaluationHistory.length - 1]?.score || 0;
      const scoreB = b.evaluationHistory?.[b.evaluationHistory.length - 1]?.score || 0;
      return scoreB - scoreA;
    });

    for (let i = 0; i < sortedPlans.length; i++) {
      const plan = sortedPlans[i];
      const finalScore = plan.evaluationHistory?.[plan.evaluationHistory.length - 1]?.score;
      const isWinner = i === 0;

      lines.push(`## ${isWinner ? '🏆 ' : ''}Plan ${i + 1}: ${plan.id.substring(0, 8)}...`);
      lines.push('');

      lines.push('| Attribute | Value |');
      lines.push('|-----------|-------|');
      lines.push(`| Rank | #${i + 1} of ${sortedPlans.length} |`);
      lines.push(`| Score | **${(finalScore || 0).toFixed(2)}** |`);
      lines.push(`| Confidence | ${plan.confidence.toFixed(2)} |`);
      lines.push(`| Risk Level | ${plan.riskLevel} |`);
      lines.push(`| Actions | ${plan.actions.length} |`);
      lines.push(`| Est. Time | ${plan.estimatedTime}ms |`);
      lines.push('');

      lines.push('**Reasoning**:');
      lines.push('```');
      lines.push(plan.reasoning);
      lines.push('```');
      lines.push('');

      lines.push('**Actions**:');
      lines.push('');
      for (let j = 0; j < plan.actions.length; j++) {
        const action = plan.actions[j];
        lines.push(`${j + 1}. **${action.type}**: ${action.path || action.command || '(no details)'}`);
      }
      lines.push('');

      if (plan.evaluationHistory && plan.evaluationHistory.length > 0) {
        lines.push('**Evaluation History**:');
        lines.push('');
        for (const evaluation of plan.evaluationHistory) {
          lines.push(`- **${evaluation.stage} evaluation**: ${evaluation.score.toFixed(2)}`);
          if (evaluation.reasoning) {
            lines.push(`  - ${evaluation.reasoning}`);
          }
        }
        lines.push('');
      }

      if (plan.rejectionReasons && plan.rejectionReasons.length > 0) {
        lines.push('**Rejection Reasons**:');
        lines.push('');
        for (const reason of plan.rejectionReasons) {
          lines.push(`- ${reason}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // REACT TRACE REPORT
  // ---------------------------------------------------------------------------

  /**
   * Export ReAct trace as Markdown
   */
  async exportReActTraceReport(filename = 'REACT_TRACE.md'): Promise<string> {
    const filepath = path.join(this.outputDir, filename);
    const markdown = this.generateReActTraceMarkdown();
    await fs.writeFile(filepath, markdown, 'utf-8');
    return filepath;
  }

  private generateReActTraceMarkdown(): string {
    const lines: string[] = [];

    lines.push('# 🔄 ReAct Verification Trace');
    lines.push('');
    lines.push(`**Session ID**: \`${this.data.sessionId}\``);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (this.data.reactTrace.length === 0) {
      lines.push('*No ReAct steps recorded*');
      return lines.join('\n');
    }

    for (const step of this.data.reactTrace) {
      lines.push(`## Step ${step.stepNumber}`);
      lines.push('');

      const statusIcon = step.success ? '✅' : '❌';
      lines.push(`**Status**: ${statusIcon} ${step.success ? 'Success' : 'Failed'}`);
      lines.push('');

      if (step.thought) {
        lines.push('### 💭 Thought');
        lines.push('');
        lines.push(step.thought);
        lines.push('');
      }

      if (step.action) {
        lines.push('### 🎬 Action');
        lines.push('');
        lines.push(`**Type**: ${step.action.type}`);
        if (step.action.path) {
          lines.push(`**Path**: ${step.action.path}`);
        }
        if (step.action.command) {
          lines.push(`**Command**: ${step.action.command}`);
        }
        lines.push('');
      }

      if (step.observation) {
        lines.push('### 👁️  Observation');
        lines.push('');
        lines.push('```');
        lines.push(step.observation.substring(0, 500));
        if (step.observation.length > 500) {
          lines.push('...');
        }
        lines.push('```');
        lines.push('');
      }

      if (step.executionTime !== undefined) {
        lines.push(`**Execution Time**: ${step.executionTime}ms`);
        lines.push('');
      }

      if (step.contextSize !== undefined) {
        lines.push(`**Context Size**: ${step.contextSize} tokens`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // PERFORMANCE REPORT
  // ---------------------------------------------------------------------------

  /**
   * Export performance analysis as Markdown
   */
  async exportPerformanceReport(filename = 'PERFORMANCE.md'): Promise<string> {
    const filepath = path.join(this.outputDir, filename);
    const markdown = this.generatePerformanceMarkdown();
    await fs.writeFile(filepath, markdown, 'utf-8');
    return filepath;
  }

  private generatePerformanceMarkdown(): string {
    const lines: string[] = [];

    lines.push('# ⚡ Performance Analysis');
    lines.push('');
    lines.push(`**Session ID**: \`${this.data.sessionId}\``);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📈 Stage-by-Stage Breakdown');
    lines.push('');

    for (const stage of this.data.stages) {
      lines.push(`### ${stage.stageName}`);
      lines.push('');
      lines.push('| Metric | Value |');
      lines.push('|--------|-------|');
      lines.push(`| Duration | ${this.formatDuration(stage.duration)} |`);
      lines.push(`| API Calls | ${stage.apiCalls} |`);
      lines.push(`| Total Tokens | ${stage.totalTokens.toLocaleString()} |`);
      lines.push(`| Cached Tokens | ${stage.cachedTokens.toLocaleString()} |`);
      lines.push('');
      lines.push('**Operations**:');
      lines.push('');
      lines.push(`- Thoughts Generated: ${stage.operations.thoughtsGenerated}`);
      lines.push(`- Thoughts Evaluated: ${stage.operations.thoughtsEvaluated}`);
      lines.push(`- Plans Generated: ${stage.operations.plansGenerated}`);
      lines.push(`- Plans Evaluated: ${stage.operations.plansEvaluated}`);
      lines.push(`- ReAct Steps: ${stage.operations.reactSteps}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('## 📊 API Call Details');
    lines.push('');
    lines.push('| Timestamp | Stage | Tokens | Latency | Cached | Function |');
    lines.push('|-----------|-------|--------|---------|--------|----------|');

    for (const call of this.data.apiCalls) {
      const timestamp = new Date(call.timestamp).toISOString().split('T')[1].substring(0, 12);
      lines.push(
        `| ${timestamp} | ${call.stage} | ${call.totalTokens} | ` +
        `${call.latency}ms | ${call.cached ? '✅' : '❌'} | ${call.metadata.function || 'N/A'} |`
      );
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🎯 Optimization Impact');
    lines.push('');

    const summary = this.data.summary;
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total API Calls | ${summary.totalApiCalls} |`);
    lines.push(`| Total Tokens Used | ${summary.totalTokens.toLocaleString()} |`);
    lines.push(`| Tokens Saved (Cache) | ${summary.tokensSaved.toLocaleString()} |`);
    lines.push(`| Cache Hit Rate | ${summary.savingsPercentage.toFixed(1)}% |`);
    lines.push('');
    lines.push('### Cost Savings');
    lines.push('');
    lines.push('Assuming GPT-4 pricing ($0.03/1K tokens):');
    lines.push('');
    lines.push(`- **Without Caching**: $${(summary.totalTokens * 0.03 / 1000).toFixed(2)}`);
    lines.push(`- **With Caching**: $${((summary.totalTokens - summary.tokensSaved) * 0.03 / 1000).toFixed(2)}`);
    lines.push(`- **Total Savings**: **$${(summary.tokensSaved * 0.03 / 1000).toFixed(2)}**`);
    lines.push('');

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // UTILITY FUNCTIONS
  // ---------------------------------------------------------------------------

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
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    const seconds = ms / 1000;
    if (seconds < 1) {
      return `${ms.toFixed(0)}ms`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else {
      const minutes = seconds / 60;
      return `${minutes.toFixed(1)}m`;
    }
  }
}
