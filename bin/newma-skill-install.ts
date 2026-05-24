#!/usr/bin/env npx ts-node
/**
 * Newma Skill Installer
 *
 * Install skills from ZIP files or URLs.
 * Inspired by OpenDeepWiki's skill upload flow.
 *
 * Usage:
 *   npx newma-skill-install <zip-file>
 *   npx newma-skill-install <url>
 *   npx newma-skill-install <zip-file> --force
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readFile, readdir, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';
import { SkillRegistry } from '../src/skills/registry';
import { SimpleSkillManager } from '../src/skills/simple-loader';
import { SkillValidator, ValidationResult } from '../src/skills/validator';
import { parseSkillFrontmatter } from '../src/skills/simple-loader';
import { execFileNoThrow } from '../src/utils/execFileNoThrow';
import { rm } from 'fs/promises';

const program = new Command();

program
  .name('newma-skill-install')
  .description('Install skills from ZIP files, URLs, npm packages, or GitHub repos')
  .version('1.0.0')
  .argument('<source>', 'ZIP file, URL, npm package, or GitHub repo (e.g., npm:@scope/pkg, github:user/repo, https://...)')
  .option('-f, --force', 'Overwrite existing skill')
  .option('-s, --skip-validation', 'Skip validation')
  .option('-v, --verbose', 'Verbose output')
  .action(async (source: string, options) => {
    try {
      await installSkill(source, options);
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Installation failed: ${error.message}`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();

/**
 * Install skill from source
 */
async function installSkill(source: string, options: any): Promise<void> {
  console.log(chalk.bold('\n📦 Newma Skill Installer\n'));

  // Determine source type and resolve to ZIP path
  let zipPath: string;
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'npm':
      console.log(chalk.blue(`📦 Installing from npm package: ${source}`));
      zipPath = await downloadFromNpm(source, options);
      break;

    case 'github':
      console.log(chalk.blue(`📦 Installing from GitHub: ${source}`));
      zipPath = await downloadFromGithub(source);
      break;

    case 'url':
      console.log(chalk.blue(`📥 Downloading from URL: ${source}`));
      zipPath = await downloadZip(source);
      break;

    case 'local':
      zipPath = source;
      if (!existsSync(zipPath)) {
        throw new Error(`File not found: ${zipPath}`);
      }
      break;

    default:
      throw new Error(`Unsupported source type: ${source}`);
  }

  console.log(chalk.gray(`📦 ZIP file: ${zipPath}`));

  // Extract to temp directory
  console.log(chalk.blue('\n📂 Extracting ZIP...'));
  const tempDir = await extractZip(zipPath);

  // Find SKILL.md
  console.log(chalk.blue('🔍 Looking for SKILL.md...'));
  const { skillMdPath, skillRootDir } = await findSkillMd(tempDir, options);

  // Read and parse SKILL.md
  console.log(chalk.blue('📖 Reading SKILL.md...'));
  const content = await readFile(skillMdPath, 'utf-8');
  const metadata = parseSkillFrontmatter(content);

  console.log(chalk.gray(`   Name: ${metadata.name}`));
  console.log(chalk.gray(`   Description: ${metadata.description.substring(0, 60)}...`));

  // Validate skill (unless skipped)
  if (!options.skipValidation) {
    console.log(chalk.blue('\n✓ Validating skill...'));
    const validator = new SkillValidator({ checkStructure: true });
    const result: ValidationResult = await validator.validateSkill(skillMdPath);

    if (!result.valid) {
      console.error(chalk.red('\n❌ Validation failed:'));
      for (const error of result.errors) {
        console.error(chalk.red(`   • [${error.field}] ${error.message}`));
      }
      throw new Error('Skill validation failed');
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      for (const warning of result.warnings) {
        console.log(chalk.yellow(`   • [${warning.field}] ${warning.message}`));
      }
    }

    console.log(chalk.green('   ✅ Validation passed'));
  } else {
    console.log(chalk.yellow('⚠️  Validation skipped'));
  }

  // Check for existing skill
  const skillsDir = join(process.cwd(), '.kode', 'skills');
  const targetDir = join(skillsDir, metadata.name);

  if (existsSync(targetDir)) {
    if (!options.force) {
      throw new Error(
        `Skill already exists: ${metadata.name}\nUse --force to overwrite`
      );
    }
    console.log(chalk.yellow(`\n⚠️  Overwriting existing skill: ${metadata.name}`));
  }

  // Install skill
  console.log(chalk.blue('\n📥 Installing skill...'));
  await installSkillDirectory(skillRootDir, targetDir);

  console.log(chalk.green(`   ✅ Installed to: ${targetDir}`));

  // Update registry
  console.log(chalk.blue('\n📝 Updating registry...'));
  const registry = new SkillRegistry(join(process.cwd(), '.kode', 'skills', 'registry.json'));
  await registry.initialize();

  const entry = SkillRegistry.createEntryFromMetadata(
    metadata,
    targetDir,
    sourceType !== 'local' ? 'remote' : 'local',
    sourceType !== 'local' ? source : undefined
  );

  if (registry.hasSkill(metadata.name)) {
    await registry.updateSkill(metadata.name, entry);
  } else {
    await registry.registerSkill(entry);
  }

  console.log(chalk.green(`   ✅ Registry updated`));

  // Load skill to verify
  console.log(chalk.blue('\n🔍 Verifying installation...'));
  const skillManager = new SimpleSkillManager({ skillDirectories: [skillsDir] });
  await skillManager.discoverSkills();

  const skill = skillManager.getSkill(metadata.name);
  if (!skill) {
    throw new Error('Skill installation verification failed');
  }

  console.log(chalk.green(`   ✅ Skill loaded successfully`));

  // Summary
  console.log(chalk.bold('\n✨ Installation successful!\n'));
  console.log(chalk.gray('   Skill Details:'));
  console.log(chalk.gray(`   • Name: ${metadata.name}`));
  console.log(chalk.gray(`   • Version: ${metadata.version || '1.0.0'}`));
  console.log(chalk.gray(`   • Type: ${metadata.type}`));
  console.log(chalk.gray(`   • Tags: ${metadata.tags.join(', ') || 'none'}`));
  console.log(chalk.gray(`   • Location: ${targetDir}`));

  console.log(chalk.green('\n✅ Skill is ready to use!'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray(`  • List skills: newma skill list`));
  console.log(chalk.gray(`  • Use skill: AI will automatically discover it`));
  console.log(chalk.gray(`  • Enable/disable: newma skill enable ${metadata.name}`));
}

/**
 * Detect source type
 */
type SourceType = 'npm' | 'github' | 'url' | 'local';

function detectSourceType(source: string): SourceType {
  // Check for explicit prefixes first
  if (source.startsWith('npm:')) {
    return 'npm';
  }

  if (source.startsWith('github:')) {
    return 'github';
  }

  // Check for URLs
  if (source.startsWith('http://') || source.startsWith('https://')) {
    if (source.includes('github.com')) {
      return 'github';
    }
    return 'url';
  }

  // Check for npm package pattern
  // Matches: @scope/package, @scope/package/path, user/package, user/package/path
  if (source.match(/^@[\w-]+\/[\w-]+/) || source.match(/^[\w-]+\/[\w-]+/)) {
    return 'npm';
  }

  // Default to local file
  return 'local';
}

/**
 * Download from npm package
 */
async function downloadFromNpm(packageSpec: string, options: any): Promise<string> {
  // Remove 'npm:' prefix if present
  const packageName = packageSpec.replace(/^npm:/, '');

  console.log(chalk.gray(`   Package: ${packageName}`));

  const tempDir = join(process.cwd(), '.tmp', `npm-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    // Use npm pack to download the package
    console.log(chalk.gray('   Running npm pack...'));

    const result = await execFileNoThrow('npm', [
      'pack',
      packageName,
      '--pack-destination',
      tempDir,
      '--silent',
    ]);

    if (result.error) {
      throw new Error(`npm pack failed: ${result.stderr}`);
    }

    // Find the downloaded .tgz file
    const files = await readdir(tempDir);
    const tgzFile = files.find(f => f.endsWith('.tgz'));

    if (!tgzFile) {
      throw new Error('npm pack did not produce a .tgz file');
    }

    console.log(chalk.gray(`   Downloaded: ${tgzFile}`));

    // Return .tgz path (extractZip handles both .zip and .tgz)
    return join(tempDir, tgzFile);
  } catch (error: any) {
    // Cleanup on error
    await rm(tempDir, { recursive: true, force: true });
    throw new Error(`Failed to download npm package: ${error.message}`);
  }
}

/**
 * Download from GitHub repository
 */
async function downloadFromGithub(repoSpec: string): Promise<string> {
  // Parse GitHub repo spec
  // Supports: github:user/repo, https://github.com/user/repo, https://github.com/user/repo/archive/branch.zip
  let repoUrl = repoSpec;

  if (repoSpec.startsWith('github:')) {
    const match = repoSpec.match(/^github:([^/]+)\/([^/]+)$/);
    if (!match) {
      throw new Error(`Invalid GitHub repo spec: ${repoSpec}`);
    }
    const [, user, repo] = match;
    repoUrl = `https://github.com/${user}/${repo}/archive/HEAD.zip`;
  } else if (repoSpec.includes('github.com')) {
    // Convert GitHub URL to download URL
    if (!repoSpec.endsWith('.zip')) {
      // Extract user/repo from URL and create download URL
      const match = repoSpec.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const [, user, repo] = match;
        repoUrl = `https://github.com/${user}/${repo}/archive/HEAD.zip`;
      } else {
        throw new Error(`Invalid GitHub URL: ${repoSpec}`);
      }
    }
  }

  console.log(chalk.gray(`   GitHub URL: ${repoUrl}`));

  // Download as regular URL
  return downloadZip(repoUrl);
}

/**
 * Download ZIP from URL
 */
async function downloadZip(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const tempDir = join(process.cwd(), '.tmp');
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }

  const zipPath = join(tempDir, `skill-${Date.now()}.zip`);
  const stream = createWriteStream(zipPath);

  await pipeline(response.body as any, stream);

  return zipPath;
}

/**
 * Extract archive to temp directory (handles .zip and .tgz)
 */
async function extractZip(archivePath: string): Promise<string> {
  const tempDir = join(process.cwd(), '.tmp', `extract-${Date.now()}`);

  await mkdir(tempDir, { recursive: true });

  // Check if it's a .tgz file
  if (archivePath.endsWith('.tgz')) {
    console.log(chalk.gray('   Extracting .tgz archive...'));

    // Use tar command to extract
    const result = await execFileNoThrow('tar', ['-xzf', archivePath, '-C', tempDir]);

    if (result.error) {
      throw new Error(`Failed to extract .tgz: ${result.stderr}`);
    }
  } else {
    // Use adm-zip for .zip files
    try {
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(tempDir, true);
    } catch (error: any) {
      throw new Error(`Failed to extract .zip: ${error.message}`);
    }
  }

  return tempDir;
}

/**
 * Recursively find all SKILL.md files in directory
 */
async function findAllSkillMds(dir: string, maxDepth = 3): Promise<Array<{ path: string; rootDir: string; name: string }>> {
  const results: Array<{ path: string; rootDir: string; name: string }> = [];

  // Check root
  const rootMd = join(dir, 'SKILL.md');
  if (existsSync(rootMd)) {
    results.push({ path: rootMd, rootDir: dir, name: 'root' });
  }

  // Recursively search subdirectories
  async function searchDirectory(currentDir: string, depth: number) {
    if (depth > maxDepth) return;

    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMd = join(currentDir, entry.name, 'SKILL.md');
        if (existsSync(skillMd)) {
          results.push({
            path: skillMd,
            rootDir: join(currentDir, entry.name),
            name: entry.name
          });
        }
        // Continue searching recursively
        await searchDirectory(join(currentDir, entry.name), depth + 1);
      }
    }
  }

  await searchDirectory(dir, 0);
  return results;
}

/**
 * Find SKILL.md in directory
 */
async function findSkillMd(dir: string, options?: any): Promise<{ skillMdPath: string; skillRootDir: string }> {
  // Find all skill.md files recursively
  const skills = await findAllSkillMds(dir);

  if (skills.length === 0) {
    throw new Error('SKILL.md not found in ZIP archive');
  }

  if (skills.length === 1) {
    console.log(chalk.gray(`   Found: ${skills[0].path}`));
    return { skillMdPath: skills[0].path, skillRootDir: skills[0].rootDir };
  }

  // Multiple skills found - let user choose
  console.log(chalk.yellow(`\n⚠️  Multiple skills found in archive:`));
  skills.forEach((skill, index) => {
    console.log(chalk.gray(`   [${index + 1}] ${skill.name}`));
  });

  // If --force or non-interactive, select first one
  if (options?.force || !process.stdin.isTTY) {
    console.log(chalk.yellow(`\n   Auto-selecting first skill: ${skills[0].name}\n`));
    return { skillMdPath: skills[0].path, skillRootDir: skills[0].rootDir };
  }

  // Interactive selection
  const answers = await inquirer.prompt({
    type: 'list',
    name: 'skill',
    message: 'Which skill would you like to install?',
    choices: skills.map((s, i) => ({ name: s.name, value: i })),
  });

  const selected = skills[answers.skill];
  console.log(chalk.gray(`   Selected: ${selected.name}\n`));
  return { skillMdPath: selected.path, skillRootDir: selected.rootDir };
}

/**
 * Install skill directory
 */
async function installSkillDirectory(sourceDir: string, targetDir: string): Promise<void> {
  // Create target directory
  await mkdir(targetDir, { recursive: true });

  // Copy all files
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(sourceDir, entry.name);
    const destPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Copy directory recursively
 */
async function copyDirectory(srcDir: string, destDir: string): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

export { program };
