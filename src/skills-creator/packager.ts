/**
 * Plugin Packager
 *
 * Packages generated plugins into distributable format
 */

import type { PluginGenerationResult, PackageResult, TestResult } from './types';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';

export class PluginPackager {
  /**
   * Package plugin files to directory
   */
  async package(
    generationResult: PluginGenerationResult,
    outputDir: string
  ): Promise<PackageResult> {
    const errors: string[] = [];
    const createdFiles: string[] = [];
    const output: string[] = [];

    try {
      output.push(chalk.cyan(`[Packager] Creating plugin in: ${outputDir}\n`));

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });
      output.push(chalk.gray(`  ✓ Created directory: ${outputDir}`));

      // Write all files
      for (const file of generationResult.files) {
        const filePath = path.join(outputDir, file.path);
        const dir = path.dirname(filePath);

        // Create directory if needed
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, file.content, 'utf-8');
        createdFiles.push(file.path);
        output.push(chalk.gray(`  ✓ Created: ${file.path}`));
      }

      output.push(chalk.green(`\n✅ Plugin packaged successfully!`));
      output.push(chalk.gray(`   Files created: ${createdFiles.length}`));

      return {
        directory: outputDir,
        files: createdFiles,
        success: errors.length === 0,
        output: output.join('\n'),
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const err = error as Error;
      errors.push(err.message);

      return {
        directory: outputDir,
        files: createdFiles,
        success: false,
        output: output.join('\n'),
        errors,
      };
    }
  }

  /**
   * Run tests for packaged plugin
   */
  async test(pluginDir: string): Promise<TestResult> {
    const testFile = path.join(pluginDir, 'plugin.test.ts');

    try {
      // Check if test file exists
      await fs.access(testFile);
    } catch {
      return {
        passed: false,
        tests: [],
      };
    }

    // Run tests using Bun
    return this.runBunTest(pluginDir);
  }

  /**
   * Run tests using Bun
   */
  private async runBunTest(pluginDir: string): Promise<TestResult> {
    return new Promise((resolve) => {
      const testProcess = spawn('bun', ['test'], {
        cwd: pluginDir,
        stdio: 'pipe',
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      testProcess.on('close', (code) => {
        const passed = code === 0;

        // Parse test results from output
        const tests = this.parseTestOutput(output);

        resolve({
          passed,
          tests,
        });
      });

      testProcess.on('error', (error) => {
        resolve({
          passed: false,
          tests: [{
            name: 'test-runner',
            passed: false,
            error: error.message,
          }],
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        testProcess.kill();
        resolve({
          passed: false,
          tests: [{
            name: 'test-timeout',
            passed: false,
            error: 'Tests timed out after 30 seconds',
          }],
        });
      }, 30000);
    });
  }

  /**
   * Parse test output
   */
  private parseTestOutput(output: string): Array<{
    name: string;
    passed: boolean;
    output?: string;
    error?: string;
  }> {
    const tests: Array<{
      name: string;
      passed: boolean;
      output?: string;
      error?: string;
    }> = [];

    // Parse Bun test output format
    const lines = output.split('\n');

    for (const line of lines) {
      // Match: ✓ test name or ✗ test name
      const match = line.match(/^([✓✗])\s+(.+)$/);
      if (match) {
        const passed = match[1] === '✓';
        const name = match[2].trim();
        tests.push({ name, passed });
      }
    }

    return tests;
  }

  /**
   * Initialize git repository
   */
  async initGit(pluginDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const gitProcess = spawn('git', ['init'], {
        cwd: pluginDir,
        stdio: 'pipe',
      });

      gitProcess.on('close', (code) => {
        resolve(code === 0);
      });

      gitProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Create initial commit
   */
  async initialCommit(pluginDir: string, message: string = 'Initial commit'): Promise<boolean> {
    return new Promise((resolve) => {
      const gitProcess = spawn('git', ['commit', '-m', message, '--allow-empty'], {
        cwd: pluginDir,
        stdio: 'pipe',
      });

      gitProcess.on('close', (code) => {
        resolve(code === 0);
      });

      gitProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Install dependencies
   */
  async installDependencies(pluginDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const npmProcess = spawn('npm', ['install'], {
        cwd: pluginDir,
        stdio: 'pipe',
      });

      npmProcess.on('close', (code) => {
        resolve(code === 0);
      });

      npmProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Build plugin
   */
  async build(pluginDir: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: pluginDir,
        stdio: 'pipe',
      });

      let output = '';
      let errorOutput = '';

      buildProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      buildProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      buildProcess.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output + errorOutput,
        });
      });

      buildProcess.on('error', (error) => {
        resolve({
          success: false,
          output: error.message,
        });
      });
    });
  }

  /**
   * Create plugin archive (tar.gz)
   */
  async createArchive(pluginDir: string, outputFile: string): Promise<boolean> {
    return new Promise((resolve) => {
      const tarProcess = spawn('tar', ['-czf', outputFile, '.'], {
        cwd: pluginDir,
        stdio: 'pipe',
      });

      tarProcess.on('close', (code) => {
        resolve(code === 0);
      });

      tarProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Validate plugin structure
   */
  async validate(pluginDir: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check required files
      const requiredFiles = ['plugin.ts', 'package.json'];

      for (const file of requiredFiles) {
        try {
          await fs.access(path.join(pluginDir, file));
        } catch {
          errors.push(`Missing required file: ${file}`);
        }
      }

      // Validate package.json
      try {
        const packagePath = path.join(pluginDir, 'package.json');
        const content = await fs.readFile(packagePath, 'utf-8');
        const pkg = JSON.parse(content);

        if (!pkg.kode?.id) {
          errors.push('package.json missing kode.id');
        }

        if (!pkg.kode?.entryPoint) {
          errors.push('package.json missing kode.entryPoint');
        }
      } catch (error) {
        errors.push('Invalid package.json');
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${(error as Error).message}`],
      };
    }
  }
}
