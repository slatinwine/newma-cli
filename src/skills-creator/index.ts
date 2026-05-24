/**
 * Skills Creator - Main Entry Point
 *
 * Orchestrates plugin analysis, generation, and packaging
 */

import type {
  ChatMessage,
  PluginRequirement,
  PluginGenerationOptions,
  SkillsCreatorConfig,
  PackageResult,
} from './types';
import { SkillsAnalyzer } from './analyzer';
import { PluginGenerator } from './generator';
import { PluginPackager } from './packager';
import type { Config } from '../config';
import * as path from 'path';
import chalk from 'chalk';

export class SkillsCreator {
  private config: Config;
  private projectRoot: string;
  private options: SkillsCreatorConfig;

  constructor(config: Config, projectRoot: string, options: SkillsCreatorConfig = {}) {
    this.config = config;
    this.projectRoot = projectRoot;

    // Merge with default options
    this.options = {
      defaultTemplate: 'basic',
      defaultOutDir: path.join(process.cwd(), 'plugins'),
      autoTest: false,
      initGit: false,
      verbose: false,
      ...options,
    };
  }

  /**
   * Create plugin from chat history
   */
  async createFromChat(
    messages: ChatMessage[],
    outputDir?: string
  ): Promise<PackageResult> {
    console.log(chalk.cyan('\n🎨 Skills Creator: Creating from Chat History\n'));

    // Analyze chat
    const analyzer = new SkillsAnalyzer(this.config, this.projectRoot);
    const analysis = await analyzer.analyzeChatHistory(messages);

    if (analysis.confidence < 0.5) {
      console.warn(chalk.yellow('\n⚠️  Low confidence in analysis. Consider providing requirements manually.\n'));
      console.warn(chalk.yellow('Missing:'), analysis.missing.join(', '));
    }

    // Generate plugin
    const generator = new PluginGenerator(this.config, this.projectRoot);
    const options: PluginGenerationOptions = {
      template: this.options.defaultTemplate,
      includeTypes: true,
      includeTests: true,
      includeReadme: true,
      includeResources: true,  // NEW: Generate resource files
      outDir: outputDir || this.options.defaultOutDir,
    };

    const generationResult = await generator.generate(analysis.requirements, options);

    // Show warnings
    if (generationResult.warnings) {
      console.warn(chalk.yellow('\n⚠️  Warnings:'));
      for (const warning of generationResult.warnings) {
        console.warn(chalk.yellow(`  - ${warning}`));
      }
    }

    // Package plugin
    const outDir = outputDir || path.join(this.options.defaultOutDir!, analysis.requirements.name);
    const packager = new PluginPackager();
    const packageResult = await packager.package(generationResult, outDir);

    console.log(chalk.cyan('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📦 Package Result:\n'));
    console.log(packageResult.output);

    // Run tests if enabled
    if (this.options.autoTest) {
      console.log(chalk.cyan('\n🧪 Running Tests...\n'));
      const testResult = await packager.test(outDir);

      if (testResult.passed) {
        console.log(chalk.green('✅ All tests passed!'));
      } else {
        console.log(chalk.yellow('⚠️  Some tests failed'));
      }
    }

    // Initialize git if enabled
    if (this.options.initGit) {
      console.log(chalk.cyan('\n📝 Initializing Git...\n'));
      await packager.initGit(outDir);
      console.log(chalk.green('✅ Git repository initialized'));
    }

    // Show next steps
    console.log(chalk.cyan('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📋 Next Steps:\n'));
    for (const step of generationResult.nextSteps) {
      console.log(chalk.gray(`  ${step}`));
    }
    console.log();

    return packageResult;
  }

  /**
   * Create plugin from requirement description
   */
  async createFromRequirement(
    requirement: string | PluginRequirement,
    outputDir?: string
  ): Promise<PackageResult> {
    console.log(chalk.cyan('\n🎨 Skills Creator: Creating from Requirement\n'));

    // Analyze requirement
    const analyzer = new SkillsAnalyzer(this.config, this.projectRoot);

    let analysisResult;
    if (typeof requirement === 'string') {
      analysisResult = await analyzer.analyzeRequirement(requirement);
    } else {
      analysisResult = {
        requirements: requirement,
        confidence: 1.0,
        missing: [],
        suggestions: [],
        excerpts: [],
      };
    }

    // Get suggestions
    const suggestions = analyzer.suggestImprovements(analysisResult.requirements);
    if (suggestions.length > 0) {
      console.warn(chalk.yellow('\n💡 Suggestions:'));
      for (const suggestion of suggestions) {
        console.warn(chalk.yellow(`  - ${suggestion}`));
      }
    }

    // Generate plugin
    const generator = new PluginGenerator(this.config, this.projectRoot);
    const options: PluginGenerationOptions = {
      template: this.options.defaultTemplate,
      includeTypes: true,
      includeTests: true,
      includeReadme: true,
      includeResources: true,  // NEW: Generate resource files
      outDir: outputDir || this.options.defaultOutDir,
      interactive: this.options.interactive,  // NEW: Pass through interactive option
    };

    // Use interactive or standard generation based on option
    const generationResult = options.interactive
      ? await generator.generateInteractive(analysisResult.requirements, options)
      : await generator.generate(analysisResult.requirements, options);

    // Package plugin
    const outDir = outputDir || path.join(this.options.defaultOutDir!, analysisResult.requirements.name);
    const packager = new PluginPackager();
    const packageResult = await packager.package(generationResult, outDir);

    console.log(chalk.cyan('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📦 Package Result:\n'));
    console.log(packageResult.output);

    // Show next steps
    console.log(chalk.cyan('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📋 Next Steps:\n'));
    for (const step of generationResult.nextSteps) {
      console.log(chalk.gray(`  ${step}`));
    }
    console.log();

    return packageResult;
  }

  /**
   * Create plugin interactively
   */
  async createInteractive(outputDir?: string): Promise<PackageResult> {
    const inquirer = (await import('inquirer')).default;

    console.log(chalk.cyan('\n🎨 Skills Creator: Interactive Mode\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Plugin name:',
        validate: (input: string) => input.length > 0 || 'Plugin name is required',
      },
      {
        type: 'input',
        name: 'description',
        message: 'Plugin description:',
        validate: (input: string) => input.length > 0 || 'Description is required',
      },
      {
        type: 'list',
        name: 'template',
        message: 'Choose template:',
        choices: [
          { name: 'basic - Simple utility plugin (default)', value: 'basic' },
          { name: 'transformer - Data transformation/conversion plugin', value: 'transformer' },
          { name: 'analyzer - Code analysis/introspection plugin', value: 'analyzer' },
          { name: 'integrator - Third-party API integration plugin', value: 'integrator' },
          { name: 'custom - Start from scratch', value: 'custom' },
        ],
        default: 'basic',
      },
      {
        type: 'confirm',
        name: 'includeTests',
        message: 'Include test files?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'includeReadme',
        message: 'Include README?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'addTools',
        message: 'Add tools now?',
        default: true,
      },
    ]);

    let tools: any[] = [];

    if (answers.addTools) {
      const toolAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'toolName',
          message: 'Tool name (leave empty to skip):',
        },
        {
          type: 'input',
          name: 'toolDescription',
          message: 'Tool description:',
          when: (answers: any) => answers.toolName.length > 0,
        },
        {
          type: 'list',
          name: 'toolCategory',
          message: 'Tool category:',
          choices: ['utility', 'analysis', 'transformation', 'integration'],
          when: (answers: any) => answers.toolName.length > 0,
          default: 'utility',
        },
      ]);

      if (toolAnswers.toolName) {
        tools.push({
          name: toolAnswers.toolName,
          description: toolAnswers.toolDescription,
          category: toolAnswers.toolCategory,
          permissions: ['read_only'],
        });
      }
    }

    const requirement: PluginRequirement = {
      name: answers.name,
      description: answers.description,
      version: '1.0.0',
      tools,
    };

    const options: PluginGenerationOptions = {
      template: answers.template,
      includeTests: answers.includeTests,
      includeReadme: answers.includeReadme,
      outDir: outputDir || this.options.defaultOutDir,
    };

    const generator = new PluginGenerator(this.config, this.projectRoot);
    const generationResult = await generator.generate(requirement, options);

    const outDir = outputDir || path.join(this.options.defaultOutDir!, requirement.name);
    const packager = new PluginPackager();
    const packageResult = await packager.package(generationResult, outDir);

    console.log(chalk.cyan('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📦 Package Result:\n'));
    console.log(packageResult.output);

    return packageResult;
  }

  /**
   * Update configuration
   */
  updateConfig(options: Partial<SkillsCreatorConfig>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current configuration
   */
  getConfig(): SkillsCreatorConfig {
    return { ...this.options };
  }
}

// Export types and classes
export * from './types';
export { SkillsAnalyzer } from './analyzer';
export { PluginGenerator } from './generator';
export { PluginPackager } from './packager';
