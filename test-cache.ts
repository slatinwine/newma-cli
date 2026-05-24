#!/usr/bin/env npx ts-node
// test-cache.ts
/**
 * 智能缓存系统测试
 */

import { CacheManager, getGlobalCacheManager } from './src/cache/cache-manager';
import { AICache, getGlobalAICache, createAIRequest } from './src/cache/ai-cache';
import { Config } from './src/config';
import chalk from 'chalk';

async function testMemoryCache() {
  console.log(chalk.cyan('\n🧪 测试 1: 内存缓存\n'));

  const cache = new CacheManager({ diskEnabled: false });

  // 设置缓存
  console.log(chalk.gray('📝 设置缓存...'));
  await cache.set('key1', 'value1');
  await cache.set('key2', 'value2');
  await cache.set('key3', 'value3');

  // 获取缓存
  console.log(chalk.gray('📖 获取缓存...'));
  const value1 = await cache.get('key1');
  const value4 = await cache.get('key4');

  console.log(`   key1: ${value1}`); // 应该返回 'value1'
  console.log(`   key4: ${value4}`); // 应该返回 null

  // 统计信息
  const stats = cache.getStats();
  console.log(chalk.gray('\n📊 缓存统计:'));
  console.log(`   命中: ${stats.hits}`);
  console.log(`   未命中: ${stats.misses}`);
  console.log(`   命中率: ${(stats.hitRate * 100).toFixed(2)}%`);
  console.log(`   大小: ${stats.size}\n`);

  if (value1 === 'value1' && value4 === null && stats.hits === 1) {
    console.log(chalk.green('✅ 内存缓存测试通过\n'));
  } else {
    throw new Error('内存缓存测试失败');
  }
}

async function testDiskCache() {
  console.log(chalk.cyan('\n🧪 测试 2: 磁盘缓存\n'));

  const cache = new CacheManager({
    diskEnabled: true,
    diskCacheDir: '/tmp/kode-test-cache',
  });

  // 设置缓存
  console.log(chalk.gray('📝 设置缓存...'));
  await cache.set('disk-key1', 'disk-value1');
  await cache.set('disk-key2', 'disk-value2');

  // 等待写入
  await new Promise(resolve => setTimeout(resolve, 100));

  // 获取缓存
  console.log(chalk.gray('📖 获取缓存...'));
  const value1 = await cache.get('disk-key1');
  const value3 = await cache.get('disk-key3');

  console.log(`   disk-key1: ${value1}`); // 应该返回 'disk-value1'
  console.log(`   disk-key3: ${value3}`); // 应该返回 null

  if (value1 === 'disk-value1' && value3 === null) {
    console.log(chalk.green('✅ 磁盘缓存测试通过\n'));
  } else {
    throw new Error('磁盘缓存测试失败');
  }
}

async function testCacheExpiration() {
  console.log(chalk.cyan('\n🧪 测试 3: 缓存过期\n'));

  const cache = new CacheManager({ diskEnabled: false });

  // 设置短 TTL 的缓存
  console.log(chalk.gray('📝 设置缓存 (TTL: 500ms)...'));
  await cache.set('expire-key', 'expire-value', 500);

  // 立即获取（应该存在）
  const value1 = await cache.get('expire-key');
  console.log(`   立即获取: ${value1}`);

  // 等待过期
  console.log(chalk.gray('⏳ 等待 600ms...'));
  await new Promise(resolve => setTimeout(resolve, 600));

  // 再次获取（应该不存在）
  const value2 = await cache.get('expire-key');
  console.log(`   延迟获取: ${value2}`);

  if (value1 === 'expire-value' && value2 === null) {
    console.log(chalk.green('✅ 缓存过期测试通过\n'));
  } else {
    throw new Error('缓存过期测试失败');
  }
}

async function testLRUEviction() {
  console.log(chalk.cyan('\n🧪 测试 4: LRU 淘汰\n'));

  // 创建小容量缓存 (最多 3 个条目)
  const cache = new CacheManager({
    diskEnabled: false,
    memoryMaxEntries: 3,
  });

  // 设置 4 个条目（第 1 个应该被淘汰）
  console.log(chalk.gray('📝 设置 4 个条目 (容量: 3)...'));
  await cache.set('key1', 'value1');
  await cache.set('key2', 'value2');
  await cache.set('key3', 'value3');
  await cache.set('key4', 'value4'); // 应该淘汰 key1

  // 尝试获取 key1（应该不存在）
  const value1 = await cache.get('key1');
  const value4 = await cache.get('key4');

  console.log(`   key1: ${value1}`); // 应该返回 null
  console.log(`   key4: ${value4}`); // 应该返回 'value4'

  if (value1 === null && value4 === 'value4') {
    console.log(chalk.green('✅ LRU 淘汰测试通过\n'));
  } else {
    throw new Error('LRU 淘汰测试失败');
  }
}

async function testAICache() {
  console.log(chalk.cyan('\n🧪 测试 5: AI 响应缓存\n'));

  const aiCache = new AICache();

  const config: Config = {
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4',
  };

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is 2+2?' },
  ];

  const request = createAIRequest(config, messages);

  // 缓存响应
  console.log(chalk.gray('📝 缓存 AI 响应...'));
  await aiCache.set(request, 'The answer is 4.');

  // 获取缓存
  console.log(chalk.gray('📖 获取缓存响应...'));
  const cached = await aiCache.get(request);

  console.log(`   缓存内容: ${cached?.content}`);

  if (cached && cached.content === 'The answer is 4.') {
    console.log(chalk.green('✅ AI 缓存测试通过\n'));
  } else {
    throw new Error('AI 缓存测试失败');
  }
}

async function testCacheInvalidation() {
  console.log(chalk.cyan('\n🧪 测试 6: 缓存失效\n'));

  const cache = new CacheManager({ diskEnabled: false });

  // 设置多个缓存
  console.log(chalk.gray('📝 设置缓存...'));
  await cache.set('user:123:data', 'user1');
  await cache.set('user:456:data', 'user2');
  await cache.set('user:789:data', 'user3');
  await cache.set('other:key', 'value');

  // 失效用户数据
  console.log(chalk.gray('🗑️  失效用户数据缓存...'));
  const invalidated = await cache.invalidate(/user:.+:data/);

  console.log(`   失效条目数: ${invalidated}`);

  // 验证
  const user123 = await cache.get('user:123:data');
  const otherKey = await cache.get('other:key');

  console.log(`   user:123:data: ${user123}`); // 应该返回 null
  console.log(`   other:key: ${otherKey}`); // 应该返回 'value'

  if (user123 === null && otherKey === 'value' && invalidated === 3) {
    console.log(chalk.green('✅ 缓存失效测试通过\n'));
  } else {
    throw new Error('缓存失效测试失败');
  }
}

async function testPerformance() {
  console.log(chalk.cyan('\n🧪 测试 7: 性能对比\n'));

  const cache = new CacheManager({ diskEnabled: false });

  // 模拟慢操作
  async function slowOperation(key: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return `result-${key}`;
  }

  // 先填充缓存
  console.log(chalk.gray('📝 填充缓存...'));
  for (let i = 0; i < 3; i++) {
    const value = await slowOperation(`key-${i}`);
    await cache.set(`key-${i}`, value);
  }

  // 无缓存执行（每次都重新计算）
  console.log(chalk.gray('📊 无缓存执行 (30次，每次3个不同key)...'));
  const start1 = Date.now();
  for (let i = 0; i < 10; i++) {
    await slowOperation('key-0');
    await slowOperation('key-1');
    await slowOperation('key-2');
  }
  const duration1 = Date.now() - start1;

  // 有缓存执行（重复查询相同key）
  console.log(chalk.gray('📊 有缓存执行 (30次，重复3个key)...'));
  const start2 = Date.now();
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 3; j++) {
      const key = `key-${j}`;
      let value = await cache.get(key);

      if (!value) {
        value = await slowOperation(key);
        await cache.set(key, value);
      }
    }
  }
  const duration2 = Date.now() - start2;

  const speedup = duration1 / duration2;

  console.log(chalk.gray('\n📊 性能对比:'));
  console.log(`   无缓存: ${duration1}ms`);
  console.log(`   有缓存: ${duration2}ms`);
  console.log(chalk.green(`   加速: ${speedup.toFixed(2)}x\n`));

  if (speedup > 5) {
    console.log(chalk.green('✅ 性能测试通过\n'));
  } else {
    throw new Error('性能测试未达到预期加速比');
  }
}

async function main() {
  console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   Kode 智能缓存系统测试                   ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════╝'));

  try {
    await testMemoryCache();
    await testDiskCache();
    await testCacheExpiration();
    await testLRUEviction();
    await testAICache();
    await testCacheInvalidation();
    await testPerformance();

    console.log(chalk.green.bold('\n✅ 所有测试通过!\n'));
    console.log(chalk.cyan('📝 功能验证:'));
    console.log(chalk.gray('   ✓ 内存缓存正确'));
    console.log(chalk.gray('   ✓ 磁盘缓存正确'));
    console.log(chalk.gray('   ✓ LRU 淘汰正确'));
    console.log(chalk.gray('   ✓ 过期机制正确'));
    console.log(chalk.gray('   ✓ AI 缓存正确'));
    console.log(chalk.gray('   ✓ 缓存失效正确'));
    console.log(chalk.gray('   ✓ 性能提升显著\n'));

    console.log(chalk.cyan('💡 预期收益:'));
    console.log(chalk.gray('   - 50-70% API 调用减少（重复查询）'));
    console.log(chalk.gray('   - 10-100x 响应加速（缓存命中）'));
    console.log(chalk.gray('   - 降低 API 成本'));
    console.log(chalk.gray('   - 改善用户体验\n'));
  } catch (error) {
    console.error(chalk.red.bold('\n❌ 测试失败\n'), error);
    process.exit(1);
  }
}

// 运行测试
main();
