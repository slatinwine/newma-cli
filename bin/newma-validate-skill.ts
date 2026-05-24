#!/usr/bin/env node
/**
 * Kode Skill Validation CLI
 * Command-line tool for validating skills
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';

// Import skill system functions
async function importSkills() {
  const skills = await import('../src/skills/index.js');
  return skills;
}

const program = new Command();

program
  .name('kode-validate-skill')
  .description('Validate Kode skills')
  .version('1.0.0');

/**
 * Validate a skill
 */
program
  .command('validate <skill-path>')
  .description('Validate a skill directory')
  .option('-s, --strict', 'Fail on warnings')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .action(async (skillPath: string, options) => {
    const skills = await importSkills();

    try {
      console.log(chalk.blue(`\n🔍 Validating skill: ${skillPath}\n`));

      // Extract metadata
      const { metadata, content } = await skills.extractMetadata(skillPath);

      // Validate metadata
      const validation = skills.validateMetadata(metadata);

      // Format output
      if (options.format === 'json') {
        console.log(JSON.stringify({ metadata, validation }, null, 2));
      } else {
        // Text format
        console.log(chalk.bold('📋 Metadata:'));
        console.log(`  ID: ${chalk.cyan(metadata.id)}`);
        console.log(`  Name: ${chalk.cyan(metadata.name)}`);
        console.log(`  Version: ${chalk.cyan(metadata.version)}`);
        console.log(`  Type: ${chalk.cyan(metadata.type)}`);
        console.log(`  Category: ${chalk.cyan(metadata.category)}`);
        console.log(`  Complexity: ${chalk.cyan(metadata.complexity.toString())}`);

        console.log(chalk.bold('\n🏷️  Tags:'));
        metadata.tags.forEach(tag => console.log(`  - ${chalk.green(tag)}`));

        console.log(chalk.bold('\n🎯 Triggers:'));
        metadata.triggers.forEach(trigger => console.log(`  - ${chalk.yellow(trigger)}`));

        console.log(chalk.bold('\n✅ Validation:'));
        if (validation.valid) {
          console.log(chalk.green('  ✓ Metadata is valid'));
        } else {
          console.log(chalk.red('  ✗ Metadata has errors'));
        }

        if (validation.errors.length > 0) {
          console.log(chalk.red('\n❌ Errors:'));
          for (const error of validation.errors) {
            console.log(chalk.red(`  ✗ [${error.field}] ${error.message}`));
          }
        }

        if (validation.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          for (const warning of validation.warnings) {
            console.log(chalk.yellow(`  ⚠ [${warning.field}] ${warning.message}`));
          }
        }

        // Input/Output schema validation
        if (metadata.inputSchema) {
          console.log(chalk.bold('\n📥 Input Schema:'));
          console.log(chalk.gray(`  ${JSON.stringify(metadata.inputSchema, null, 2).split('\n').join('\n  ')}`));
        }

        if (metadata.outputSchema) {
          console.log(chalk.bold('\n📤 Output Schema:'));
          console.log(chalk.gray(`  ${JSON.stringify(metadata.outputSchema, null, 2).split('\n').join('\n  ')}`));
        }

        // Exit code
        const exitCode = validation.valid && (!options.strict || validation.warnings.length === 0) ? 0 : 1;
        process.exit(exitCode);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * Test a skill
 */
program
  .command('test <skill-path>')
  .description('Run tests for a skill')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .action(async (skillPath: string, options) => {
    const skills = await importSkills();

    try {
      console.log(chalk.blue(`\n🧪 Testing skill: ${skillPath}\n`));

      // Extract metadata
      const { metadata } = await skills.extractMetadata(skillPath);

      // Generate tests
      const tests = skills.generateTestsFromMetadata(metadata);

      console.log(chalk.bold(`Generated ${tests.length} tests:\n`));

      for (const test of tests) {
        console.log(chalk.cyan(`  • ${test.name}`));
        console.log(chalk.gray(`    ${test.description}`));
      }

      // Note: Actual test execution requires an executor function
      console.log(chalk.yellow('\n⚠️  Note: Test execution requires an executor function'));
      console.log(chalk.yellow('  Use createTestSuite() and executeTestSuite() programmatically\n'));

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * Benchmark a skill
 */
program
  .command('benchmark <skill-path>')
  .description('Benchmark a skill')
  .option('-i, --iterations <n>', 'Number of iterations', '100')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .action(async (skillPath: string, options) => {
    const skills = await importSkills();

    try {
      console.log(chalk.blue(`\n⚡ Benchmarking skill: ${skillPath}\n`));

      // Extract metadata
      const { metadata, content } = await skills.extractMetadata(skillPath);

      // Create skill object
      const skill = {
        id: metadata.id,
        metadata,
        content,
        references: new Map(),
        path: skillPath,
      };

      // Load references
      const refsPath = path.join(skillPath, 'references');
      try {
        const files = await fs.readdir(refsPath);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const name = path.basename(file, '.md');
            const filePath = path.join(refsPath, file);
            const refContent = await fs.readFile(filePath, 'utf-8');
            skill.references.set(name, {
              name,
              path: filePath,
              content: refContent,
              tokens: skills.estimateTokens(refContent),
              loaded: false,
            });
          }
        }
      } catch {
        // No references directory
      }

      // Run benchmarks
      const loader = new skills.ProgressiveSkillLoader();
      const result = await skills.benchmarkSkill(skill, {
        loader,
        config: {
          iterations: parseInt(options.iterations),
        },
      });

      // Format output
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(skills.formatBenchmarkResults([result]));
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * Generate test file
 */
program
  .command('generate-test <skill-path> [output-path]')
  .description('Generate test file for a skill')
  .option('-f, --framework <framework>', 'Test framework (jest, mocha, jasmine)', 'jest')
  .action(async (skillPath: string, outputPath?: string, options?: any) => {
    const skills = await importSkills();

    try {
      console.log(chalk.blue(`\n📝 Generating test file for: ${skillPath}\n`));

      // Extract metadata
      const { metadata } = await skills.extractMetadata(skillPath);

      // Generate test file
      const testFile = skills.generateTestFile(metadata, {
        framework: options.framework,
      });

      // Determine output path
      const output = outputPath || path.join(skillPath, `${metadata.id}.test.ts`);

      // Write test file
      await fs.writeFile(output, testFile, 'utf-8');

      console.log(chalk.green(`✅ Test file generated: ${output}\n`));

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * Validate multiple skills
 */
program
  .command('batch <paths...>')
  .description('Validate multiple skills')
  .option('-s, --strict', 'Fail on warnings')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .action(async (paths: string[], options) => {
    const skills = await importSkills();

    try {
      console.log(chalk.blue(`\n🔍 Validating ${paths.length} skills\n`));

      const results = [];

      for (const skillPath of paths) {
        console.log(chalk.gray(`  • ${skillPath}...`));

        try {
          const { metadata } = await skills.extractMetadata(skillPath);
          const validation = skills.validateMetadata(metadata);

          results.push({
            skillPath,
            valid: validation.valid,
            errors: validation.errors.length,
            warnings: validation.warnings.length,
          });

          if (validation.valid) {
            console.log(chalk.green(`    ✓ Valid`));
          } else {
            console.log(chalk.red(`    ✗ Invalid (${validation.errors.length} errors)`));
          }

        } catch (error) {
          console.log(chalk.red(`    ✗ Error: ${error.message}`));
          results.push({
            skillPath,
            valid: false,
            errors: 1,
            warnings: 0,
          });
        }
      }

      console.log(chalk.bold('\n📊 Summary:'));
      const valid = results.filter(r => r.valid).length;
      const invalid = results.filter(r => !r.valid).length;
      const totalErrors = results.reduce((a, b) => a + b.errors, 0);
      const totalWarnings = results.reduce((a, b) => a + b.warnings, 0);

      console.log(`  Total: ${results.length}`);
      console.log(chalk.green(`  Valid: ${valid}`));
      console.log(chalk.red(`  Invalid: ${invalid}`));
      console.log(chalk.red(`  Errors: ${totalErrors}`));
      console.log(chalk.yellow(`  Warnings: ${totalWarnings}`));

      if (options.format === 'json') {
        console.log('\n' + JSON.stringify(results, null, 2));
      }

      const exitCode = invalid === 0 && (!options.strict || totalWarnings === 0) ? 0 : 1;
      process.exit(exitCode);

    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
