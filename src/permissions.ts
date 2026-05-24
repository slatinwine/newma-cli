// src/permissions.ts
/**
 * Permission management system
 * Provides user control over dangerous operations
 */

import inquirer from 'inquirer';
import { Permission } from './tools/types';
import { Action } from './types';

/**
 * Permission levels with presets
 */
export enum PermissionLevel {
  READ_ONLY = 'read_only',
  SAFE = 'safe',
  STANDARD = 'standard',
  DANGEROUS = 'dangerous',
}

/**
 * Permission presets
 */
export const PERMISSION_PRESETS: Record<PermissionLevel, Permission[]> = {
  [PermissionLevel.READ_ONLY]: [],
  [PermissionLevel.SAFE]: [Permission.READ_FILES, Permission.WRITE_FILES],
  [PermissionLevel.STANDARD]: [
    Permission.READ_FILES,
    Permission.WRITE_FILES,
    Permission.RUN_COMMANDS,
  ],
  [PermissionLevel.DANGEROUS]: [
    Permission.READ_FILES,
    Permission.WRITE_FILES,
    Permission.DELETE_FILES,
    Permission.RUN_COMMANDS,
    Permission.MODIFY_GIT,
    Permission.NETWORK_ACCESS,
  ],
};

/**
 * Permission manager class
 */
export class PermissionManager {
  private granted: Set<Permission> = new Set();
  private alwaysAllow: Set<Permission> = new Set();
  private initialLevel: PermissionLevel;

  constructor(initialLevel: PermissionLevel = PermissionLevel.SAFE) {
    this.initialLevel = initialLevel;
    this.granted = new Set(PERMISSION_PRESETS[initialLevel]);
  }

  /**
   * Request permissions from user
   */
  async requestPermissions(
    required: Permission[],
    context: {
      action: Action;
      riskLevel: 'low' | 'medium' | 'high';
      description: string;
    }
  ): Promise<boolean> {
    // Check if all permissions already granted
    const missing = required.filter(p => !this.granted.has(p));
    if (missing.length === 0) {
      return true;
    }

    // Build permission prompt
    const riskEmoji = {
      low: '[LOW RISK]',
      medium: '[MEDIUM RISK]',
      high: '[HIGH RISK]',
    };

    console.log(`\n${riskEmoji[context.riskLevel]} Permission Request`);
    console.log(`Action: ${context.description}`);
    console.log(`Permissions needed: ${missing.join(', ')}`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Grant permission?',
        default: false,
      },
    ]);

    if (!confirm) {
      return false;
    }

    // Grant permissions
    missing.forEach(p => this.grant(p));

    // Ask if user wants to always allow
    const { always } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'always',
        message: 'Always allow these permissions for the rest of the session?',
        default: false,
      },
    ]);

    if (always) {
      missing.forEach(p => this.alwaysAllow.add(p));
    }

    return true;
  }

  /**
   * Grant a permission
   */
  grant(permission: Permission): void {
    this.granted.add(permission);
  }

  /**
   * Revoke a permission
   */
  revoke(permission: Permission): void {
    this.granted.delete(permission);
    this.alwaysAllow.delete(permission);
  }

  /**
   * Check if permission is granted
   */
  has(permission: Permission): boolean {
    return this.granted.has(permission);
  }

  /**
   * Get all granted permissions
   */
  getGranted(): Permission[] {
    return Array.from(this.granted);
  }

  /**
   * Assess risk level of an action
   */
  assessRisk(action: Action): 'low' | 'medium' | 'high' {
    switch (action.type) {
      case 'create':
        return 'low';

      case 'modify':
        // High risk if modifying critical files
        if (action.path?.includes('.env')) return 'high';
        if (action.path?.includes('credentials')) return 'high';
        if (action.path?.includes('package.json')) return 'medium';
        return 'low';

      case 'delete':
        // High risk for any delete
        return 'high';

      case 'run': {
        const command = action.command || '';
        // Assess command risk
        if (command.includes('rm -rf')) return 'high';
        if (command.includes('sudo')) return 'high';
        if (command.startsWith('npm ')) return 'low';
        if (command.startsWith('git ')) return 'low';
        return 'medium';
      }

      case 'verify':
        return 'low';

      default:
        return 'medium';
    }
  }

  /**
   * Get permissions required for an action
   */
  getRequiredPermissions(action: Action): Permission[] {
    switch (action.type) {
      case 'create':
      case 'modify':
        return [Permission.WRITE_FILES];

      case 'delete':
        return [Permission.DELETE_FILES];

      case 'run':
      case 'verify':
        return [Permission.RUN_COMMANDS];

      default:
        return [];
    }
  }

  /**
   * Reset to initial level
   */
  reset(): void {
    this.granted = new Set(PERMISSION_PRESETS[this.initialLevel]);
    this.alwaysAllow.clear();
  }

  /**
   * Get current permission level
   */
  getLevel(): PermissionLevel {
    const granted = Array.from(this.granted);

    if (granted.length === 0) return PermissionLevel.READ_ONLY;
    if (granted.includes(Permission.DELETE_FILES)) return PermissionLevel.DANGEROUS;
    if (granted.includes(Permission.RUN_COMMANDS)) return PermissionLevel.STANDARD;
    if (granted.includes(Permission.WRITE_FILES)) return PermissionLevel.SAFE;

    return PermissionLevel.READ_ONLY;
  }
}
