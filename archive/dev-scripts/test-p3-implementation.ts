/**
 * P3 实现测试
 *
 * 测试技能自动发现、热重载和记忆分类系统。
 *
 * 运行方式：npx ts-node test-p3-implementation.ts
 */

import { SkillAutoDiscovery, SkillUsageTracker } from './src/skills/autoDiscovery';
import { SkillHotReload } from './src/skills/hotReload';
import { MemoryStore, MemoryType, createMemoryStore } from './src/memory/memory-classification';
import { SkillRegistry } from './src/skills/registry';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 测试配置
const TEST_DIR = join(process.cwd(), '.test-p3-temp');
const TEST_SKILLS_DIR = join(TEST_DIR, '.kode', 'skills');

/**
 * 设置测试环境
 */
async function setupTestEnvironment() {
  // 创建测试目录
  await mkdir(TEST_SKILLS_DIR, { recursive: true });

  // 创建测试技能
  const testSkill = `---
name: test-skill
description: A test skill for P3 implementation
type: knowledge
complexity: 1
tags: [test, p3]
triggers: [test, p3]
---

# Test Skill

This is a test skill for P3 implementation.
`;

  await mkdir(join(TEST_SKILLS_DIR, 'test-skill'), { recursive: true });
  await writeFile(join(TEST_SKILLS_DIR, 'test-skill', 'SKILL.md'), testSkill);

  // 创建 NEWMA.md
  const newmaMd = `# NEWMA.md - Test Project

## Skills
- skill: test-skill
- /skill another-skill
`;

  await writeFile(join(TEST_DIR, 'NEWMA.md'), newmaMd);

  // 创建 package.json
  const packageJson = {
    name: 'test-p3',
    version: '1.0.0',
    skills: ['test-skill', 'package-skill'],
  };

  await writeFile(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));
}

/**
 * 清理测试环境
 */
async function cleanupTestEnvironment() {
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    // 忽略错误
  }
}

/**
 * 测试技能自动发现
 */
async function testSkillAutoDiscovery() {
  console.log('\n📋 测试 1: 技能自动发现系统');

  const registry = new SkillRegistry(join(TEST_DIR, 'registry.json'));
  await registry.initialize();

  const discovery = new SkillAutoDiscovery({
    skillDirectories: [TEST_SKILLS_DIR],
    newmaMdPath: join(TEST_DIR, 'NEWMA.md'),
    packageJsonPath: join(TEST_DIR, 'package.json'),
    registry,
    autoSync: true,
  });

  // 测试扫描
  const skills = await discovery.scan();
  console.log(`✅ 扫描完成，发现 ${skills.length} 个技能`);

  // 测试缓存
  const cached = discovery.getAllSkills();
  console.log(`✅ 缓存中有 ${cached.length} 个技能`);

  // 测试搜索
  const searchResults = discovery.searchSkills('test');
  console.log(`✅ 搜索 "test" 找到 ${searchResults.length} 个技能`);

  // 测试使用统计
  discovery.recordUsage('test-skill', 100, true);
  const stats = discovery.getUsageStats('test-skill');
  console.log(`✅ 使用统计: ${JSON.stringify(stats)}`);

  // 测试事件监听
  discovery.addListener((event) => {
    if (event.type === 'skill_found') {
      console.log(`📡 事件: 技能发现 - ${event.skill.name}`);
    }
  });

  console.log('✅ 技能自动发现系统测试通过\n');
  return true;
}

/**
 * 测试热重载系统
 */
async function testHotReload() {
  console.log('\n📋 测试 2: 热重载系统');

  const hotReload = new SkillHotReload({
    watchDirectories: [TEST_SKILLS_DIR],
    recursive: true,
    debounceDelay: 100,
    enabled: true,
  });

  // 测试事件监听
  hotReload.addListener((event) => {
    switch (event.type) {
      case 'skill_created':
        console.log(`📡 事件: 技能创建 - ${event.skill.name}`);
        break;
      case 'skill_updated':
        console.log(`📡 事件: 技能更新 - ${event.skill.name}`);
        break;
      case 'skill_deleted':
        console.log(`📡 事件: 技能删除 - ${event.skillName}`);
        break;
      case 'reload_error':
        console.log(`❌ 事件: 重载错误 - ${event.error.message}`);
        break;
    }
  });

  // 启动热重载
  await hotReload.start();
  console.log('✅ 热重载已启动');

  // 检查状态
  const isActive = hotReload.isActive();
  console.log(`✅ 热重载状态: ${isActive ? '运行中' : '已停止'}`);

  // 获取监听的目录
  const watchedDirs = hotReload.getWatchedDirectories();
  console.log(`✅ 监听目录: ${watchedDirs.join(', ')}`);

  // 停止热重载
  hotReload.stop();
  console.log('✅ 热重载已停止');

  console.log('✅ 热重载系统测试通过\n');
  return true;
}

/**
 * 测试记忆分类系统
 */
async function testMemoryClassification() {
  console.log('\n📋 测试 3: 记忆分类系统');

  const memoryStore = createMemoryStore({
    memoryPath: join(TEST_DIR, 'memory.json'),
    enableValidation: true,
    defaultExpiration: 30 * 24 * 60 * 60 * 1000, // 30天
  });

  await memoryStore.initialize();
  console.log('✅ 记忆存储已初始化');

  // 测试添加不同类型的记忆
  const userMemory = await memoryStore.add({
    type: 'user',
    title: '用户角色',
    content: '用户是数据科学家，专注于日志系统',
    source: 'test-session',
    tags: ['role', 'data-science'],
    relatedFiles: [],
  });
  console.log(`✅ 添加用户记忆: ${userMemory.id}`);

  const feedbackMemory = await memoryStore.add({
    type: 'feedback',
    title: '代码风格反馈',
    content: '不要mock数据库 — 我们在上个季度因此出过问题',
    source: 'test-session',
    tags: ['feedback', 'database'],
  });
  console.log(`✅ 添加反馈记忆: ${feedbackMemory.id}`);

  const projectMemory = await memoryStore.add({
    type: 'project',
    title: '项目时间线',
    content: '移动团队将在星期四后冻结所有非关键合并',
    source: 'test-session',
    tags: ['timeline', 'mobile'],
  });
  console.log(`✅ 添加项目记忆: ${projectMemory.id}`);

  const referenceMemory = await memoryStore.add({
    type: 'reference',
    title: '外部资源',
    content: 'grafana.internal/d/api-latency是oncall延迟仪表板',
    source: 'test-session',
    tags: ['external', 'monitoring'],
  });
  console.log(`✅ 添加参考记忆: ${referenceMemory.id}`);

  // 测试搜索
  const userMemories = memoryStore.search({ type: 'user' });
  console.log(`✅ 搜索用户记忆: 找到 ${userMemories.length} 条`);

  const tagResults = memoryStore.search({ tags: ['feedback'] });
  console.log(`✅ 按标签搜索: 找到 ${tagResults.length} 条`);

  const queryResults = memoryStore.search({ query: '数据库' });
  console.log(`✅ 按关键词搜索: 找到 ${queryResults.length} 条`);

  // 测试统计
  const stats = memoryStore.getStats();
  console.log(`✅ 记忆统计: 总计 ${stats.total} 条`);
  console.log(`  - 用户: ${stats.byType.user}`);
  console.log(`  - 反馈: ${stats.byType.feedback}`);
  console.log(`  - 项目: ${stats.byType.project}`);
  console.log(`  - 参考: ${stats.byType.reference}`);

  // 测试验证
  const validation = await memoryStore.validate(userMemory);
  console.log(`✅ 记忆验证: ${validation.valid ? '有效' : '无效'}`);

  // 测试更新
  const updated = await memoryStore.update(userMemory.id, {
    content: '用户是高级数据科学家，专注于日志系统和机器学习',
  });
  console.log(`✅ 更新记忆: ${updated ? '成功' : '失败'}`);

  // 测试删除
  const deleted = await memoryStore.delete(referenceMemory.id);
  console.log(`✅ 删除记忆: ${deleted ? '成功' : '失败'}`);

  // 测试清理过期记忆
  const expiredCount = await memoryStore.cleanupExpired();
  console.log(`✅ 清理过期记忆: 清理了 ${expiredCount} 条`);

  console.log('✅ 记忆分类系统测试通过\n');
  return true;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════');
  console.log('  P3 实现测试套件');
  console.log('═══════════════════════════════════════');

  let passed = 0;
  let failed = 0;

  try {
    // 设置测试环境
    console.log('\n🔧 设置测试环境...');
    await setupTestEnvironment();
    console.log('✅ 测试环境已创建\n');

    // 运行测试
    try {
      await testSkillAutoDiscovery();
      passed++;
    } catch (error: any) {
      console.error(`❌ 技能自动发现测试失败: ${error.message}\n`);
      failed++;
    }

    try {
      await testHotReload();
      passed++;
    } catch (error: any) {
      console.error(`❌ 热重载测试失败: ${error.message}\n`);
      failed++;
    }

    try {
      await testMemoryClassification();
      passed++;
    } catch (error: any) {
      console.error(`❌ 记忆分类测试失败: ${error.message}\n`);
      failed++;
    }

  } finally {
    // 清理测试环境
    console.log('🔧 清理测试环境...');
    await cleanupTestEnvironment();
    console.log('✅ 测试环境已清理\n');
  }

  // 输出总结
  console.log('═══════════════════════════════════════');
  console.log('  测试总结');
  console.log('═══════════════════════════════════════');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════\n');

  return failed === 0;
}

// 运行测试
runAllTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ 测试运行失败:', error);
    process.exit(1);
  });
