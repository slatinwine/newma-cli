// src/verifier.ts
/**
 * Multi-stage verification system
 * Provides comprehensive verification of code changes
 */

import {
  VerificationStage,
  VerificationResult,
} from './tools/types';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { HookSystem, HookType } from './hooks';
import { Config } from './config';
import chalk from 'chalk';

/**
 * Verifier class
 */
export class Verifier {
  private stages: Map<string, VerificationStage> = new Map();
  private hookSystem?: HookSystem;
  private config?: Config;

  constructor(hookSystem?: HookSystem, config?: Config) {
    this.hookSystem = hookSystem;
    this.config = config;
  }

  /**
   * Add a verification stage
   */
  addStage(stage: VerificationStage): void {
    this.stages.set(stage.name, stage);
  }

  /**
   * Remove a verification stage
   */
  removeStage(name: string): void {
    this.stages.delete(name);
  }

  /**
   * Get list of registered stages
   */
  listStages(): { name: string; required: boolean }[] {
    return Array.from(this.stages.values()).map(s => ({
      name: s.name,
      required: s.required,
    }));
  }

  /**
   * Print verification summary
   */
  printSummary(): void {
    const stages = this.listStages();
    const required = stages.filter(s => s.required).length;
    const optional = stages.filter(s => !s.required).length;

    console.log('\n📋 Verification Stages:');
    console.log(`   Required: ${required} stage(s)`);
    console.log(`   Optional: ${optional} stage(s)`);
    console.log(`   Total: ${stages.length} stage(s)`);

    if (stages.length > 0) {
      console.log('\n   Stages:');
      stages.forEach((s, idx) => {
        const icon = s.required ? '⚠️ ' : '☐️ ';
        console.log(`   ${idx + 1}. ${icon}${s.name} ${s.required ? '(required)' : '(optional)'}`);
      });
    }
    console.log('');
  }

  /**
   * Run all verification stages
   */
  async verify(
    projectRoot: string,
    mode: 'fast' | 'full' = 'full'
  ): Promise<VerificationResult> {
    const results: VerificationResult[] = [];
    const requiredPassed: string[] = [];

    for (const [name, stage] of this.stages) {
      // Skip optional stages in fast mode
      if (mode === 'fast' && !stage.required) {
        continue;
      }

      console.log(`\n[VERIFY] Running: ${stage.name}...`);

      // Execute beforeVerification hooks
      if (this.hookSystem && this.hookSystem.hasHooks(HookType.BEFORE_VERIFICATION)) {
        await this.hookSystem.execute(HookType.BEFORE_VERIFICATION, {
          data: {
            stage: stage.name,
            projectRoot,
          },
          session: undefined as any, // TODO: Pass session if available
          config: this.config!,
        });
      }

      try {
        const startTime = Date.now();
        const result = await stage.check(projectRoot);
        const duration = Date.now() - startTime;

        // Execute afterVerification hooks
        if (this.hookSystem && this.hookSystem.hasHooks(HookType.AFTER_VERIFICATION)) {
          await this.hookSystem.execute(HookType.AFTER_VERIFICATION, {
            data: {
              stage: stage.name,
              projectRoot,
              result,
              duration,
            },
            session: undefined as any, // TODO: Pass session if available
            config: this.config!,
          });
        }

        results.push(result);

        if (result.passed) {
          console.log(chalk.green(`✓ ${stage.name}`) + chalk.gray(` - PASSED (${duration}ms)`));
        } else {
          console.log(chalk.red(`✗ ${stage.name}`) + chalk.gray(` - FAILED (${duration}ms)`));
          if (result.message) {
            console.log(chalk.gray(`  Reason: ${result.message}`));
          }
          if (result.details && result.details.length > 0) {
            console.log(chalk.gray(`  Details:`));
            result.details.forEach(detail =>
              console.log(chalk.yellow(`    → ${detail}`))
            );
          }
        }

        // Track required stages
        if (stage.required) {
          if (result.passed) {
            requiredPassed.push(name);
          } else {
            // Required stage failed - stop verification
            return {
              passed: false,
              message: `${stage.name} failed (required)`,
              details: result.details,
            };
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`[VERIFY] [ERROR] ${stage.name}: ${errorMsg}`);

        if (stage.required) {
          return {
            passed: false,
            message: `${stage.name} encountered an error (required)`,
            details: [errorMsg],
          };
        }
      }
    }

    const allPassed = results.every(r => r.passed);
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    const totalCount = results.length;

    // Print summary
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.cyan('Verification Summary'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(`Total Stages: ${totalCount}`);
    console.log(chalk.green(`Passed: ${passedCount}`));
    if (failedCount > 0) {
      console.log(chalk.red(`Failed: ${failedCount}`));
    }
    console.log(chalk.cyan('═'.repeat(60)));

    if (allPassed) {
      console.log(chalk.green('\n✅ All verifications passed!\n'));
    } else {
      console.log(chalk.yellow('\n⚠️  Some verifications failed (non-critical)\n'));
      console.log(chalk.gray('Fix the issues above and run verification again.\n'));
    }

    return {
      passed: allPassed,
      message: allPassed
        ? 'All verifications passed'
        : 'Some verifications failed (non-critical)',
      details: results.flatMap(r => r.details || []),
    };
  }
}

/**
 * Check if project has TypeScript
 */
export function hasTypeScript(root: string): boolean {
  const tsconfigPath = path.join(root, 'tsconfig.json');
  const pkgPath = path.join(root, 'package.json');

  if (fs.existsSync(tsconfigPath)) return true;

  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return !!(pkg.devDependencies?.typescript || pkg.dependencies?.typescript);
  }

  return false;
}

/**
 * Check if project has ESLint
 */
export function hasESLint(root: string): boolean {
  const configFiles = [
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    'eslint.config.js',
  ];

  for (const file of configFiles) {
    if (fs.existsSync(path.join(root, file))) {
      return true;
    }
  }

  const pkgPath = path.join(root, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return !!(pkg.devDependencies?.eslint || pkg.dependencies?.eslint);
  }

  return false;
}

/**
 * Check if project has tests
 */
export function hasTests(root: string): boolean {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return !!pkg.scripts?.test;
}

/**
 * Check if project has build script
 */
export function hasBuildScript(root: string): boolean {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return !!pkg.scripts?.build;
}

/**
 * Built-in verification stages
 */
export const BUILTIN_STAGES = {
  SYNTAX: {
    name: 'Syntax Check',
    required: true,
    check: async (root: string) => {
      if (!hasTypeScript(root)) {
        return {
          passed: true,
          message: 'No TypeScript to check',
        };
      }

      try {
        execFileSync('npx', ['tsc', '--noEmit'], {
          cwd: root,
          stdio: 'pipe',
        });
        return {
          passed: true,
          message: 'TypeScript compilation successful',
        };
      } catch (error: any) {
        const output = (error.stdout?.toString() || error.stderr?.toString() || '');
        const lines = output.split('\n').filter((l: string) => l.trim());
        return {
          passed: false,
          message: `TypeScript compilation failed (${lines.length} errors)`,
          details: lines.slice(0, 20), // Show more errors
        };
      }
    },
  } as VerificationStage,

  LINT: {
    name: 'Linting',
    required: false,
    check: async (root: string) => {
      if (!hasESLint(root)) {
        return {
          passed: true,
          message: 'No ESLint configuration',
        };
      }

      try {
        execFileSync('npx', ['eslint', '.', '--ext', '.js,.ts,.tsx', '--format', 'compact'], {
          cwd: root,
          stdio: 'pipe',
        });
        return {
          passed: true,
          message: 'No linting errors',
        };
      } catch (error: any) {
        const output = (error.stdout?.toString() || error.stderr?.toString() || '');
        const lines = output.split('\n').filter((l: string) => l.trim());
        return {
          passed: false,
          message: `Linting errors found (${lines.length} issues)`,
          details: lines.slice(0, 20),
        };
      }
    },
  } as VerificationStage,

  TESTS: {
    name: 'Test Suite',
    required: false,
    check: async (root: string) => {
      if (!hasTests(root)) {
        return {
          passed: true,
          message: 'No test script defined',
        };
      }

      try {
        execFileSync('npm', ['test', '--', '--', '--no-color'], {
          cwd: root,
          stdio: 'pipe',
          timeout: 60000,
        });
        return {
          passed: true,
          message: 'All tests passed',
        };
      } catch (error: any) {
        // Check if it's a timeout
        if (error.signal === 'SIGTERM' || error.killed) {
          return {
            passed: false,
            message: 'Tests timed out (60s limit)',
            details: ['Tests may be hanging or running too slowly'],
          };
        }

        const output = (error.stdout?.toString() || error.stderr?.toString() || '');
        const lines = output.split('\n').filter((l: string) => l.trim());

        return {
          passed: false,
          message: `Tests failed (${lines.length > 0 ? 'see details' : 'unknown error'})`,
          details: lines.slice(0, 30).length > 0 ? lines.slice(0, 30) : ['Run tests manually for details'],
        };
      }
    },
  } as VerificationStage,

  BUILD: {
    name: 'Build Check',
    required: true,
    check: async (root: string) => {
      if (!hasBuildScript(root)) {
        return {
          passed: true,
          message: 'No build script defined',
        };
      }

      try {
        execFileSync('npm', ['run', 'build'], {
          cwd: root,
          stdio: 'pipe',
          timeout: 120000,
        });
        return {
          passed: true,
          message: 'Build successful',
        };
      } catch (error: any) {
        // Check if it's a timeout
        if (error.signal === 'SIGTERM' || error.killed) {
          return {
            passed: false,
            message: 'Build timed out (120s limit)',
            details: ['Build may be hanging or running too slowly'],
          };
        }

        const output = (error.stdout?.toString() || error.stderr?.toString() || '');
        const lines = output.split('\n').filter((l: string) => l.trim());

        return {
          passed: false,
          message: `Build failed (${lines.length > 0 ? 'see details' : 'unknown error'})`,
          details: lines.slice(0, 30).length > 0 ? lines.slice(0, 30) : ['Run build manually for details'],
        };
      }
    },
  } as VerificationStage,
};

/**
 * Auto-detect and add appropriate verification stages
 */
export function autoDetectStages(verifier: Verifier, root: string): void {
  // TypeScript
  if (hasTypeScript(root)) {
    verifier.addStage(BUILTIN_STAGES.SYNTAX);
  }

  // ESLint
  if (hasESLint(root)) {
    verifier.addStage(BUILTIN_STAGES.LINT);
  }

  // Tests
  if (hasTests(root)) {
    verifier.addStage(BUILTIN_STAGES.TESTS);
  }

  // Build
  if (hasBuildScript(root)) {
    verifier.addStage(BUILTIN_STAGES.BUILD);
  }
}
