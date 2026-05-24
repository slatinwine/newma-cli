#!/usr/bin/env npx ts-node
/**
 * Newma Skill CLI
 *
 * Manage skills (list, enable, disable, uninstall, validate).
 *
 * Usage:
 *   newma skill list [--all|--enabled|--disabled]
 *   newma skill enable <name>
 *   newma skill disable <name>
 *   newma skill uninstall <name>
 *   newma skill validate <path>
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { SkillRegistry } from '../src/skills/registry';
import { SimpleSkillManager } from '../src/skills/simple-loader';
import { SkillValidator } from '../src/skills/validator';

const program = new Command();
const skillsDir = resolve(process.cwd(), '.kode', 'skills');
const registryPath = resolve(skillsDir, 'registry.json');

program
  .name('newma skill')
  .description('Manage Newma skills')
  .version('1.0.0');

// List skills
program
  .command('list')
  .description('List installed skills')
  .option('-a, --all', 'Show all skills (including disabled)')
  .option('-e, --enabled', 'Show only enabled skills')
  .option('-d, --disabled', 'Show only disabled skills')
  .option('-j, --json', 'Output as JSON')
  .option('-s, --sort <field>', 'Sort by field (name|usage|installed)', 'name')
  .action(async (options) => {
    await listSkills(options);
  });

// Enable skill
program
  .command('enable <name>')
  .description('Enable a skill')
  .action(async (name: string) => {
    await setSkillEnabled(name, true);
  });

// Disable skill
program
  .command('disable <name>')
  .description('Disable a skill')
  .action(async (name: string) => {
    await setSkillEnabled(name, false);
  });

// Uninstall skill
program
  .command('uninstall <name>')
  .description('Uninstall a skill')
  .option('-f, --force', 'Force uninstall without confirmation')
  .action(async (name: string, options) => {
    await uninstallSkill(name, options.force);
  });

// Validate skill
program
  .command('validate <path>')
  .description('Validate a skill')
  .option('-s, --strict', 'Strict mode (check recommended fields)')
  .option('--no-structure', 'Skip folder structure check')
  .action(async (path: string, options) => {
    await validateSkill(path, options);
  });

// Show skill info
program
  .command('info <name>')
  .description('Show detailed information about a skill')
  .action(async (name: string) => {
    await showSkillInfo(name);
  });

// Search skills
program
  .command('search <query>')
  .description('Search skills by name, description, or tags')
  .option('-t, --type <type>', 'Filter by type (knowledge|code|hybrid)')
  .option('--tag <tag>', 'Filter by tag')
  .option('-a, --author <author>', 'Filter by author')
  .action(async (query: string, options) => {
    await searchSkills(query, options);
  });

// Stats
program
  .command('stats')
  .description('Show skill statistics')
  .action(async () => {
    await showStats();
  });

program.parse();

/**
 * List skills
 */
async function listSkills(options: any): Promise<void> {
  const registry = new SkillRegistry(registryPath);
  await registry.initialize();

  let skills = registry.getAllSkills();

  // Filter by enabled/disabled
  if (options.enabled) {
    skills = skills.filter(s => s.enabled);
  } else if (options.disabled) {
    skills = skills.filter(s => !s.enabled);
  } else if (!options.all) {
    // Default: show only enabled
    skills = skills.filter(s => s.enabled);
  }

  // Sort
  skills = registry.sortSkills(skills, options.sort);

  // JSON output
  if (options.json) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }

  // Human-readable output
  if (skills.length === 0) {
    console.log(chalk.yellow('\n⚠️  No skills found\n'));
    return;
  }

  console.log(chalk.bold(`\n📋 Skills (${skills.length})\n`));

  for (const skill of skills) {
    const status = skill.enabled ? chalk.green('✓') : chalk.red('✗');
    const typeColor = getTypeColor(skill.type);

    console.log(`${status} ${chalk.bold(skill.name)}`);
    console.log(`   ${chalk.gray(skill.description)}`);
    console.log(`   Type: ${typeColor(skill.type)} | Usage: ${skill.usageCount} | v${skill.version}`);

    if (skill.tags.length > 0) {
      console.log(`   Tags: ${skill.tags.map(t => chalk.blue(`#${t}`)).join(' ')}`);
    }

    console.log('');
  }

  console.log(chalk.gray(`Total: ${skills.length} skill(s)\n`));
}

/**
 * Enable/disable skill
 */
async function setSkillEnabled(name: string, enabled: boolean): Promise<void> {
  const registry = new SkillRegistry(registryPath);
  await registry.initialize();

  if (!registry.hasSkill(name)) {
    console.error(chalk.red(`\n❌ Skill not found: ${name}\n`));
    process.exit(1);
  }

  await registry.setSkillEnabled(name, enabled);

  const action = enabled ? 'enabled' : 'disabled';
  console.log(chalk.green(`\n✅ Skill "${name}" ${action}\n`));
}

/**
 * Uninstall skill
 */
async function uninstallSkill(name: string, force: boolean): Promise<void> {
  const registry = new SkillRegistry(registryPath);
  await registry.initialize();

  if (!registry.hasSkill(name)) {
    console.error(chalk.red(`\n❌ Skill not found: ${name}\n`));
    process.exit(1);
  }

  const skill = registry.getSkill(name)!;

  // Confirmation
  if (!force) {
    console.log(chalk.bold(`\n⚠️  Uninstall skill: ${name}\n`));
    console.log(chalk.gray(`This will remove the skill from your system.\n`));
    console.log(chalk.gray(`Type: ${skill.type}`));
    console.log(chalk.gray(`Description: ${skill.description}`));
    console.log('');

    // In a real implementation, we'd use inquirer for confirmation
    console.log(chalk.yellow('Add --force to skip confirmation'));
    console.log(chalk.gray('(Auto-confirming for this demo)\n'));
  }

  // Remove from registry
  await registry.unregisterSkill(name);

  console.log(chalk.green(`\n✅ Skill "${name}" uninstalled\n`));
  console.log(chalk.gray(`Note: Skill files still exist at: ${skill.path}`));
  console.log(chalk.gray(`You can manually delete them if needed.\n`));
}

/**
 * Validate skill
 */
async function validateSkill(path: string, options: any): Promise<void> {
  console.log(chalk.bold(`\n🔍 Validating: ${path}\n`));

  const validator = new SkillValidator({
    strict: options.strict,
    checkStructure: options.structure,
  });

  const result = await validator.validateSkill(path);

  console.log(SkillValidator.formatResult(result));

  if (!result.valid) {
    process.exit(1);
  }
}

/**
 * Show skill info
 */
async function showSkillInfo(name: string): Promise<void> {
  const registry = new SkillRegistry(registryPath);
  await registry.initialize();

  if (!registry.hasSkill(name)) {
    console.error(chalk.red(`\n❌ Skill not found: ${name}\n`));
    process.exit(1);
  }

  const skill = registry.getSkill(name)!;

  console.log(chalk.bold(`\n📋 ${skill.name}\n`));

  console.log(chalk.gray('Description:'));
  console.log(`  ${skill.description}\n`);

  console.log(chalk.gray('Details:'));
  console.log(`  Version: ${skill.version}`);
  console.log(`  Type: ${skill.type}`);
  console.log(`  Status: ${skill.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
  console.log(`  Source: ${skill.source}\n`);

  if (skill.author) {
    console.log(chalk.gray('Author:'));
    console.log(`  ${skill.author}\n`);
  }

  if (skill.license) {
    console.log(chalk.gray('License:'));
    console.log(`  ${skill.license}\n`);
  }

  if (skill.tags.length > 0) {
    console.log(chalk.gray('Tags:'));
    console.log(`  ${skill.tags.map(t => chalk.blue(`#${t}`)).join(' ')}\n`);
  }

  console.log(chalk.gray('Usage Statistics:'));
  console.log(`  Executed: ${skill.usageCount} time(s)`);
  console.log(`  Last used: ${skill.lastUsedAt || 'Never'}\n`);

  console.log(chalk.gray('Location:'));
  console.log(`  Path: ${skill.path}`);
  console.log(`  SKILL.md: ${skill.skillMdPath}\n`);

  if (skill.hasScripts || skill.hasReferences || skill.hasAssets) {
    console.log(chalk.gray('Structure:'));
    if (skill.hasScripts) console.log('  ✓ scripts/');
    if (skill.hasReferences) console.log('  ✓ references/');
    if (skill.hasAssets) console.log('  ✓ assets/');
    console.log('');
  }
}

/**
 * Search skills
 */
async function searchSkills(query: string, options: any): Promise<void> {
  const registry = new SkillRegistry(registryPath);
  await registry.initialize();

  const filters: any = {
    searchQuery: query,
  };

  if (options.type) {
    filters.type = options.type;
  }

  if (options.tag) {
    filters.tags = [options.tag];
  }

  if (options.author) {
    filters.author = options.author;
  }

  const results = registry.searchSkills(filters);

  if (results.length === 0) {
    console.log(chalk.yellow(`\n⚠️  No results found for: ${query}\n`));
    return;
  }

  console.log(chalk.bold(`\n🔍 Results for "${query}" (${results.length})\n`));

  for (const skill of results) {
    const status = skill.enabled ? chalk.green('✓') : chalk.red('✗');
    console.log(`${status} ${chalk.bold(skill.name)}`);
    console.log(`   ${chalk.gray(skill.description.substring(0, 80))}`);
    console.log(`   Type: ${getTypeColor(skill.type)(skill.type)} | Usage: ${skill.usageCount}\n`);
  }
}

/**
 * Show statistics
 */
async function showStats(): Promise<void> {
  const registry = new SkillRegistry(registryPath);
  await registry.initialize();

  const stats = registry.getStats();

  console.log(chalk.bold('\n📊 Skill Statistics\n'));

  console.log(chalk.gray('Overview:'));
  console.log(`  Total: ${stats.total}`);
  console.log(`  Enabled: ${chalk.green(stats.enabled)}`);
  console.log(`  Disabled: ${chalk.red(stats.disabled)}\n`);

  console.log(chalk.gray('By Type:'));
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`  ${getTypeColor(type as any)(type)}: ${count}`);
  }

  console.log(chalk.gray('\nBy Source:'));
  for (const [source, count] of Object.entries(stats.bySource)) {
    console.log(`  ${source}: ${count}`);
  }

  console.log(chalk.gray('\nUsage:'));
  console.log(`  Total executions: ${stats.totalUsage}\n`);
}

/**
 * Get color for skill type
 */
function getTypeColor(type: string): any {
  switch (type) {
    case 'knowledge':
      return chalk.blue;
    case 'code':
      return chalk.yellow;
    case 'hybrid':
      return chalk.magenta;
    default:
      return chalk.gray;
  }
}

export { program };
