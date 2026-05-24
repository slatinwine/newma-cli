/**
 * Skill Installer
 * Installs, upgrades, and removes skills
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  InstallOptions,
  InstallResult,
  UninstallOptions,
  UninstallResult,
  UpgradeOptions,
  UpgradeResult,
  InstalledSkill,
} from './types';
import type { SkillPackage } from '../types';
import { extractSkillPackage, verifyPackage } from '../compiler/packager';
import { extractMetadata } from '../metadata';
import { getInstalledSkills, saveInstalledSkill, removeInstalledSkill } from './installed-db';

/**
 * Default installation directory
 */
const DEFAULT_INSTALL_DIR = path.join(os.homedir(), '.kode', 'skills');

/**
 * Install a skill from package file
 */
export async function installSkill(
  packageFile: string,
  options: InstallOptions = {}
): Promise<InstallResult> {
  const {
    targetDir = DEFAULT_INSTALL_DIR,
    symlink = true,
    verify = true,
    skipIfExists = true,
    force = false,
    verbose = false,
  } = options;

  try {
    // Verify package if requested
    if (verify) {
      const verification = await verifyPackage(packageFile);
      if (!verification.valid) {
        return {
          success: false,
          skillId: '',
          installPath: '',
          version: '',
          files: [],
          isUpdate: false,
          error: `Package verification failed: ${verification.error}`,
        };
      }
    }

    // Extract to temp directory first
    const tempDir = path.join(os.tmpdir(), 'kode-install-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    const extractResult = await extractSkillPackage(packageFile, tempDir);
    const pkg = extractResult.package;
    const skillId = pkg.name;

    // Check if already installed
    const installed = await getInstalledSkills(targetDir);
    const existingSkill = installed.find(s => s.metadata.id === skillId);

    let isUpdate = false;
    let previousVersion: string | undefined;

    if (existingSkill) {
      if (skipIfExists && !force) {
        await fs.rm(tempDir, { recursive: true, force: true });
        return {
          success: true,
          skillId,
          installPath: existingSkill.installPath,
          version: existingSkill.version,
          files: [],
          isUpdate: false,
        };
      }

      isUpdate = true;
      previousVersion = existingSkill.version;

      // Uninstall existing version
      await uninstallSkill(skillId, { removeConfig: false, force: true, verbose: false });
    }

    // Create installation directory
    const installPath = path.join(targetDir, skillId);
    await fs.mkdir(installPath, { recursive: true });

    // Move files from temp to install directory
    await Promise.all(
      extractResult.files.map(async (file) => {
        const dest = path.join(installPath, path.basename(file));
        await fs.rename(file, dest);
      })
    );

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Create symlink if requested
    let symlinkPath: string | undefined;
    if (symlink) {
      symlinkPath = path.join(targetDir, `${skillId}-latest`);
      try {
        await fs.unlink(symlinkPath);
      } catch (_e) { /* installer: unlink cleanup */ }
      await fs.symlink(installPath, symlinkPath);
    }

    // Save to installed database
    await saveInstalledSkill(targetDir, {
      metadata: pkg.metadata,
      installPath,
      version: pkg.version,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      size: await calculateDirectorySize(installPath),
      isSymlink: !!symlink,
    });

    if (verbose) {
      console.log(`✅ ${isUpdate ? 'Updated' : 'Installed'} ${skillId}@${pkg.version}`);
      if (isUpdate && previousVersion) {
        console.log(`   Previous version: ${previousVersion}`);
      }
      console.log(`   Path: ${installPath}`);
    }

    return {
      success: true,
      skillId,
      installPath,
      version: pkg.version,
      files: extractResult.files,
      isUpdate,
      previousVersion,
    };
  } catch (error: any) {
    return {
      success: false,
      skillId: '',
      installPath: '',
      version: '',
      files: [],
      isUpdate: false,
      error: error.message,
    };
  }
}

/**
 * Uninstall a skill
 */
export async function uninstallSkill(
  skillId: string,
  options: UninstallOptions = {}
): Promise<UninstallResult> {
  const {
    removeConfig = false,
    force = false,
    verbose = false,
  } = options;

  try {
    const installed = await getInstalledSkills(DEFAULT_INSTALL_DIR);
    const skill = installed.find(s => s.metadata.id === skillId);

    if (!skill) {
      return {
        success: false,
        skillId,
        files: [],
        error: `Skill ${skillId} is not installed`,
      };
    }

    // Remove installation directory
    await fs.rm(skill.installPath, { recursive: true, force: true });

    // Remove symlink
    const symlinkPath = path.join(DEFAULT_INSTALL_DIR, `${skillId}-latest`);
    try {
      await fs.unlink(symlinkPath);
    } catch (_e) { /* installer: unlink cleanup */ }

    // Remove from database
    await removeInstalledSkill(DEFAULT_INSTALL_DIR, skillId);

    // Remove config if requested
    if (removeConfig) {
      const configDir = path.join(os.homedir(), '.kode', 'config', skillId);
      await fs.rm(configDir, { recursive: true, force: true }).catch((_e) => { /* installer: config cleanup */ });
    }

    if (verbose) {
      console.log(`✅ Uninstalled ${skillId}`);
    }

    return {
      success: true,
      skillId,
      files: [], // Would need to track installed files
    };
  } catch (error: any) {
    return {
      success: false,
      skillId,
      files: [],
      error: error.message,
    };
  }
}

/**
 * Upgrade a skill to latest version
 */
export async function upgradeSkill(
  skillId: string,
  options: UpgradeOptions = {}
): Promise<UpgradeResult> {
  const {
    prerelease = false,
    force = false,
    verbose = false,
  } = options;

  try {
    const installed = await getInstalledSkills(DEFAULT_INSTALL_DIR);
    const skill = installed.find(s => s.metadata.id === skillId);

    if (!skill) {
      return {
        success: false,
        skillId,
        oldVersion: '',
        newVersion: '',
        files: [],
        error: `Skill ${skillId} is not installed`,
      };
    }

    // This would fetch latest version from registry
    // For now, return success with same version
    const newVersion = skill.version;

    if (!force && newVersion === skill.version) {
      return {
        success: true,
        skillId,
        oldVersion: skill.version,
        newVersion: skill.version,
        files: [],
      };
    }

    if (verbose) {
      console.log(`⬆️  Upgrading ${skillId} from ${skill.version} to ${newVersion}`);
    }

    return {
      success: true,
      skillId,
      oldVersion: skill.version,
      newVersion,
      files: [],
    };
  } catch (error: any) {
    return {
      success: false,
      skillId,
      oldVersion: '',
      newVersion: '',
      files: [],
      error: error.message,
    };
  }
}

/**
 * List all installed skills
 */
export async function listInstalledSkills(
  targetDir: string = DEFAULT_INSTALL_DIR
): Promise<InstalledSkill[]> {
  return getInstalledSkills(targetDir);
}

/**
 * Get skill info
 */
export async function getSkillInfo(skillId: string): Promise<InstalledSkill | null> {
  const installed = await getInstalledSkills(DEFAULT_INSTALL_DIR);
  return installed.find(s => s.metadata.id === skillId) || null;
}

/**
 * Calculate directory size
 */
async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      totalSize += await calculateDirectorySize(fullPath);
    } else if (entry.isFile()) {
      const stats = await fs.stat(fullPath);
      totalSize += stats.size;
    }
  }

  return totalSize;
}
