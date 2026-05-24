// src/ui/permission-adapter.ts — Adapter for permission prompts in Ink mode
// ESM module, compiled by tsconfig.ui.json

import { uiStore } from './state';

export interface PermissionPromptOptions {
  action: string;
  details?: string;
  alwaysAllowOption?: boolean;
}

export interface PermissionPromptResult {
  approved: boolean;
  alwaysAllow?: boolean;
}

/**
 * Ink-native permission prompt adapter.
 * Use this in Ink mode instead of inquirer.prompt for permission confirmations.
 *
 * @example
 * ```ts
 * const result = await promptPermission({
 *   action: 'Write file',
 *   details: '/path/to/file.ts',
 *   alwaysAllowOption: true,
 * });
 *
 * if (result.approved) {
 *   if (result.alwaysAllow) {
 *     // Remember this permission
 *   }
 *   // Proceed with action
 * }
 * ```
 */
export async function promptPermission(
  options: PermissionPromptOptions
): Promise<PermissionPromptResult> {
  const result = await uiStore.requestPermission(
    options.action,
    options.details || ''
  );

  return result;
}

/**
 * Check if we're in Ink mode and should use the Ink adapter.
 * This can be used to conditionally use inquirer or Ink prompts.
 */
export function isInkMode(): boolean {
  return process.env.INK_MODE === 'true';
}

/**
 * Universal permission prompt that works in both Ink and console modes.
 *
 * @example
 * ```ts
 * import inquirer from 'inquirer';
 * import { universalPermissionPrompt } from './ui/permission-adapter';
 *
 * const result = await universalPermissionPrompt({
 *   action: 'Execute command',
 *   details: 'npm install',
 * }, inquirer);
 * ```
 */
export async function universalPermissionPrompt(
  options: PermissionPromptOptions,
  inquirerModule: any
): Promise<PermissionPromptResult> {
  if (isInkMode()) {
    // Use Ink native prompt
    return promptPermission(options);
  } else {
    // Fall back to inquirer
    const { alwaysAllow } = options.alwaysAllowOption
      ? await inquirerModule.prompt([
          {
            type: 'confirm',
            name: 'alwaysAllow',
            message: 'Always allow this type of action?',
            default: false,
          },
        ])
      : { alwaysAllow: false };

    const { approved } = await inquirerModule.prompt([
      {
        type: 'confirm',
        name: 'approved',
        message: `${options.action}? ${options.details || ''}`,
        default: true,
      },
    ]);

    return { approved, alwaysAllow };
  }
}
