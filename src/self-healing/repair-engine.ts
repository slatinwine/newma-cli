// src/self-healing/repair-engine.ts
/**
 * Self-repair engine
 * Automatically fixes issues and applies repairs
 */

import { SuggestedAction, RepairResult, CodeChange, DiagnosisResult } from './types';
import { ToolGenerator } from './tool-generator';
import { ToolRegistry } from '../tools/registry';
import { RollbackManager } from '../rollback';
import { Verifier } from '../verifier';
import { ExecutionTracker } from '../history';
import { Config } from '../config';
import { execFileNoThrow } from '../utils/execFileNoThrow';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 * Repair engine class
 * Executes suggested fixes and verifies repairs
 */
export class RepairEngine {
  private toolGenerator: ToolGenerator;
  private rollbackManager: RollbackManager;
  private verifier: Verifier;
  private tracker: ExecutionTracker;
  private repairsHistory: RepairResult[] = [];
  /** 最近一次 pre-repair checkpoint 的 commit hash（回滚时使用） */
  private lastCheckpointHash: string | null = null;

  constructor(
    toolGenerator: ToolGenerator,
    rollbackManager: RollbackManager,
    verifier: Verifier,
    tracker: ExecutionTracker
  ) {
    this.toolGenerator = toolGenerator;
    this.rollbackManager = rollbackManager;
    this.verifier = verifier;
    this.tracker = tracker;
  }

  /**
   * Execute a suggested action
   */
  async executeAction(
    action: SuggestedAction,
    config: Config,
    autoConfirm: boolean = false
  ): Promise<RepairResult> {
    console.log(chalk.cyan(`[RepairEngine] 🔧 Executing action: ${action.type}`));

    // Create rollback checkpoint before making changes
    if (action.type === 'modify_code' || action.type === 'create_tool') {
      try {
        this.lastCheckpointHash = await this.rollbackManager.createRestorePoint('pre-repair');
      } catch (error) {
        console.error(chalk.yellow('[RepairEngine] ⚠️  Could not create checkpoint'));
      }
    }

    const actionsTaken: string[] = [];
    const issuesResolved: string[] = [];
    const newIssues: string[] = [];

    try {
      switch (action.type) {
        case 'create_tool':
          const toolResult = await this.executeCreateTool(action, config);
          actionsTaken.push(...toolResult.actions);
          if (toolResult.success) {
            issuesResolved.push('Created specialized tool');
          }
          break;

        case 'modify_code':
          const codeResult = await this.executeModifyCode(action);
          actionsTaken.push(...codeResult.actions);
          if (codeResult.success) {
            issuesResolved.push('Applied code modifications');
          }
          break;

        case 'run_command':
          const cmdResult = await this.executeRunCommand(action);
          actionsTaken.push(...cmdResult.actions);
          if (cmdResult.success) {
            issuesResolved.push('Executed repair command');
          }
          break;

        case 'change_config':
          const configResult = await this.executeChangeConfig(action);
          actionsTaken.push(...configResult.actions);
          if (configResult.success) {
            issuesResolved.push('Updated configuration');
          }
          break;

        case 'manual':
          actionsTaken.push(`Manual intervention required: ${action.description}`);
          break;
      }

      // Verify the repair
      const verificationPassed = await this.verifyRepair();

      const result: RepairResult = {
        success: issuesResolved.length > 0 || action.type === 'manual',
        actionsTaken,
        issuesResolved,
        newIssues,
        verificationPassed,
        rollbackAvailable: true,
      };

      this.repairsHistory.push(result);
      return result;
    } catch (error: any) {
      console.error(chalk.red('[RepairEngine] ❌ Repair failed:'), error.message);

      // Rollback if a checkpoint hash was captured earlier
      if (this.lastCheckpointHash) {
        try {
          await this.rollbackManager.rollback(this.lastCheckpointHash);
          console.log(chalk.yellow('[RepairEngine] ↩️  Rolled back changes'));
        } catch (rollbackError) {
          console.error(chalk.red('[RepairEngine] ❌ Rollback failed:'), rollbackError);
        }
      }

      return {
        success: false,
        actionsTaken,
        issuesResolved,
        newIssues: [error.message],
        verificationPassed: false,
        rollbackAvailable: false,
      };
    }
  }

  /**
   * Execute create_tool action
   */
  private async executeCreateTool(
    action: SuggestedAction,
    config: Config
  ): Promise<{ success: boolean; actions: string[] }> {
    const actions: string[] = [];

    if (!action.toolSpec) {
      return { success: false, actions: ['No tool specification provided'] };
    }

    try {
      // Validate tool spec
      const validation = this.toolGenerator.validateToolSpec(action.toolSpec);
      if (!validation.valid) {
        return {
          success: false,
          actions: [`Tool validation failed: ${validation.errors.join(', ')}`]
        };
      }

      // Save and load the tool
      const tool = await this.toolGenerator.saveAndLoadTool(action.toolSpec);
      if (!tool) {
        return { success: false, actions: ['Failed to save tool to file'] };
      }

      actions.push(`Created tool: ${action.toolSpec.name}`);
      actions.push(`Tool saved to: .kode/self-healing/tools/${action.toolSpec.name}.ts`);

      return { success: true, actions };
    } catch (error: any) {
      return { success: false, actions: [`Tool creation failed: ${error.message}`] };
    }
  }

  /**
   * Execute modify_code action
   */
  private async executeModifyCode(
    action: SuggestedAction
  ): Promise<{ success: boolean; actions: string[] }> {
    const actions: string[] = [];

    if (!action.codeChanges || action.codeChanges.length === 0) {
      return { success: false, actions: ['No code changes provided'] };
    }

    try {
      for (const change of action.codeChanges!) {
        const filePath = change.filePath;

        // Create backup
        try {
          await fs.copyFile(filePath, `${filePath}.backup`, fs.constants.COPYFILE_EXCL);
          actions.push(`Backed up: ${filePath}`);
        } catch (backupError) {
          // Backup might already exist or file might not exist
        }

        // Apply change
        switch (change.operation) {
          case 'create':
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, change.content, 'utf-8');
            actions.push(`Created file: ${filePath}`);
            break;

          case 'modify':
            await fs.writeFile(filePath, change.content, 'utf-8');
            actions.push(`Modified file: ${filePath}`);
            break;

          case 'delete':
            await fs.unlink(filePath);
            actions.push(`Deleted file: ${filePath}`);
            break;
        }
      }

      return { success: true, actions };
    } catch (error: any) {
      return { success: false, actions: [`Code modification failed: ${error.message}`] };
    }
  }

  /**
   * Execute run_command action
   * Uses execFileNoThrow for safe command execution
   */
  private async executeRunCommand(
    action: SuggestedAction
  ): Promise<{ success: boolean; actions: string[] }> {
    const actions: string[] = [];

    // Extract command from description
    const commandMatch = action.description.match(/`([^`]+)`/);
    const commandStr = commandMatch ? commandMatch[1] : action.description;

    // Parse command into file and args
    const parts = commandStr.split(' ');
    const file = parts[0];
    const args = parts.slice(1);

    try {
      const result = await execFileNoThrow(file, args);

      actions.push(`Executed: ${commandStr}`);

      if (result.stdout.trim()) {
        actions.push(`Output: ${result.stdout.trim()}`);
      }

      if (result.error) {
        actions.push(`Error: ${result.stderr || result.error.message}`);
        return { success: false, actions };
      }

      return { success: true, actions };
    } catch (error: any) {
      return {
        success: false,
        actions: [`Command failed: ${error.message}`]
      };
    }
  }

  /**
   * Execute change_config action
   */
  private async executeChangeConfig(
    action: SuggestedAction
  ): Promise<{ success: boolean; actions: string[] }> {
    const actions: string[] = [];

    // This would need to be implemented based on your config system
    actions.push(`Config change requested: ${action.description}`);
    actions.push('(Config modification not yet implemented)');

    return { success: true, actions };
  }

  /**
   * Verify that a repair was successful
   */
  private async verifyRepair(): Promise<boolean> {
    try {
      // Run verification stages
      const result = await this.verifier.verify(process.cwd(), 'fast');

      if (!result.passed) {
        console.log(chalk.yellow('[RepairEngine] ⚠️  Verification failed'));
        return false;
      }

      console.log(chalk.green('[RepairEngine] ✅ Verification passed'));
      return true;
    } catch (error) {
      console.error(chalk.red('[RepairEngine] ❌ Verification error:'), error);
      return false;
    }
  }

  /**
   * Attempt to automatically repair diagnosed issues
   */
  async autoRepair(
    diagnosis: DiagnosisResult,
    config: Config,
    maxRisk: 'low' | 'medium' | 'high' = 'low'
  ): Promise<RepairResult> {
    console.log(chalk.cyan('[RepairEngine] 🔧 Attempting automatic repair...'));

    // Filter actions by risk level
    const eligibleActions = diagnosis.suggestedActions.filter(
      action => this.isRiskAcceptable(action.estimatedRisk, maxRisk)
    );

    if (eligibleActions.length === 0) {
      console.log(chalk.yellow('[RepairEngine] ⚠️  No auto-repairable actions found'));
      return {
        success: false,
        actionsTaken: [],
        issuesResolved: [],
        newIssues: [],
        verificationPassed: false,
        rollbackAvailable: false,
      };
    }

    // Execute actions in priority order
    eligibleActions.sort((a, b) => b.priority - a.priority);

    let lastResult: RepairResult = {
      success: false,
      actionsTaken: [],
      issuesResolved: [],
      newIssues: [],
      verificationPassed: false,
      rollbackAvailable: false,
    };

    for (const action of eligibleActions) {
      if (!action.requiresConfirmation) {
        lastResult = await this.executeAction(action, config, true);
      }
    }

    return lastResult;
  }

  /**
   * Check if risk level is acceptable
   */
  private isRiskAcceptable(
    actionRisk: 'low' | 'medium' | 'high',
    maxRisk: 'low' | 'medium' | 'high'
  ): boolean {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    return riskLevels[actionRisk] <= riskLevels[maxRisk];
  }

  /**
   * Get repair history
   */
  getRepairsHistory(): RepairResult[] {
    return this.repairsHistory;
  }

  /**
   * Get successful repairs
   */
  getSuccessfulRepairs(): RepairResult[] {
    return this.repairsHistory.filter(r => r.success);
  }

  /**
   * Get failed repairs
   */
  getFailedRepairs(): RepairResult[] {
    return this.repairsHistory.filter(r => !r.success);
  }
}
