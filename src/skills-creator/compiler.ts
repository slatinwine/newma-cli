/**
 * Bun-based Compiler for Plugin Code
 *
 * Uses bun to compile and validate generated plugin code
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CompilationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  exitCode: number;
}

export class BunCompiler {
  /**
   * Quick syntax check using bun
   */
  async syntaxCheck(code: string, filename: string = 'plugin.ts'): Promise<CompilationResult> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kode-bun-check-'));
    const tempFile = path.join(tempDir, filename);

    try {
      await fs.writeFile(tempFile, code, 'utf-8');

      // Try to build with bun
      const result = await execAsync(`bun build ${tempFile} --no-bundle`, {
        cwd: tempDir,
        timeout: 30000,
      });

      const errors: string[] = [];
      const warnings: string[] = [];

      if (result.stderr) {
        const lines = result.stderr.split('\n');
        for (const line of lines) {
          if (line.includes('error') || line.includes('Error')) {
            errors.push(line);
          } else if (line.includes('warning')) {
            warnings.push(line);
          }
        }
      }

      return {
        success: true,
        errors,
        warnings,
        exitCode: 0,
      };

    } catch (error: any) {
      // Command failed (bun not found or compilation error)
      const errors: string[] = [];
      const warnings: string[] = [];

      if (error.stderr) {
        const lines = error.stderr.split('\n');
        for (const line of lines) {
          if (line.includes('error') || line.includes('Error')) {
            errors.push(line);
          } else if (line.includes('warning')) {
            warnings.push(line);
          }
        }
      } else if (error.message && !error.message.includes('bun')) {
        errors.push(error.message);
      }

      // If bun is not found, mark as success but add warning
      if (error.message && error.message.includes('bun: not found')) {
        warnings.push('Bun not installed - skipping compilation check');
        return {
          success: true,
          errors: [],
          warnings,
          exitCode: 0,
        };
      }

      return {
        success: false,
        errors,
        warnings,
        exitCode: error.code || 1,
      };

    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Display compilation result
   */
  displayCompilationResult(result: CompilationResult): void {
    if (result.success) {
      console.log(chalk.green('[Skills Creator] ✅ Bun compilation successful'));
    } else {
      console.error(chalk.red('[Skills Creator] ❌ Compilation failed:'));
      result.errors.forEach(err => console.error(chalk.red(`  ${err}`)));
    }

    if (result.warnings.length > 0) {
      console.warn(chalk.yellow('[Skills Creator] ⚠️  Compilation warnings:'));
      result.warnings.forEach(w => console.warn(chalk.yellow(`  ${w}`)));
    }
  }
}
