// src/self-healing/manager.ts
/**
 * Self-healing manager
 * Orchestrates detection, diagnosis, tool generation, and repair
 */

import { IssueDetector } from './detector';
import { ToolGenerator } from './tool-generator';
import { RepairEngine } from './repair-engine';
import { SelfHealingConfig, DiagnosisResult, HealthCheckResult, IssuePattern, LearningRecord } from './types';
import { ExecutionTracker } from '../history';
import { RollbackManager } from '../rollback';
import { Verifier } from '../verifier';
import { Config } from '../config';
import { KodeError } from '../errors';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 * Self-healing manager
 * Main orchestrator for self-healing capabilities
 */
export class SelfHealingManager {
  private detector: IssueDetector;
  private toolGenerator: ToolGenerator;
  private repairEngine: RepairEngine;
  private config: SelfHealingConfig;
  private learningData: LearningRecord[] = [];
  private learningDataPath: string;

  constructor(
    tracker: ExecutionTracker,
    rollbackManager: RollbackManager,
    verifier: Verifier,
    config: Config,
    selfHealingConfig: Partial<SelfHealingConfig> = {}
  ) {
    // Initialize components
    this.detector = new IssueDetector();
    this.toolGenerator = new ToolGenerator('.kode/self-healing/tools');
    this.repairEngine = new RepairEngine(
      this.toolGenerator,
      rollbackManager,
      verifier,
      tracker
    );

    // Set default config
    this.config = {
      enabled: selfHealingConfig.enabled ?? false,  // Disabled by default
      autoRepair: selfHealingConfig.autoRepair ?? false,  // Requires manual confirmation
      autoToolCreation: selfHealingConfig.autoToolCreation ?? false,
      learningEnabled: selfHealingConfig.learningEnabled ?? true,
      maxAutoFixRisk: selfHealingConfig.maxAutoFixRisk ?? 'low',
      minConfidenceThreshold: selfHealingConfig.minConfidenceThreshold ?? 0.7,
      patternRetentionDays: selfHealingConfig.patternRetentionDays ?? 30,
    };

    // Learning data storage
    this.learningDataPath = path.join(process.cwd(), '.kode', 'self-healing', 'learning.json');
  }

  /**
   * Initialize the self-healing system
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log(chalk.gray('[SelfHealing] Self-healing disabled'));
      return;
    }

    try {
      // Create directories
      await fs.mkdir('.kode/self-healing/tools', { recursive: true });
      await fs.mkdir('.kode/self-healing/data', { recursive: true });

      // Initialize tool generator
      await this.toolGenerator.initialize();

      // Load learning data
      await this.loadLearningData();

      console.log(chalk.green('[SelfHealing] ✅ Self-healing system initialized'));
    } catch (error) {
      console.error(chalk.red('[SelfHealing] ❌ Initialization failed:'), error);
    }
  }

  /**
   * Process execution record for issue detection
   */
  async processExecution(record: import('../history').ExecutionRecord): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Add to detector for pattern analysis
    this.detector.addExecution(record);

    // Check for errors
    if (record.status !== 'success' && record.error) {
      const kodeError = this.parseError(record.error);
      if (kodeError) {
        this.detector.addError(kodeError, {
          action: record.action,
          command: record.action.type === 'run' ? record.action.command : undefined,
        });

        // Auto-diagnose and potentially repair
        if (this.config.autoRepair) {
          await this.autoDiagnoseAndRepair(record.error.toString());
        }
      }
    }

    // Periodically check for high-frequency patterns
    const patterns = this.detector.getHighFrequencyPatterns(3);
    if (patterns.length > 0) {
      console.log(chalk.yellow(`[SelfHealing] 🔍 Detected ${patterns.length} high-frequency patterns`));

      if (this.config.autoToolCreation) {
        await this.autoGenerateTools(patterns);
      }
    }

    // Save learning data periodically
    if (this.config.learningEnabled) {
      await this.saveLearningData();
    }
  }

  /**
   * Manually diagnose an issue
   */
  async diagnose(issue: string): Promise<DiagnosisResult> {
    if (!this.config.enabled) {
      throw new Error('Self-healing is not enabled');
    }

    console.log(chalk.cyan(`[SelfHealing] 🔍 Diagnosing: ${issue}`));
    const diagnosis = await this.detector.diagnoseIssue(issue);

    this.printDiagnosis(diagnosis);
    return diagnosis;
  }

  /**
   * Auto-diagnose and repair an error
   */
  private async autoDiagnoseAndRepair(errorMsg: string): Promise<void> {
    try {
      const diagnosis = await this.detector.diagnoseIssue(errorMsg);

      if (diagnosis.confidence < this.config.minConfidenceThreshold) {
        console.log(chalk.gray(`[SelfHealing] ⚠️  Low confidence (${diagnosis.confidence}), skipping auto-repair`));
        return;
      }

      if (!diagnosis.canAutoFix) {
        console.log(chalk.gray('[SelfHealing] ⚠️  Issue cannot be auto-fixed'));
        return;
      }

      console.log(chalk.cyan('[SelfHealing] 🔧 Attempting auto-repair...'));

      const result = await this.repairEngine.autoRepair(
        diagnosis,
        {} as Config,  // Would need proper config
        this.config.maxAutoFixRisk
      );

      if (result.success) {
        console.log(chalk.green('[SelfHealing] ✅ Auto-repair successful'));

        // Record learning data
        if (this.config.learningEnabled) {
          this.recordLearning(diagnosis, result);
        }
      } else {
        console.log(chalk.yellow('[SelfHealing] ⚠️  Auto-repair failed'));
      }
    } catch (error) {
      console.error(chalk.red('[SelfHealing] ❌ Auto-repair error:'), error);
    }
  }

  /**
   * Auto-generate tools from patterns
   */
  private async autoGenerateTools(patterns: IssuePattern[]): Promise<void> {
    for (const pattern of patterns) {
      if (pattern.suggestedTool) {
        continue;  // Already has suggested tool
      }

      try {
        const toolSpec = await this.toolGenerator.generateToolFromPattern(
          pattern,
          {} as Config,  // Would need proper config
          {
            projectInfo: await this.getProjectInfo(),
          }
        );

        if (toolSpec) {
          pattern.suggestedTool = toolSpec;
          console.log(chalk.green(`[SelfHealing] 🛠️  Generated tool: ${toolSpec.name}`));

          // Save tool
          await this.toolGenerator.saveAndLoadTool(toolSpec);
        }
      } catch (error) {
        console.error(chalk.red('[SelfHealing] ❌ Tool generation failed:'), error);
      }
    }
  }

  /**
   * Request tool creation from AI
   */
  async createTool(request: string, config: Config): Promise<boolean> {
    if (!this.config.enabled) {
      throw new Error('Self-healing is not enabled');
    }

    console.log(chalk.cyan(`[SelfHealing] 🛠️  Creating tool from request: ${request}`));

    try {
      const toolSpec = await this.toolGenerator.generateToolFromRequest(
        request,
        config,
        {
          projectInfo: await this.getProjectInfo(),
        }
      );

      if (!toolSpec) {
        console.log(chalk.yellow('[SelfHealing] ⚠️  Failed to generate tool spec'));
        return false;
      }

      const tool = await this.toolGenerator.saveAndLoadTool(toolSpec);
      if (!tool) {
        console.log(chalk.yellow('[SelfHealing] ⚠️  Failed to save tool'));
        return false;
      }

      console.log(chalk.green(`[SelfHealing] ✅ Tool created: ${toolSpec.name}`));
      return true;
    } catch (error) {
      console.error(chalk.red('[SelfHealing] ❌ Tool creation failed:'), error);
      return false;
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const checks = this.generateHealthChecks();
    const failedChecks = checks.filter(c => c.status === 'fail');
    const warnings = checks.filter(c => c.status === 'warn');

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks.length > 0) {
      overallHealth = 'unhealthy';
    } else if (warnings.length > 0) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'healthy';
    }

    const recommendations = this.generateRecommendations(checks);

    return {
      overallHealth,
      checks,
      recommendations,
    };
  }

  /**
   * Generate health check items
   */
  private generateHealthChecks(): Array<{
    category: any;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }> {
    const checks: any[] = [];

    // Check error frequency
    const patterns = this.detector.getPatterns();
    const criticalPatterns = patterns.filter(p => p.frequency >= 10);

    if (criticalPatterns.length > 0) {
      checks.push({
        category: 'tool_error',
        status: 'fail',
        message: `${criticalPatterns.length} critical error patterns detected`,
      });
    } else if (patterns.filter(p => p.frequency >= 5).length > 0) {
      checks.push({
        category: 'tool_error',
        status: 'warn',
        message: 'High-frequency error patterns detected',
      });
    } else {
      checks.push({
        category: 'tool_error',
        status: 'pass',
        message: 'No critical error patterns',
      });
    }

    // Check repair success rate
    const repairs = this.repairEngine.getRepairsHistory();
    if (repairs.length > 0) {
      const successRate = repairs.filter(r => r.success).length / repairs.length;
      if (successRate < 0.5) {
        checks.push({
          category: 'execution_error',
          status: 'fail',
          message: `Low repair success rate: ${(successRate * 100).toFixed(0)}%`,
        });
      } else if (successRate < 0.8) {
        checks.push({
          category: 'execution_error',
          status: 'warn',
          message: `Moderate repair success rate: ${(successRate * 100).toFixed(0)}%`,
        });
      } else {
        checks.push({
          category: 'execution_error',
          status: 'pass',
          message: `Good repair success rate: ${(successRate * 100).toFixed(0)}%`,
        });
      }
    }

    return checks;
  }

  /**
   * Generate recommendations based on health checks
   */
  private generateRecommendations(checks: any[]): string[] {
    const recommendations: string[] = [];

    for (const check of checks) {
      if (check.status === 'fail') {
        if (check.category === 'tool_error') {
          recommendations.push('Consider generating specialized tools to handle frequent errors');
        }
        if (check.category === 'performance') {
          recommendations.push('Review and optimize slow operations');
        }
      }
    }

    return recommendations;
  }

  /**
   * Print diagnosis to console
   */
  private printDiagnosis(diagnosis: DiagnosisResult): void {
    console.log(chalk.cyan('\n📊 Diagnosis Result:'));
    console.log(`  Issue: ${diagnosis.issue}`);
    console.log(`  Category: ${diagnosis.category}`);
    console.log(`  Severity: ${diagnosis.severity}`);
    console.log(`  Root Cause: ${diagnosis.rootCause}`);
    console.log(`  Confidence: ${(diagnosis.confidence * 100).toFixed(0)}%`);
    console.log(`  Can Auto-Fix: ${diagnosis.canAutoFix ? 'Yes' : 'No'}`);

    if (diagnosis.suggestedActions.length > 0) {
      console.log(chalk.yellow('\n💡 Suggested Actions:'));
      diagnosis.suggestedActions.forEach((action, idx) => {
        console.log(`  ${idx + 1}. [${action.type}] ${action.description}`);
        console.log(`     Priority: ${(action.priority * 100).toFixed(0)}%`);
        console.log(`     Risk: ${action.estimatedRisk}`);
      });
    }
  }

  /**
   * Parse error string to KodeError
   */
  private parseError(errorStr: string): KodeError | null {
    try {
      // Try to parse JSON error
      const parsed = JSON.parse(errorStr);
      if (parsed.code && parsed.message) {
        return new KodeError(parsed.message, parsed.code, parsed.retryable);
      }
    } catch {
      // Not JSON, create generic error
    }

    // Create error from string
    return new KodeError(errorStr, ErrorCode.EXECUTION_ERROR, false);
  }

  /**
   * Record learning data
   */
  private recordLearning(diagnosis: DiagnosisResult, result: any): void {
    const record: LearningRecord = {
      pattern: {
        id: `pattern_${Date.now()}`,
        category: diagnosis.category,
        pattern: diagnosis.issue,
        frequency: 1,
        lastOccurrence: new Date(),
      },
      fixApplied: diagnosis.suggestedActions[0] || { type: 'manual', description: 'Manual fix' },
      success: result.success,
      timestamp: new Date(),
      context: {
        projectState: 'unknown',
        command: 'unknown',
        environment: {},
      },
    };

    this.learningData.push(record);
  }

  /**
   * Load learning data from disk
   */
  private async loadLearningData(): Promise<void> {
    try {
      const data = await fs.readFile(this.learningDataPath, 'utf-8');
      this.learningData = JSON.parse(data);
    } catch {
      // File doesn't exist, start fresh
      this.learningData = [];
    }
  }

  /**
   * Save learning data to disk
   */
  private async saveLearningData(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.learningDataPath), { recursive: true });
      await fs.writeFile(this.learningDataPath, JSON.stringify(this.learningData, null, 2));
    } catch (error) {
      console.error(chalk.red('[SelfHealing] ❌ Failed to save learning data:'), error);
    }
  }

  /**
   * Get project info for AI context
   */
  private async getProjectInfo(): Promise<string> {
    try {
      const { scanDirectory } = await import('../scanner');
      const scanResult = await scanDirectory(process.cwd());
      return JSON.stringify(scanResult, null, 2);
    } catch {
      return '{}';
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    patternsDetected: number;
    toolsGenerated: number;
    repairsAttempted: number;
    repairsSuccessful: number;
  } {
    return {
      patternsDetected: this.detector.getPatterns().length,
      toolsGenerated: this.toolGenerator.getGeneratedTools().length,
      repairsAttempted: this.repairEngine.getRepairsHistory().length,
      repairsSuccessful: this.repairEngine.getSuccessfulRepairs().length,
    };
  }

  /**
   * Enable or disable self-healing
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(chalk[enabled ? 'green' : 'gray'](`[SelfHealing] ${enabled ? '✅ Enabled' : '⏸️  Disabled'}`));
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SelfHealingConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(chalk.cyan('[SelfHealing] ⚙️  Configuration updated'));
  }

  /**
   * Get current configuration
   */
  getConfig(): SelfHealingConfig {
    return { ...this.config };
  }
}

// Import ErrorCode for use
import { ErrorCode } from '../errors';
