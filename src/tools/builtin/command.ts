// src/tools/builtin/command.ts
/**
 * Shell command tool
 * Handles command execution with safety checks
 */

import {
  Tool,
  ToolContext,
  ToolResult,
  ToolCategory,
  Permission,
  ToolParameter,
  ValidationResult,
} from '../types';
import { execFileSync } from 'child_process';
import path from 'path';
import { platform } from 'os';

/**
 * Platform type
 */
type Platform = 'win32' | 'darwin' | 'linux' | 'unknown';

/**
 * Get current platform
 */
function getPlatform(): Platform {
  const p = platform();
  if (p === 'win32' || p === 'darwin' || p === 'linux') {
    return p;
  }
  return 'unknown';
}

/**
 * Shell configuration for different platforms
 */
interface ShellConfig {
  shell: string;
  args: string[];
  dangerousCommands: string[];
  safeCommands: string[];
}

/**
 * Unix/Linux shell configuration
 */
const UNIX_SHELL: ShellConfig = {
  shell: 'sh',
  args: ['-c', '{command}'],
  dangerousCommands: [
    'rm -rf',
    'rm -r /',
    'mkfs',
    'fdisk',
    'chmod 777',
    'dd if=/',
    '> /dev/',
    'curl',
    'wget',
  ],
  safeCommands: [
    'npm ',
    'yarn ',
    'pnpm ',
    'git ',
    'node ',
    'tsc',
    'eslint',
    'prettier',
    'jest',
    'vitest',
    'pytest',
    'make',
    'cmake',
  ],
};

/**
 * Windows CMD configuration
 */
const WINDOWS_CMD_SHELL: ShellConfig = {
  shell: 'cmd.exe',
  args: ['/c', '{command}'],
  dangerousCommands: [
    'del /s /q',
    'rmdir /s /q',
    'format',
    'diskpart',
    'icacls ',
    'rd /s /q',
    'erase /s',
    '> NUL',
    'curl',
    'wget',
  ],
  safeCommands: [
    'npm ',
    'yarn ',
    'pnpm ',
    'git ',
    'node ',
    'tsc',
    'eslint',
    'prettier',
    'jest',
    'vitest',
    'pytest',
  ],
};

/**
 * Windows PowerShell configuration
 */
const WINDOWS_POWERSHELL_SHELL: ShellConfig = {
  shell: 'powershell.exe',
  args: ['-Command', '{command}'],
  dangerousCommands: [
    'Remove-Item -Recurse -Force',
    'Remove-Item -Path',
    'Format-Volume',
    'Set-ExecutionPolicy',
    'Invoke-Expression',
    'curl',
    'wget',
  ],
  safeCommands: [
    'npm ',
    'yarn ',
    'pnpm ',
    'git ',
    'node ',
    'tsc',
    'eslint',
    'prettier',
    'jest',
    'vitest',
    'pytest',
  ],
};

/**
 * Get shell configuration for current platform
 */
function getShellConfig(shellPreference?: 'cmd' | 'powershell' | 'auto'): ShellConfig {
  const currentPlatform = getPlatform();

  // Windows platform
  if (currentPlatform === 'win32') {
    // User explicitly chooses cmd
    if (shellPreference === 'cmd') {
      return WINDOWS_CMD_SHELL;
    }
    // User explicitly chooses powershell
    if (shellPreference === 'powershell') {
      return WINDOWS_POWERSHELL_SHELL;
    }
    // Auto: prefer PowerShell, fallback to cmd
    return WINDOWS_POWERSHELL_SHELL;
  }

  // Unix-like platforms (Linux, macOS)
  return UNIX_SHELL;
}

/**
 * Command tool implementation
 */
export const commandTool: Tool = {
  name: 'command',
  description: 'Execute shell commands with cross-platform support (Windows cmd/PowerShell, Unix sh/bash)',
  category: ToolCategory.COMMAND,
  permissions: [Permission.RUN_COMMANDS],
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'Shell command to execute',
      required: true,
    },
    {
      name: 'cwd',
      type: 'string',
      description: 'Working directory (defaults to project root)',
      required: false,
    },
    {
      name: 'shell',
      type: 'enum',
      description: 'Shell type (Windows only: cmd, powershell, or auto)',
      required: false,
      default: 'auto',
      values: ['auto', 'cmd', 'powershell'],
    },
  ],

  /**
   * Validate command parameters
   */
  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const command = params.command as string;

    if (!command || typeof command !== 'string') {
      errors.push('Command must be a non-empty string');
      return { valid: false, errors };
    }

    // Get shell configuration for current platform
    const shellPref = params.shell as 'cmd' | 'powershell' | 'auto' | undefined;
    const shellConfig = getShellConfig(shellPref);

    // Check for extremely dangerous commands
    for (const dangerous of shellConfig.dangerousCommands) {
      if (command.includes(dangerous)) {
        errors.push(`Command contains dangerous pattern: ${dangerous}`);
      }
    }

    // Warn about potentially unsafe commands
    const trimmed = command.trim();

    // Unix-specific: sudo
    if (getPlatform() !== 'win32' && trimmed.startsWith('sudo ')) {
      errors.push('Commands with sudo require explicit approval');
    }

    // Windows-specific: admin privileges
    if (getPlatform() === 'win32') {
      if (trimmed.includes(' -ExecutionPolicy ')) {
        errors.push('Commands changing execution policy require explicit approval');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Execute command
   */
  async handler(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { command, cwd, shell: shellPref } = params as {
      command: string;
      cwd?: string;
      shell?: 'cmd' | 'powershell' | 'auto';
    };

    const workingDir = cwd ? path.resolve(context.root, cwd) : context.root;

    // Get shell configuration
    const shellConfig = getShellConfig(shellPref);

    // Build command arguments
    const args = shellConfig.args.map(arg =>
      arg.replace('{command}', command)
    );

    try {
      const startTime = Date.now();

      // Execute command with platform-appropriate shell
      const output = execFileSync(shellConfig.shell, args, {
        cwd: workingDir,
        stdio: 'pipe',
        encoding: 'utf-8',
        shell: false, // We're already specifying the shell
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        output: `Command completed successfully in ${duration}ms\n${output}`,
        metadata: {
          command,
          duration,
          cwd: workingDir,
          shell: shellConfig.shell,
          platform: getPlatform(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Command failed: ${error.message}`,
        output: error.stderr || error.stdout,
        metadata: {
          command,
          cwd: workingDir,
          shell: shellConfig.shell,
          platform: getPlatform(),
        },
      };
    }
  },

  /**
   * Post-execution: record in history
   */
  async postExecute(result: ToolResult, context: ToolContext): Promise<void> {
    const action = {
      type: 'run' as const,
      command: result.metadata?.command as string,
    };

    context.history.recordExecution(
      action,
      result.success ? 'success' : 'failed',
      result.metadata?.duration as number || 0,
      result.error
    );
  },
};

/**
 * Check if a command is safe (auto-approvable)
 */
export function isSafeCommand(command: string, shellPref?: 'cmd' | 'powershell' | 'auto'): boolean {
  const trimmed = command.trim();
  const shellConfig = getShellConfig(shellPref);
  return shellConfig.safeCommands.some(safe => trimmed.startsWith(safe));
}

/**
 * Get risk level of a command
 */
export function getCommandRisk(command: string, shellPref?: 'cmd' | 'powershell' | 'auto'): 'low' | 'medium' | 'high' {
  const trimmed = command.trim();
  const shellConfig = getShellConfig(shellPref);

  // High risk
  for (const dangerous of shellConfig.dangerousCommands) {
    if (trimmed.includes(dangerous)) {
      return 'high';
    }
  }

  // Platform-specific high risk
  if (getPlatform() !== 'win32' && trimmed.startsWith('sudo ')) {
    return 'high';
  }

  if (getPlatform() === 'win32' && trimmed.includes(' -ExecutionPolicy ')) {
    return 'high';
  }

  // Low risk
  if (isSafeCommand(trimmed, shellPref)) {
    return 'low';
  }

  // Medium risk by default
  return 'medium';
}
