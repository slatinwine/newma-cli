/**
 * Enhanced Skills Creator
 * Integrates with the new skill system (metadata, validation, progressive loading, testing)
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';

// Import skill system components
import {
  // Metadata
  SkillMetadata,
  validateMetadata,
  exportFrontmatter,
  extractMetadata,

  // Templates
  SkillTemplateType,
  getTemplate,
  listTemplates,
  generateKnowledgeSkill,
  generateCodeSkill,
  generateHybridSkill,
  generateDataProcessingSkill,
  generateApiIntegrationSkill,

  // Validation
  validateSchema,
  formatValidationErrors,

  // Testing
  generateTestFile,
  generateTestsFromMetadata,

  // Complexity
  analyzeComplexity,

  // Discovery
  calculateSkillScore,
} from '../skills/index';

export interface EnhancedSkillOptions {
  name: string;
  description: string;
  type: 'knowledge' | 'code' | 'hybrid';
  template: SkillTemplateType;
  category: string;
  complexity: number;
  tags: string[];
  triggers: string[];
  whenToUse: string[];
  author: string;
  version: string;

  // Progressive loading
  enableProgressiveLoading: boolean;
  referenceSections: string[];

  // Validation
  inputSchema?: any;
  outputSchema?: any;

  // Testing
  generateTests: boolean;
  testFramework: 'jest' | 'mocha' | 'jasmine';
}

export interface SkillCreationResult {
  success: boolean;
  skillPath: string;
  metadata: SkillMetadata;
  files: string[];
  validation: {
    metadataValid: boolean;
    errors: string[];
    warnings: string[];
  };
  tests: {
    generated: boolean;
    testPath: string;
    testCount: number;
  };
}

/**
 * Enhanced Skills Creator
 */
export class EnhancedSkillsCreator {
  /**
   * Interactive skill creation wizard
   */
  async createInteractive(): Promise<void> {
    console.log(chalk.cyan('\n🎨 Enhanced Skill Creation Wizard\n'));
    console.log(chalk.gray('This wizard will help you create a new skill with the enhanced skill system.\n'));

    // Step 1: Basic Information
    console.log(chalk.bold('Step 1: Basic Information'));
    const basicInfo = await this.promptBasicInfo();

    // Step 2: Skill Type
    console.log(chalk.bold('\nStep 2: Skill Type'));
    const typeInfo = await this.promptSkillType();

    // Step 3: Discovery Settings
    console.log(chalk.bold('\nStep 3: Discovery Settings'));
    const discoveryInfo = await this.promptDiscoverySettings();

    // Step 4: Progressive Loading
    console.log(chalk.bold('\nStep 4: Progressive Loading'));
    const progressiveInfo = await this.promptProgressiveLoading(typeInfo.type || 'knowledge');

    // Step 5: Validation (for code/hybrid skills)
    let validationInfo = {};
    if (typeInfo.type === 'code' || typeInfo.type === 'hybrid') {
      console.log(chalk.bold('\nStep 5: Validation'));
      validationInfo = await this.promptValidation();
    }

    // Step 6: Testing
    console.log(chalk.bold('\nStep 6: Testing'));
    const testingInfo = await this.promptTesting();

    // Step 7: Review and Confirm
    console.log(chalk.bold('\nStep 7: Review'));
    const confirmed = await this.promptReview({
      ...basicInfo,
      ...typeInfo,
      ...discoveryInfo,
      ...progressiveInfo,
      ...validationInfo,
      ...testingInfo,
    });

    if (!confirmed) {
      console.log(chalk.yellow('\n⚠️  Skill creation cancelled.\n'));
      return;
    }

    // Step 8: Generate Skill
    console.log(chalk.bold('\nStep 8: Generating Skill...\n'));
    const result = await this.generateSkill({
      ...basicInfo,
      ...typeInfo,
      ...discoveryInfo,
      ...progressiveInfo,
      ...validationInfo,
      ...testingInfo,
    } as EnhancedSkillOptions);

    this.displayResult(result);
  }

  /**
   * Prompt for basic information
   */
  private async promptBasicInfo(): Promise<Partial<EnhancedSkillOptions>> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Skill name:',
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Name is required';
          }
          if (!/^[a-zA-Z0-9\s-]+$/.test(input)) {
            return 'Name can only contain letters, numbers, spaces, and hyphens';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Skill description (1-2 sentences):',
        validate: (input: string) => input.trim().length > 0,
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author name:',
        default: () => {
          try {
            return require('os').userInfo().username;
          } catch {
            return 'Unknown';
          }
        },
      },
      {
        type: 'input',
        name: 'version',
        message: 'Version:',
        default: '1.0.0',
        validate: (input: string) => /^\d+\.\d+\.\d+$/.test(input),
      },
    ]);

    return answers;
  }

  /**
   * Prompt for skill type
   */
  private async promptSkillType(): Promise<Partial<EnhancedSkillOptions>> {
    const templates = listTemplates();

    const { type } = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'What type of skill do you want to create?',
        choices: [
          { name: '📚 Knowledge - Pure markdown guidance (no code)', value: 'knowledge' },
          { name: '⚙️ Code - Executable TypeScript with tools', value: 'code' },
          { name: '🔀 Hybrid - Both guidance and execution', value: 'hybrid' },
        ],
      },
    ]);

    let templateChoices = templates;
    if (type === 'knowledge') {
      templateChoices = templates.filter(t => t.type === 'knowledge');
    } else if (type === 'code') {
      templateChoices = templates.filter(t => t.type === 'code' || t.type === 'data-processing' || t.type === 'api-integration');
    }

    const { template } = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Choose a template:',
        choices: templateChoices.map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.type,
        })),
      },
    ]);

    const { category } = await inquirer.prompt([
      {
        type: 'input',
        name: 'category',
        message: 'Category (e.g., documentation, utility, integration):',
        default: 'general',
      },
    ]);

    const { complexity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'complexity',
        message: 'Complexity (1-10):',
        default: 5,
        validate: (input: number) => input >= 1 && input <= 10,
      },
    ]);

    return { type, template, category, complexity };
  }

  /**
   * Prompt for discovery settings
   */
  private async promptDiscoverySettings(): Promise<Partial<EnhancedSkillOptions>> {
    const { tags } = await inquirer.prompt([
      {
        type: 'input',
        name: 'tags',
        message: 'Tags (comma-separated):',
        filter: (input: string) => input.split(',').map(t => t.trim()).filter(t => t),
        validate: (input: string[]) => input.length > 0,
      },
    ]);

    const { triggers } = await inquirer.prompt([
      {
        type: 'input',
        name: 'triggers',
        message: 'Trigger phrases (comma-separated, e.g., create pdf, generate report):',
        filter: (input: string) => input.split(',').map(t => t.trim()).filter(t => t),
        validate: (input: string[]) => input.length > 0,
      },
    ]);

    const whenToUseAnswer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addWhenToUse',
        message: 'Add usage scenarios?',
        default: true,
      },
    ]);

    let whenToUse: string[] = [];
    if (whenToUseAnswer.addWhenToUse) {
      const { whenToUseInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'whenToUseInput',
          message: 'Usage scenarios (one per line, empty line to finish):',
          default: 'User needs this skill\n',
        },
      ]);

      whenToUse = whenToUseInput
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
    }

    return { tags, triggers, whenToUse };
  }

  /**
   * Prompt for progressive loading
   */
  private async promptProgressiveLoading(type: string): Promise<Partial<EnhancedSkillOptions>> {
    const { enableProgressiveLoading } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableProgressiveLoading',
        message: 'Enable progressive loading (load sections on-demand)?',
        default: type === 'knowledge' || type === 'hybrid',
      },
    ]);

    let referenceSections: string[] = [];
    if (enableProgressiveLoading) {
      const { sectionsInput } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'sectionsInput',
          message: 'Select reference sections:',
          choices: [
            { name: 'basics', checked: true },
            { name: 'advanced', checked: false },
            { name: 'examples', checked: false },
            { name: 'troubleshooting', checked: false },
            { name: 'workflows', checked: false },
          ],
        },
      ]);

      referenceSections = sectionsInput;
    }

    return { enableProgressiveLoading, referenceSections };
  }

  /**
   * Prompt for validation settings
   */
  private async promptValidation(): Promise<Partial<EnhancedSkillOptions>> {
    const { addValidation } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addValidation',
        message: 'Add input/output validation schemas?',
        default: true,
      },
    ]);

    if (!addValidation) {
      return {};
    }

    console.log(chalk.yellow('\nNote: You can add schemas later. For now, we\'ll create placeholder schemas.\n'));

    return {
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
    };
  }

  /**
   * Prompt for testing settings
   */
  private async promptTesting(): Promise<Partial<EnhancedSkillOptions>> {
    const { generateTests } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'generateTests',
        message: 'Generate automated tests?',
        default: true,
      },
    ]);

    if (!generateTests) {
      return { generateTests: false, testFramework: 'jest' };
    }

    const { testFramework } = await inquirer.prompt([
      {
        type: 'list',
        name: 'testFramework',
        message: 'Test framework:',
        choices: ['jest', 'mocha', 'jasmine'],
        default: 'jest',
      },
    ]);

    return { generateTests, testFramework };
  }

  /**
   * Review and confirm
   */
  private async promptReview(options: any): Promise<boolean> {
    console.log(chalk.cyan('\n📋 Skill Configuration Summary\n'));
    console.log(chalk.bold('Basic Information:'));
    console.log(`  Name: ${chalk.white(options.name)}`);
    console.log(`  Description: ${chalk.white(options.description)}`);
    console.log(`  Type: ${chalk.white(options.type)}`);
    console.log(`  Template: ${chalk.white(options.template)}`);
    console.log(`  Category: ${chalk.white(options.category)}`);
    console.log(`  Complexity: ${chalk.white(options.complexity)}`);
    console.log(`  Author: ${chalk.white(options.author)}`);
    console.log(`  Version: ${chalk.white(options.version)}`);

    console.log(chalk.bold('\nDiscovery:'));
    console.log(`  Tags: ${chalk.green(options.tags.join(', '))}`);
    console.log(`  Triggers: ${chalk.yellow(options.triggers.join(', '))}`);
    console.log(`  When to use: ${options.whenToUse.length > 0 ? chalk.white(options.whenToUse.join(', ')) : chalk.gray('Not specified')}`);

    console.log(chalk.bold('\nProgressive Loading:'));
    console.log(`  Enabled: ${options.enableProgressiveLoading ? chalk.green('Yes') : chalk.red('No')}`);
    if (options.enableProgressiveLoading && options.referenceSections.length > 0) {
      console.log(`  Sections: ${chalk.white(options.referenceSections.join(', '))}`);
    }

    if (options.type === 'code' || options.type === 'hybrid') {
      console.log(chalk.bold('\nValidation:'));
      console.log(`  Schemas: ${options.inputSchema ? chalk.green('Yes') : chalk.gray('No')}`);
    }

    console.log(chalk.bold('\nTesting:'));
    console.log(`  Generate tests: ${options.generateTests ? chalk.green('Yes') : chalk.red('No')}`);
    if (options.generateTests) {
      console.log(`  Framework: ${chalk.white(options.testFramework)}`);
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: '\nCreate this skill?',
        default: true,
      },
    ]);

    return confirmed;
  }

  /**
   * Generate the skill
   */
  async generateSkill(options: EnhancedSkillOptions): Promise<SkillCreationResult> {
    const skillId = options.name.toLowerCase().replace(/\s+/g, '-');
    const skillPath = path.join(process.cwd(), 'skills', skillId);

    // Create skill directory
    await fs.mkdir(skillPath, { recursive: true });

    // Generate metadata
    const metadata: SkillMetadata = {
      id: skillId,
      name: options.name,
      version: options.version,
      description: options.description,
      type: options.type,
      category: options.category,
      complexity: options.complexity as any, // Type cast needed: number to SkillComplexity
      tags: options.tags,
      keywords: options.tags || [], // Use tags as keywords default
      triggers: options.triggers,
      whenToUse: options.whenToUse,
      author: options.author,
      license: 'MIT',
      inputSchema: options.inputSchema,
      outputSchema: options.outputSchema,
    };

    // Validate metadata
    const metadataValidation = validateMetadata(metadata);

    // Generate skill content based on template
    let skillMd: string = '';
    let codeTs: string | undefined;
    let references: Record<string, string> = {};

    switch (options.template) {
      case SkillTemplateType.KNOWLEDGE:
        const knowledgeResult = generateKnowledgeSkill(options);
        skillMd = knowledgeResult.skillMd;
        references = knowledgeResult.references;
        break;

      case SkillTemplateType.CODE:
        const codeResult = generateCodeSkill(options);
        skillMd = codeResult.skillMd;
        codeTs = codeResult.codeTs;
        break;

      case SkillTemplateType.HYBRID:
        const hybridResult = generateHybridSkill(options);
        skillMd = hybridResult.skillMd;
        codeTs = hybridResult.codeTs;
        references = hybridResult.references;
        break;

      case SkillTemplateType.DATA_PROCESSING:
        const dataResult = generateDataProcessingSkill(options);
        skillMd = dataResult.skillMd;
        codeTs = dataResult.codeTs;
        break;

      case SkillTemplateType.API_INTEGRATION:
        const apiResult = generateApiIntegrationSkill(options);
        skillMd = apiResult.skillMd;
        codeTs = apiResult.codeTs;
        break;
    }

    // Write files
    const files: string[] = [];

    // Write SKILL.md
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    await fs.writeFile(skillMdPath, skillMd, 'utf-8');
    files.push(skillMdPath);

    // Write code.ts if applicable
    if (codeTs) {
      const codeTsPath = path.join(skillPath, 'code.ts');
      await fs.writeFile(codeTsPath, codeTs, 'utf-8');
      files.push(codeTsPath);
    }

    // Write reference sections
    if (options.enableProgressiveLoading && Object.keys(references).length > 0) {
      const refsPath = path.join(skillPath, 'references');
      await fs.mkdir(refsPath, { recursive: true });

      for (const [name, content] of Object.entries(references)) {
        const refPath = path.join(refsPath, `${name}.md`);
        await fs.writeFile(refPath, content, 'utf-8');
        files.push(refPath);
      }
    }

    // Generate tests
    let testPath = '';
    let testCount = 0;
    if (options.generateTests) {
      const testFile = generateTestFile(metadata, {
        framework: options.testFramework,
      });

      testPath = path.join(skillPath, `${skillId}.test.ts`);
      await fs.writeFile(testPath, testFile, 'utf-8');
      files.push(testPath);
      testCount = generateTestsFromMetadata(metadata).length;
    }

    return {
      success: metadataValidation.valid,
      skillPath,
      metadata,
      files,
      validation: {
        metadataValid: metadataValidation.valid,
        errors: metadataValidation.errors.map(e => `${e.field}: ${e.message}`),
        warnings: metadataValidation.warnings.map(w => `${w.field}: ${w.message}`),
      },
      tests: {
        generated: options.generateTests,
        testPath,
        testCount,
      },
    };
  }

  /**
   * Display creation result
   */
  private displayResult(result: SkillCreationResult): void {
    console.log(chalk.cyan('\n✅ Skill Created Successfully!\n'));

    console.log(chalk.bold('📍 Location:'));
    console.log(`  ${chalk.white(result.skillPath)}`);

    console.log(chalk.bold('\n📄 Files Created:'));
    result.files.forEach(file => {
      const relPath = path.relative(process.cwd(), file);
      console.log(`  ${chalk.green('✓')} ${relPath}`);
    });

    console.log(chalk.bold('\n✅ Validation:'));
    if (result.validation.metadataValid) {
      console.log(`  ${chalk.green('✓')} Metadata is valid`);
    } else {
      console.log(`  ${chalk.red('✗')} Metadata has errors`);
      result.validation.errors.forEach(err => {
        console.log(`    ${chalk.red('•')} ${err}`);
      });
    }

    if (result.validation.warnings.length > 0) {
      console.log(chalk.bold('\n⚠️  Warnings:'));
      result.validation.warnings.forEach(warn => {
        console.log(`  ${chalk.yellow('⚠')} ${warn}`);
      });
    }

    if (result.tests.generated) {
      console.log(chalk.bold('\n🧪 Tests:'));
      console.log(`  ${chalk.green('✓')} Generated ${chalk.white(result.tests.testCount.toString())} tests`);
      console.log(`  ${chalk.white('→')} ${path.relative(process.cwd(), result.tests.testPath)}`);
    }

    console.log(chalk.bold('\n📊 Metadata:'));
    console.log(`  ID: ${chalk.cyan(result.metadata.id)}`);
    console.log(`  Name: ${chalk.white(result.metadata.name)}`);
    console.log(`  Type: ${chalk.white(result.metadata.type)}`);
    console.log(`  Complexity: ${chalk.white(result.metadata.complexity.toString())}`);

    console.log(chalk.bold('\n🎯 Next Steps:'));
    console.log(`  1. Review the generated files`);
    console.log(`  2. Customize the skill content`);
    console.log(`  3. Run tests: ${chalk.yellow('npm test')}`);
    console.log(`  4. Validate: ${chalk.yellow('kode-validate-skill validate ' + result.skillPath)}`);

    console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
  }
}
