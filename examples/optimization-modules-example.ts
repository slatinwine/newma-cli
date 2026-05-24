/**
 * 优化模块使用示例
 *
 * 演示如何使用三个优化模块：
 * 1. 分层权限验证链
 * 2. 工具并行编排
 * 3. MCP 客户端
 *
 * @author Newma (牛码) Development Team
 * @version 1.0.0
 */

import {
  PermissionChain,
  PermissionRequest,
  TOOL_PERMISSION_PRESETS,
  permissionChain,
} from '../src/permissions/permissionChain';
import {
  ParallelToolExecutor,
  ToolCall,
  Tool,
  ToolResult,
  parseToolCallsFromAIResponse,
} from '../src/tools/parallelExecutor';
import {
  MCPClient,
  MCPManager,
  MCPServerConfig,
  mcpManager,
  createDefaultMCPConfig,
} from '../src/mcp/mcpClient';

/**
 * 示例 1：使用分层权限验证链
 */
async function examplePermissionChain() {
  console.log('\n=== 示例 1：分层权限验证链 ===\n');

  // 注册工具权限要求
  permissionChain.registerToolRequirements(Object.values(TOOL_PERMISSION_PRESETS));

  // 创建默认配置文件（如果不存在）
  try {
    await permissionChain.createDefaultGlobalConfig();
    console.log('✅ 全局权限配置已创建');
  } catch (error) {
    console.log('ℹ️  全局权限配置已存在');
  }

  // 定义权限验证请求
  const requests: PermissionRequest[] = [
    {
      action: 'read',
      resourcePath: '/Users/mac/kode/src/permissions/permissionChain.ts',
      projectRoot: '/Users/mac/kode',
    },
    {
      action: 'write',
      resourcePath: '/Users/mac/kode/test.txt',
      projectRoot: '/Users/mac/kode',
      toolName: 'file-write',
    },
    {
      action: 'delete',
      resourcePath: '/Users/mac/kode/node_modules/package.json',
      projectRoot: '/Users/mac/kode',
      toolName: 'file-delete',
    },
    {
      action: 'execute',
      resourcePath: 'npm install',
      projectRoot: '/Users/mac/kode',
      toolName: 'command-execute',
    },
  ];

  // 执行权限验证
  for (const request of requests) {
    const result = await permissionChain.verify(request);

    console.log(`\n操作: ${request.action}`);
    console.log(`资源: ${request.resourcePath}`);
    console.log(`工具: ${request.toolName || '无'}`);
    console.log(`决策: ${result.decision}`);
    console.log(`来源: ${result.source}`);
    console.log(`理由: ${result.reason}`);
  }

  // 查看缓存统计
  const stats = permissionChain.getCacheStats();
  console.log(`\n📊 缓存统计: ${stats.size} 条记录, ${stats.expired} 条已过期`);
}

/**
 * 示例 2：使用工具并行编排
 */
async function exampleParallelExecutor() {
  console.log('\n\n=== 示例 2：工具并行编排 ===\n');

  // 定义测试工具
  const tools: Tool[] = [
    {
      name: 'read-file',
      description: '读取文件内容',
      category: 'file',
      permissions: ['read'],
      async handler(params: { path: string }): Promise<ToolResult> {
        const { Bun } = await import('bun');
        try {
          const content = await Bun.file(params.path).text();
          return {
            success: true,
            output: `文件内容: ${content.slice(0, 100)}...`,
          };
        } catch (error) {
          return {
            success: false,
            error: `读取失败: ${error}`,
          };
        }
      },
    },
    {
      name: 'write-file',
      description: '写入文件',
      category: 'file',
      permissions: ['write'],
      async handler(params: { path: string; content: string }): Promise<ToolResult> {
        const { Bun } = await import('bun');
        try {
          await Bun.write(params.path, params.content);
          return {
            success: true,
            output: `写入成功: ${params.path}`,
          };
        } catch (error) {
          return {
            success: false,
            error: `写入失败: ${error}`,
          };
        }
      },
    },
    {
      name: 'list-files',
      description: '列出目录文件',
      category: 'file',
      permissions: ['read'],
      async handler(params: { path: string }): Promise<ToolResult> {
        const { readdir } = await import('fs/promises');
        try {
          const files = await readdir(params.path);
          return {
            success: true,
            output: files.join(', '),
          };
        } catch (error) {
          return {
            success: false,
            error: `列出失败: ${error}`,
          };
        }
      },
    },
  ];

  // 创建并行执行器
  const executor = new ParallelToolExecutor(tools, {
    maxConcurrency: 3,
    singleTimeout: 5000,
    debug: true,
  });

  // 定义工具调用（包含依赖关系）
  const calls: ToolCall[] = [
    {
      id: 'call-1',
      name: 'list-files',
      parameters: { path: '/Users/mac/kode/src' },
    },
    {
      id: 'call-2',
      name: 'read-file',
      parameters: { path: '/Users/mac/kode/package.json' },
    },
    {
      id: 'call-3',
      name: 'write-file',
      parameters: {
        path: '/tmp/test-output.txt',
        content: '测试内容 {{call-2}}', // 引用 call-2 的输出
      },
    },
  ];

  // 执行工具
  console.log('开始执行工具...\n');
  const startTime = Date.now();

  const results = await executor.execute(calls);

  const duration = Date.now() - startTime;

  // 打印结果
  console.log('\n执行结果:');
  for (const result of results) {
    console.log(`\n${result.name} (${result.id}):`);
    console.log(`  状态: ${result.result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  耗时: ${result.duration} ms`);
    if (result.result.success) {
      console.log(`  输出: ${result.result.output}`);
    } else {
      console.log(`  错误: ${result.result.error}`);
    }
  }

  // 打印统计
  executor.printSummary(results);
  console.log(`\n总耗时: ${duration} ms`);
}

/**
 * 示例 3：使用 MCP 客户端
 */
async function exampleMCPClient() {
  console.log('\n\n=== 示例 3：MCP 客户端 ===\n');

  // 创建默认 MCP 配置
  try {
    await createDefaultMCPConfig();
    console.log('✅ MCP 配置文件已创建');
  } catch (error) {
    console.log('ℹ️  MCP 配置文件已存在');
  }

  // 加载配置
  await mcpManager.loadConfig();
  console.log('✅ MCP 配置已加载');

  // 添加一个新的服务器配置
  const newServer: MCPServerConfig = {
    id: 'test-server',
    transport: 'stdio',
    name: '测试服务器',
    description: '用于测试的 MCP 服务器',
    command: 'node',
    args: ['/path/to/server.js'],
    enabled: false, // 默认禁用
  };

  await mcpManager.addServer(newServer);
  console.log('✅ 测试服务器已添加');

  // 注意：实际连接需要 MCP 服务器正在运行
  // 以下代码演示如何连接（如果服务器可用）
  console.log('\n提示：要实际测试 MCP 连接，需要：');
  console.log('1. 安装 MCP 服务器：npm install -g @modelcontextprotocol/server-filesystem');
  console.log('2. 在 ~/.newma/mcp.json 中启用服务器（设置 enabled: true）');
  console.log('3. 运行此示例代码');

  // 演示连接流程（注释掉以避免实际连接失败）
  /*
  try {
    await mcpManager.connectAll();
    console.log('✅ 所有服务器已连接');

    // 获取所有工具
    const tools = await mcpManager.getAllTools();
    console.log(`\n发现 ${tools.length} 个工具:`);
    for (const { serverName, tool } of tools) {
      console.log(`  [${serverName}] ${tool.name}: ${tool.description || '无描述'}`);
    }

    // 调用工具
    const client = mcpManager.getClient('filesystem');
    if (client) {
      const result = await client.callTool({
        name: 'read_file',
        arguments: { path: '/Users/mac/kode/package.json' },
      });
      console.log('\n工具调用结果:', JSON.stringify(result, null, 2));
    }

    // 断开连接
    await mcpManager.disconnectAll();
    console.log('✅ 所有服务器已断开');
  } catch (error) {
    console.error('❌ MCP 错误:', error);
  }
  */
}

/**
 * 主函数
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          Newma (牛码) 优化模块演示                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  try {
    // 运行示例
    await examplePermissionChain();
    await exampleParallelExecutor();
    await exampleMCPClient();

    console.log('\n\n✅ 所有示例执行完成！');
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error);
  }
}

// 运行主函数
if (import.meta.main) {
  main();
}
