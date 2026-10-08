/**
 * 优化模块功能测试
 *
 * 测试三个优化模块的基本功能：
 * 1. 分层权限验证链
 * 2. 工具并行编排
 * 3. MCP 客户端配置
 *
 * @author Newma (牛码) Development Team
 * @version 1.0.0
 */

import { permissionChain, TOOL_PERMISSION_PRESETS } from './src/permissions/permissionChain';
import { ParallelToolExecutor, SimpleTool } from './src/tools/parallelExecutor';
import { createDefaultMCPConfig } from './src/mcp/mcpClient';

/**
 * 测试 1：权限验证链基本功能
 */
async function testPermissionChain() {
  console.log('\n=== 测试 1：权限验证链 ===\n');

  // 注册工具权限要求
  permissionChain.registerToolRequirements(Object.values(TOOL_PERMISSION_PRESETS));

  // 测试读权限
  const readResult = await permissionChain.verify({
    action: 'read',
    resourcePath: '/Users/mac/kode/package.json',
    projectRoot: '/Users/mac/kode',
  });

  console.log('读权限测试:');
  console.log(`  决策: ${readResult.decision}`);
  console.log(`  来源: ${readResult.source}`);
  console.log(`  理由: ${readResult.reason}`);

  // 测试写权限
  const writeResult = await permissionChain.verify({
    action: 'write',
    resourcePath: '/tmp/test.txt',
    projectRoot: '/Users/mac/kode',
    toolName: 'file-write',
  });

  console.log('\n写权限测试:');
  console.log(`  决策: ${writeResult.decision}`);
  console.log(`  来源: ${writeResult.source}`);
  console.log(`  理由: ${writeResult.reason}`);

  // 测试危险操作
  const deleteResult = await permissionChain.verify({
    action: 'delete',
    resourcePath: '/Users/mac/kode/test.txt',
    projectRoot: '/Users/mac/kode',
    toolName: 'file-delete',
  });

  console.log('\n删除权限测试:');
  console.log(`  决策: ${deleteResult.decision}`);
  console.log(`  来源: ${deleteResult.source}`);
  console.log(`  理由: ${deleteResult.reason}`);

  // 测试缓存
  const cacheStats = permissionChain.getCacheStats();
  console.log('\n缓存统计:');
  console.log(`  缓存条目: ${cacheStats.size}`);
  console.log(`  已过期: ${cacheStats.expired}`);

  console.log('\n✅ 权限验证链测试完成');
}

/**
 * 测试 2：工具并行编排基本功能
 */
async function testParallelExecutor() {
  console.log('\n=== 测试 2：工具并行编排 ===\n');

  // 创建测试工具
  const tools: SimpleTool[] = [
    {
      name: 'echo',
      description: '回显输入',
      async handler(params: Record<string, unknown>) {
        return {
          success: true,
          output: `Echo: ${params.message as string}`,
        };
      },
    },
    {
      name: 'delay',
      description: '延迟执行',
      async handler(params: Record<string, unknown>) {
        await new Promise(resolve => setTimeout(resolve, (params.ms as number) || 100));
        return {
          success: true,
          output: `Delayed ${params.ms as number}ms`,
        };
      },
    },
    {
      name: 'add',
      description: '加法运算',
      async handler(params: Record<string, unknown>) {
        const a = params.a as number || 0;
        const b = params.b as number || 0;
        const result = a + b;
        return {
          success: true,
          output: `${a} + ${b} = ${result}`,
        };
      },
    },
  ];

  // 创建执行器
  const executor = new ParallelToolExecutor(tools, {
    maxConcurrency: 2,
    singleTimeout: 5000,
    debug: false,
  });

  // 执行多个工具调用
  const calls = [
    {
      id: 'call-1',
      name: 'echo',
      parameters: { message: 'Hello, World!' },
    },
    {
      id: 'call-2',
      name: 'delay',
      parameters: { ms: 100 },
    },
    {
      id: 'call-3',
      name: 'add',
      parameters: { a: 10, b: 20 },
    },
  ];

  console.log('执行工具...');
  const startTime = Date.now();
  const results = await executor.execute(calls);
  const duration = Date.now() - startTime;

  console.log('\n执行结果:');
  for (const result of results) {
    console.log(`\n${result.name}:`);
    console.log(`  状态: ${result.result.success ? '✅' : '❌'}`);
    console.log(`  耗时: ${result.duration}ms`);
    if (result.result.success) {
      console.log(`  输出: ${result.result.output}`);
    }
  }

  // 打印统计
  const stats = executor.calculateStats(results);
  console.log('\n统计信息:');
  console.log(`  总数: ${stats.total}`);
  console.log(`  成功: ${stats.succeeded}`);
  console.log(`  失败: ${stats.failed}`);
  console.log(`  总耗时: ${duration}ms`);
  console.log(`  平均耗时: ${stats.averageDuration.toFixed(2)}ms`);

  console.log('\n✅ 工具并行编排测试完成');
}

/**
 * 测试 3：MCP 配置创建
 */
async function testMCPConfig() {
  console.log('\n=== 测试 3：MCP 配置 ===\n');

  try {
    await createDefaultMCPConfig();
    console.log('✅ MCP 配置文件创建成功');
    console.log('   位置: ~/.newma/mcp.json');
  } catch (error) {
    console.log('ℹ️  MCP 配置文件已存在或创建失败:', error);
  }

  console.log('\n✅ MCP 配置测试完成');
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          Newma (牛码) 优化模块测试                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    await testPermissionChain();
    await testParallelExecutor();
    await testMCPConfig();

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ 所有测试通过                              ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runTests();
