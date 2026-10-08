/**
 * Precipitation System Test
 *
 * 测试经验自动沉淀系统的核心功能
 */

import { MemoryScheduler } from './src/memory/scheduler';
import { SkillDraftManager } from './src/memory/skill-draft-manager';
import { SkillGenerator } from './src/memory/skill-generator';
import {
  SkillSuggestion,
  DraftStatus,
  GeneratorOptions,
} from './src/memory/types-precipitation';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

// 测试配置
const TEST_PROJECT_ROOT = process.cwd();
const TEST_DRAFTS_DIR = join(TEST_PROJECT_ROOT, '.kode', 'skills', 'drafts');
const TEST_APPROVED_DIR = join(TEST_PROJECT_ROOT, '.kode', 'skills', 'approved');
const TEST_REJECTED_DIR = join(TEST_PROJECT_ROOT, '.kode', 'skills', 'rejected');

/**
 * 测试结果
 */
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const testResults: TestResult[] = [];

/**
 * 运行单个测试
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  console.log(chalk.cyan(`\n▶ Testing: ${name}`));

  try {
    await testFn();
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: true, duration });
    console.log(chalk.green(`✓ PASSED (${duration}ms)`));
  } catch (error: any) {
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: false, duration, error: error.message });
    console.log(chalk.red(`✗ FAILED (${duration}ms)`));
    console.log(chalk.red(`  Error: ${error.message}`));
  }
}

/**
 * 测试 1: 调度器基本功能
 */
async function testScheduler() {
  await runTest('Memory Scheduler - Basic Operations', async () => {
    const scheduler = new MemoryScheduler({
      config: {
        enabled: true,
        schedule: '0 2 * * *',
      },
    });

    // 测试启动
    await scheduler.start(async () => {
      // Callback function
    });

    // 测试状态
    const status = scheduler.getStatus();
    if (!status.isRunning) {
      throw new Error('Scheduler status shows not running');
    }

    // 测试下次执行时间
    const nextExecution = scheduler.getNextExecution();
    if (!nextExecution) {
      throw new Error('Next execution time is null');
    }

    console.log(chalk.gray(`  Next execution: ${nextExecution.toLocaleString()}`));

    // 测试停止
    scheduler.stop();

    const statusAfterStop = scheduler.getStatus();
    if (statusAfterStop.isRunning) {
      throw new Error('Scheduler did not stop');
    }

    console.log(chalk.gray('  ✓ Scheduler can start and stop correctly'));
  });
}

/**
 * 测试 2: 草稿管理器
 */
async function testDraftManager() {
  await runTest('Draft Manager - CRUD Operations', async () => {
    const draftManager = new SkillDraftManager(TEST_PROJECT_ROOT);

    // 初始化目录
    await draftManager.initialize();
    console.log(chalk.gray('  ✓ Directories initialized'));

    // 创建测试草稿
    const testSuggestion: SkillSuggestion = {
      id: 'test-skill-' + Date.now(),
      name: 'Test Skill',
      description: 'A test skill for unit testing',
      type: 'knowledge',
      complexity: 2,
      tags: ['test', 'demo'],
      confidence: 0.85,
      evidence: [
        {
          source: 'errors',
          description: 'Test error pattern',
          examples: ['Error 1', 'Error 2'],
          count: 2,
        },
      ],
      whenToUse: ['When testing', 'When demoing'],
      coreKnowledge: 'This is a test skill',
      examples: [
        {
          scenario: 'Test scenario',
          solution: 'Test solution',
        },
      ],
      generatedAt: new Date(),
    };

    // 使用 Generator 保存草稿
    const generatorOptions: GeneratorOptions = {
      saveAsDraft: true,
      targetDir: TEST_DRAFTS_DIR,
      includeMetadata: true,
    };

    const generator = new SkillGenerator(TEST_PROJECT_ROOT, generatorOptions);
    await generator.generate([testSuggestion]);

    console.log(chalk.gray('  ✓ Test draft created'));

    // 列出草稿
    const drafts = await draftManager.listDrafts();
    if (drafts.length === 0) {
      throw new Error('No drafts found');
    }

    console.log(chalk.gray(`  ✓ Found ${drafts.length} draft(s)`));

    // 查询单个草稿
    const draft = await draftManager.getDraft(drafts[0].id);
    if (!draft) {
      throw new Error('Failed to get draft');
    }

    console.log(chalk.gray(`  ✓ Retrieved draft: ${draft.suggestion.name}`));
    console.log(chalk.gray(`    Status: ${draft.status}`));

    // 批准草稿（注意：草稿会被移动到 approved 目录）
    await draftManager.approve(draft.id, 'Test approval');
    console.log(chalk.gray('  ✓ Draft approved (moved to approved directory)'));

    // 再次查询会失败（因为已移动），这是预期行为
    const approvedDraft = await draftManager.getDraft(draft.id);
    if (approvedDraft !== null) {
      // 如果仍然能找到，说明没有移动成功
      throw new Error('Draft should have been moved to approved directory');
    }

    console.log(chalk.gray('  ✓ Draft correctly moved (no longer in drafts directory)'));

    // 获取统计信息
    const stats = await draftManager.getStats();
    console.log(chalk.gray(`  ✓ Stats: ${stats.pending} pending, ${stats.approved} approved, ${stats.rejected} rejected`));
  });
}

/**
 * 测试 3: 技能生成器
 */
async function testSkillGenerator() {
  await runTest('Skill Generator - File Generation', async () => {
    const testSuggestions: SkillSuggestion[] = [
      {
        id: 'gen-test-001',
        name: 'Error Handling Best Practices',
        description: 'Common error handling patterns in Node.js',
        type: 'knowledge',
        complexity: 3,
        tags: ['error-handling', 'nodejs', 'best-practices'],
        confidence: 0.92,
        evidence: [
          {
            source: 'errors',
            description: 'Repeated try-catch patterns',
            examples: ['File operations', 'API calls'],
            count: 15,
          },
        ],
        whenToUse: ['Handling async operations', 'File I/O operations'],
        coreKnowledge: `
## Error Handling Principles

1. Always catch async errors
2. Use specific error types
3. Provide meaningful error messages
4. Log errors for debugging
        `,
        examples: [
          {
            scenario: 'Reading a file',
            solution: 'Use try-catch with fs.promises',
            code: 'try { const data = await readFile(path); } catch (error) { handleError(error); }',
          },
        ],
        generatedAt: new Date(),
      },
      {
        id: 'gen-test-002',
        name: 'Git Workflow Optimization',
        description: 'Efficient Git branching strategies',
        type: 'action',
        complexity: 2,
        tags: ['git', 'workflow', 'version-control'],
        confidence: 0.78,
        evidence: [
          {
            source: 'history',
            description: 'Repeated git command sequences',
            examples: ['Branch creation', 'Merge operations'],
            count: 8,
          },
        ],
        whenToUse: ['Starting new features', 'Managing releases'],
        coreKnowledge: `
## Git Branching Strategy

1. Use feature branches for development
2. Keep main branch stable
3. Use pull requests for code review
        `,
        examples: [
          {
            scenario: 'Starting a new feature',
            solution: 'Create a feature branch from develop',
            code: 'git checkout -b feature/my-feature develop',
          },
        ],
        generatedAt: new Date(),
      },
    ];

    const generatorOptions: GeneratorOptions = {
      saveAsDraft: true,
      targetDir: TEST_DRAFTS_DIR,
      includeMetadata: true,
    };

    const generator = new SkillGenerator(TEST_PROJECT_ROOT, generatorOptions);
    const result = await generator.generate(testSuggestions);

    if (result.skillsGenerated !== testSuggestions.length) {
      throw new Error(`Expected ${testSuggestions.length} skills, got ${result.skillsGenerated}`);
    }

    console.log(chalk.gray(`  ✓ Generated ${result.skillsGenerated} skill files`));
    console.log(chalk.gray(`  ✓ Duration: ${result.duration}ms`));

    // 验证文件生成
    const { existsSync } = require('fs');
    for (const filePath of result.filePaths) {
      if (!existsSync(filePath)) {
        throw new Error(`File not created: ${filePath}`);
      }
    }

    console.log(chalk.gray(`  ✓ All files verified`));
  });
}

/**
 * 测试 4: 集成测试（协调器）
 */
async function testCoordinator() {
  await runTest('Precipitation Coordinator - Integration', async () => {
    // 注意：这个测试需要真实的 AI API key
    // 如果没有配置，会跳过 AI 分析部分

    const { existsSync } = require('fs');
    const configPath = join(TEST_PROJECT_ROOT, 'settings.json');

    if (!existsSync(configPath)) {
      console.log(chalk.yellow('  ⚠ Skipping coordinator test (no settings.json)'));
      return;
    }

    console.log(chalk.gray('  ✓ Coordinator test requires full integration'));
    console.log(chalk.gray('  ✓ This test should be run manually with REPL integration'));
  });
}

/**
 * 测试 5: 配置验证
 */
async function testConfiguration() {
  await runTest('Configuration - Settings Loading', async () => {
    const { getPrecipitationConfig } = require('./src/config');

    const config = getPrecipitationConfig();

    console.log(chalk.gray('  Configuration loaded:'));
    console.log(chalk.gray(`    - Enabled: ${config.enabled !== false}`));
    console.log(chalk.gray(`    - Schedule: ${config.schedule || '0 2 * * *'}`));
    console.log(chalk.gray(`    - Confidence Threshold: ${config.confidenceThreshold || 0.6}`));
    console.log(chalk.gray(`    - Max Daily Skills: ${config.maxDailySkills || 5}`));
    console.log(chalk.gray(`    - Draft Retention: ${config.draftRetentionDays || 30} days`));
    console.log(chalk.gray(`    - Analysis Days: ${config.analysisDays || 7}`));

    console.log(chalk.gray('  ✓ Configuration loaded successfully'));
  });
}

/**
 * 打印测试摘要
 */
function printSummary() {
  console.log(chalk.bold('\n' + '='.repeat(60)));
  console.log(chalk.bold('📊 Test Summary'));
  console.log(chalk.bold('='.repeat(60) + '\n'));

  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  testResults.forEach((result) => {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? chalk.green : chalk.red;
    const status = result.passed ? 'PASSED' : 'FAILED';

    console.log(
      `${color(icon)} ${result.name} ${chalk.gray(`(${result.duration}ms)`)} - ${color(status)}`
    );

    if (!result.passed && result.error) {
      console.log(chalk.gray(`    Error: ${result.error}`));
    }
  });

  console.log(chalk.bold('\n' + '-'.repeat(60)));
  console.log(chalk.bold(`Total: ${testResults.length} tests`));
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  console.log(chalk.gray(`Duration: ${totalDuration}ms`));
  console.log(chalk.bold('='.repeat(60) + '\n'));

  if (failed === 0) {
    console.log(chalk.green.bold('🎉 All tests passed!\n'));
  } else {
    console.log(chalk.red.bold(`⚠️  ${failed} test(s) failed\n`));
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
  console.log(chalk.bold.cyan('🧪 Newma Precipitation System Test Suite'));
  console.log(chalk.bold.cyan('='.repeat(60) + '\n'));

  try {
    // 运行所有测试
    await testScheduler();
    await testConfiguration();

    // 需要先初始化目录
    await mkdir(TEST_DRAFTS_DIR, { recursive: true });
    await mkdir(TEST_APPROVED_DIR, { recursive: true });
    await mkdir(TEST_REJECTED_DIR, { recursive: true });

    await testDraftManager();
    await testSkillGenerator();
    await testCoordinator();

    // 打印摘要
    printSummary();

    // 返回退出码
    const failed = testResults.filter((r) => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error(chalk.red.bold('\n✗ Test suite failed:'));
    console.error(chalk.red(error.message));
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
main();
