#!/usr/bin/env node
/**
 * Kode Create Plugin CLI
 *
 * Standalone CLI tool for creating Kode plugins
 */

import { Command } from 'commander';
import * as path from 'path';
import { SkillsCreator } from '../src/skills-creator/index';
import { getDefaultConfig } from '../src/config';
import chalk from 'chalk';

const program = new Command();

program
  .name('kode-create-plugin')
  .description('Create Kode plugins from requirements or chat history')
  .version('1.0.0');

program
  .command('interactive')
  .alias('i')
  .description('Create plugin interactively')
  .option('-o, --out <dir>', 'Output directory')
  .action(async (options) => {
    try {
      const config = getDefaultConfig();

      const creator = new SkillsCreator(config, process.cwd());
      await creator.createInteractive(options.out);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('from-requirement')
  .alias('req')
  .description('Create plugin from requirement description')
  .argument('<description>', 'Plugin requirement description')
  .option('-o, --out <dir>', 'Output directory')
  .option('-t, --template <type>', 'Template type', 'basic')
  .option('-i, --interactive', 'Preview files before writing')
  .action(async (description, options) => {
    try {
      console.log(chalk.cyan('📝 Requirement:'), description);

      const config = getDefaultConfig();

      const creator = new SkillsCreator(config, process.cwd(), {
        defaultTemplate: options.template as any,
        interactive: options.interactive,  // NEW: Pass through interactive flag
      });

      await creator.createFromRequirement(description, options.out);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('from-file')
  .alias('file')
  .description('Create plugin from requirement file')
  .argument('<file>', 'Path to requirement file (Markdown or JSON)')
  .option('-o, --out <dir>', 'Output directory')
  .option('-t, --template <type>', 'Template type', 'basic')
  .action(async (file, options) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(file, 'utf-8');

      const config = getDefaultConfig();

      const creator = new SkillsCreator(config, process.cwd(), {
        defaultTemplate: options.template as any,
      });

      await creator.createFromRequirement(content, options.out);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('from-chat')
  .alias('chat')
  .description('Create plugin from chat history file (JSON)')
  .argument('<file>', 'Path to chat history JSON file')
  .option('-o, --out <dir>', 'Output directory')
  .option('-t, --template <type>', 'Template type', 'basic')
  .action(async (file, options) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(file, 'utf-8');
      const messages = JSON.parse(content);

      const config = getDefaultConfig();

      const creator = new SkillsCreator(config, process.cwd(), {
        defaultTemplate: options.template as any,
      });

      await creator.createFromChat(messages, options.out);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .alias('v')
  .description('Validate existing plugin')
  .argument('<dir>', 'Plugin directory')
  .action(async (dir) => {
    try {
      const { PluginPackager } = await import('../src/skills-creator/packager');
      const packager = new PluginPackager();

      const validation = await packager.validate(dir);

      if (validation.valid) {
        console.log(chalk.green('✅ Plugin is valid!'));
      } else {
        console.log(chalk.red('❌ Plugin validation failed:\n'));
        for (const error of validation.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('test')
  .alias('t')
  .description('Test existing plugin')
  .argument('<dir>', 'Plugin directory')
  .action(async (dir) => {
    try {
      const { PluginPackager } = await import('../src/skills-creator/packager');
      const packager = new PluginPackager();

      console.log(chalk.cyan('🧪 Running tests...\n'));
      const result = await packager.test(dir);

      if (result.passed) {
        console.log(chalk.green('✅ All tests passed!'));
      } else {
        console.log(chalk.red('❌ Some tests failed:\n'));

        for (const test of result.tests) {
          if (test.passed) {
            console.log(chalk.green(`  ✓ ${test.name}`));
          } else {
            console.log(chalk.red(`  ✗ ${test.name}`));
            if (test.error) {
              console.log(chalk.gray(`    ${test.error}`));
            }
          }
        }

        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('markdown')
  .alias('md')
  .description('Create Markdown plugin (zero-code, AI-driven)')
  .argument('<name>', 'Plugin name (kebab-case)')
  .option('-d, --description <text>', 'Plugin description')
  .option('-t, --template <name>', 'Template: code-review, project-setup, deployment-check, debugging-guide, or blank', 'blank')
  .option('-o, --out <dir>', 'Output directory (default: plugins/)')
  .action(async (name, options) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Validate plugin name
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        console.error(chalk.red('Error:'), 'Plugin name must be kebab-case (lowercase letters, numbers, and hyphens)');
        process.exit(1);
      }

      const outDir = options.out || path.join(process.cwd(), 'plugins', name);
      const pluginFile = path.join(outDir, 'PLUGIN.md');

      // Check if plugin already exists
      try {
        await fs.access(pluginFile);
        console.error(chalk.red('Error:'), `Plugin already exists at ${pluginFile}`);
        process.exit(1);
      } catch {
        // File doesn't exist, continue
      }

      // Create output directory
      await fs.mkdir(outDir, { recursive: true });

      // Load template or create blank
      let content = '';
      const templateDir = path.join(__dirname, '../templates/plugins/markdown');

      if (options.template === 'blank') {
        // Create blank template
        const description = options.description || `${name} plugin`;
        content = `---
name: ${name}
description: ${description}
version: 1.0.0
---

# ${description}

当用户请求相关功能时，按照以下步骤执行：

## 步骤 1: [步骤名称]
- [子步骤1]
- [子步骤2]

## 步骤 2: [步骤名称]
- [子步骤1]
- [子步骤2]

## 输出格式

### [输出标题]

[描述输出格式和内容]

---

**使用示例**:
- \`/${name} [参数1]\`
- \`/${name} [参数2]\`
`;
      } else {
        // Load template
        const templatePath = path.join(templateDir, `${options.template}.md`);
        try {
          content = await fs.readFile(templatePath, 'utf-8');
          // Replace name and description in template
          const description = options.description || `${name} plugin`;
          content = content.replace(/name: \w+/, `name: ${name}`);
          content = content.replace(/description: .+/, `description: ${description}`);

          // Update usage examples
          content = content.replace(/\/\w+-\w+/g, `/${name}`);
        } catch (error) {
          console.error(chalk.red('Error:'), `Template '${options.template}' not found`);
          console.log(chalk.gray('\nAvailable templates:'));
          console.log(chalk.gray('  - code-review'));
          console.log(chalk.gray('  - project-setup'));
          console.log(chalk.gray('  - deployment-check'));
          console.log(chalk.gray('  - debugging-guide'));
          console.log(chalk.gray('  - blank (default)'));
          process.exit(1);
        }
      }

      // Write plugin file
      await fs.writeFile(pluginFile, content, 'utf-8');

      console.log(chalk.green('✅ Markdown plugin created!'));
      console.log(chalk.cyan('\n📁 Location:'), pluginFile);
      console.log(chalk.yellow('\n📝 Next steps:'));
      console.log(chalk.gray(`  1. Edit ${pluginFile} to customize your plugin`));
      console.log(chalk.gray(`  2. Test with: /${name} [your-input]`));
      console.log(chalk.gray(`  3. The plugin will be executed by Python AI engine\n`));

    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// List available templates
program
  .command('list-templates')
  .alias('lt')
  .description('List available Markdown plugin templates')
  .action(async () => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const templateDir = path.join(__dirname, '../templates/plugins/markdown');
      const files = await fs.readdir(templateDir);

      console.log(chalk.cyan('📋 Available Markdown Plugin Templates:\n'));

      for (const file of files) {
        if (file.endsWith('.md')) {
          const templatePath = path.join(templateDir, file);
          const content = await fs.readFile(templatePath, 'utf-8');
          const nameMatch = content.match(/name: (.+)/);
          const descMatch = content.match(/description: (.+)/);

          if (nameMatch && descMatch) {
            const templateName = file.replace('.md', '');
            console.log(chalk.green(`  ${templateName}`));
            console.log(chalk.gray(`    ${descMatch[1]}`));
            console.log('');
          }
        }
      }

      console.log(chalk.yellow('Usage:'));
      console.log(chalk.gray('  kode-create-plugin markdown <name> --template <template-name>\n'));
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
