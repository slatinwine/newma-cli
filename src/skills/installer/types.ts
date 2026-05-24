/**
 * Skill Installer - Type Definitions
 * Installs, upgrades, and manages skills
 */

import { SkillMetadata } from '../types';

/**
 * Installation options
 */
export interface InstallOptions {
  /** Installation directory */
  targetDir?: string;
  /** Create symlink for easy access */
  symlink?: boolean;
  /** Verify package integrity */
  verify?: boolean;
  /** Skip if already installed */
  skipIfExists?: boolean;
  /** Force reinstall */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Installation result
 */
export interface InstallResult {
  /** Success status */
  success: boolean;
  /** Installed skill ID */
  skillId: string;
  /** Installation path */
  installPath: string;
  /** Version installed */
  version: string;
  /** Files installed */
  files: string[];
  /** Is update */
  isUpdate: boolean;
  /** Previous version (if update) */
  previousVersion?: string;
  /** Error message */
  error?: string;
}

/**
 * Uninstallation options
 */
export interface UninstallOptions {
  /** Remove configuration files */
  removeConfig?: boolean;
  /** Force removal even if in use */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Uninstallation result
 */
export interface UninstallResult {
  /** Success status */
  success: boolean;
  /** Uninstalled skill ID */
  skillId: string;
  /** Removed files */
  files: string[];
  /** Error message */
  error?: string;
}

/**
 * Upgrade options
 */
export interface UpgradeOptions {
  /** Prerelease versions */
  prerelease?: boolean;
  /** Force upgrade even if same version */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Upgrade result
 */
export interface UpgradeResult {
  /** Success status */
  success: boolean;
  /** Skill ID */
  skillId: string;
  /** Old version */
  oldVersion: string;
  /** New version */
  newVersion: string;
  /** Upgraded files */
  files: string[];
  /** Error message */
  error?: string;
}

/**
 * Installed skill information
 */
export interface InstalledSkill {
  /** Skill metadata */
  metadata: SkillMetadata;
  /** Installation path */
  installPath: string;
  /** Installed version */
  version: string;
  /** Installation date */
  installedAt: string;
  /** Last updated */
  updatedAt: string;
  /** Installation size (bytes) */
  size: number;
  /** Is symlink */
  isSymlink: boolean;
  /** Dependencies */
  dependencies?: Record<string, string>;
}

/**
 * Skill registry entry
 */
export interface RegistryEntry {
  /** Skill ID */
  id: string;
  /** Name */
  name: string;
  /** Description */
  description: string;
  /** Latest version */
  latestVersion: string;
  /** Available versions */
  versions: string[];
  /** Author */
  author?: string;
  /** License */
  license?: string;
  /** Homepage */
  homepage?: string;
  /** Repository */
  repository?: string;
  /** Keywords */
  keywords: string[];
  /** Downloads count */
  downloads?: number;
  /** Rating */
  rating?: number;
  /** Package URL */
  packageUrl: string;
}

/**
 * Registry search options
 */
export interface RegistrySearchOptions {
  /** Search query */
  query?: string;
  /** Category filter */
  category?: string;
  /** Tag filter */
  tag?: string;
  /** Minimum rating */
  minRating?: number;
  /** Sort order */
  sortBy?: 'relevance' | 'name' | 'version' | 'downloads' | 'rating';
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Registry search result
 */
export interface RegistrySearchResult {
  /** Total matches */
  total: number;
  /** Results */
  results: RegistryEntry[];
  /** Has more results */
  hasMore: boolean;
  /** Next offset */
  nextOffset?: number;
}
