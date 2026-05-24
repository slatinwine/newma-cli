// test-p1/test-hooks.ts
/**
 * ToolHookManager 单元测试
 */

import {
  ToolHookManager,
  ToolHook,
  type ToolHookContext,
  createAuditHook,
  createTimingHook,
} from '../src/tools/hooks';

// 测试套件
async function runTests() {
  let passed = 0;
  let failed = 0;

  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: 'ToolHookManager - 注册和移除',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: 'test',
          beforeToolUse: () => ({ proceed: true }),
        };

        manager.register(hook);

        const list = manager.list();
        if (list.length !== 1) {
          throw new Error(`应该注册 1 个钩子，实际: ${list.length}`);
        }

        manager.unregister('test');

        const list2 = manager.list();
        if (list2.length !== 0) {
          throw new Error('移除后应该没有钩子');
        }

        console.log('  ✓ 注册和移除成功');
      },
    },

    {
      name: 'ToolHookManager - beforeToolUse 阻止执行',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: 'dangerous',
          beforeToolUse: () => ({
            proceed: false,
            reason: '测试阻止',
          }),
        };

        manager.register(hook);

        const ctx: ToolHookContext = {
          tool: 'dangerous',
          input: { command: 'rm -rf /' },
          timestamp: Date.now(),
        };

        const result = await manager.runBefore(ctx);

        if (result.proceed !== false) {
          throw new Error('应该被阻止');
        }

        if (result.reason !== '测试阻止') {
          throw new Error('阻止原因不匹配');
        }

        console.log('  ✓ beforeToolUse 成功阻止执行');
      },
    },

    {
      name: 'ToolHookManager - beforeToolUse 允许执行',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: 'safe',
          beforeToolUse: () => ({ proceed: true }),
        };

        manager.register(hook);

        const ctx: ToolHookContext = {
          tool: 'safe',
          input: { file_path: '/test.txt' },
          timestamp: Date.now(),
        };

        const result = await manager.runBefore(ctx);

        if (result.proceed !== true) {
          throw new Error('应该被允许');
        }

        console.log('  ✓ beforeToolUse 允许执行');
      },
    },

    {
      name: 'ToolHookManager - afterToolUse 修改输出',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: 'transformer',
          afterToolUse: (ctx, output) => ({
            modifiedOutput: (output as string) + ' [已处理]',
          }),
        };

        manager.register(hook);

        const ctx: ToolHookContext = {
          tool: 'transformer',
          input: {},
          timestamp: Date.now(),
        };

        const output = '原始输出';
        const result = await manager.runAfter(ctx, output);

        if (result !== '原始输出 [已处理]') {
          throw new Error(`输出应该被修改，实际: ${result}`);
        }

        console.log('  ✓ afterToolUse 成功修改输出');
      },
    },

    {
      name: 'ToolHookManager - onToolError',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: 'flaky',
          onToolError: () => ({ retry: true }),
        };

        manager.register(hook);

        const ctx: ToolHookContext = {
          tool: 'flaky',
          input: {},
          timestamp: Date.now(),
        };

        const error = new Error('测试错误');
        const result = await manager.runError(ctx, error);

        if (result.retry !== true) {
          throw new Error('应该返回 retry: true');
        }

        console.log('  ✓ onToolError 成功处理错误');
      },
    },

    {
      name: 'ToolHookManager - 通配符匹配',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: '*',
          beforeToolUse: () => ({ proceed: true }),
        };

        manager.register(hook);

        const ctx: ToolHookContext = {
          tool: 'any-tool',
          input: {},
          timestamp: Date.now(),
        };

        const result = await manager.runBefore(ctx);

        if (result.proceed !== true) {
          throw new Error('通配符 * 应该匹配所有工具');
        }

        console.log('  ✓ 通配符匹配成功');
      },
    },

    {
      name: 'ToolHookManager - 前缀匹配',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: 'file-*',
          beforeToolUse: () => ({ proceed: true }),
        };

        manager.register(hook);

        // 应该匹配
        const ctx1: ToolHookContext = {
          tool: 'file-read',
          input: {},
          timestamp: Date.now(),
        };

        const result1 = await manager.runBefore(ctx1);
        if (result1.proceed !== true) {
          throw new Error('应该匹配 file-* 模式');
        }

        // 不应该匹配
        const ctx2: ToolHookContext = {
          tool: 'bash',
          input: {},
          timestamp: Date.now(),
        };

        const result2 = await manager.runBefore(ctx2);
        if (result2.proceed !== true) {
          throw new Error('bash 不应该有钩子');
        }

        console.log('  ✓ 前缀匹配成功');
      },
    },

    {
      name: 'ToolHookManager - 钩子链执行',
      fn: async () => {
        const manager = new ToolHookManager();

        const order: string[] = [];

        const hook1: ToolHook = {
          toolPattern: 'test',
          beforeToolUse: () => {
            order.push('hook1');
            return { proceed: true };
          },
        };

        const hook2: ToolHook = {
          toolPattern: 'test',
          beforeToolUse: () => {
            order.push('hook2');
            return { proceed: true };
          },
        };

        manager.register(hook1);
        manager.register(hook2);

        const ctx: ToolHookContext = {
          tool: 'test',
          input: {},
          timestamp: Date.now(),
        };

        await manager.runBefore(ctx);

        if (order.length !== 2) {
          throw new Error(`应该执行 2 个钩子，实际: ${order.length}`);
        }

        if (order[0] !== 'hook1' || order[1] !== 'hook2') {
          throw new Error(`钩子执行顺序错误: ${order.join(', ')}`);
        }

        console.log('  ✓ 钩子链按注册顺序执行');
      },
    },

    {
      name: 'ToolHookManager - 钩子链中断',
      fn: async () => {
        const manager = new ToolHookManager();

        const order: string[] = [];

        const hook1: ToolHook = {
          toolPattern: 'test',
          beforeToolUse: () => {
            order.push('hook1');
            return { proceed: false, reason: '阻止' };
          },
        };

        const hook2: ToolHook = {
          toolPattern: 'test',
          beforeToolUse: () => {
            order.push('hook2');
            return { proceed: true };
          },
        };

        manager.register(hook1);
        manager.register(hook2);

        const ctx: ToolHookContext = {
          tool: 'test',
          input: {},
          timestamp: Date.now(),
        };

        const result = await manager.runBefore(ctx);

        if (result.proceed !== false) {
          throw new Error('应该被阻止');
        }

        if (order.length !== 1) {
          throw new Error(`被阻止后不应继续执行，实际执行: ${order.length}`);
        }

        console.log('  ✓ 钩子链正确中断');
      },
    },

    {
      name: 'createAuditHook - 内置钩子',
      fn: async () => {
        const hook = createAuditHook();

        if (hook.toolPattern !== 'file') {
          throw new Error('audit hook 应该匹配 file 工具');
        }

        if (!hook.afterToolUse) {
          throw new Error('audit hook 应该有 afterToolUse');
        }

        console.log('  ✓ createAuditHook 创建成功');
      },
    },

    {
      name: 'createTimingHook - 内置钩子',
      fn: async () => {
        const hook = createTimingHook();

        if (hook.toolPattern !== '*') {
          throw new Error('timing hook 应该匹配所有工具');
        }

        if (!hook.beforeToolUse || !hook.afterToolUse) {
          throw new Error('timing hook 应该有 before 和 after 钩子');
        }

        console.log('  ✓ createTimingHook 创建成功');
      },
    },

    {
      name: 'ToolHookManager - 钩子错误不影响执行',
      fn: async () => {
        const manager = new ToolHookManager();

        const hook: ToolHook = {
          toolPattern: 'test',
          beforeToolUse: () => {
            throw new Error('钩子错误');
          },
        };

        manager.register(hook);

        const ctx: ToolHookContext = {
          tool: 'test',
          input: {},
          timestamp: Date.now(),
        };

        // 钩子错误不应该阻止执行
        const result = await manager.runBefore(ctx);

        if (result.proceed !== true) {
          throw new Error('钩子错误不应该阻止执行');
        }

        console.log('  ✓ 钩子错误不影响执行');
      },
    },
  ];

  // 运行所有测试
  console.log('\n运行 ToolHookManager 测试...\n');

  for (const test of tests) {
    try {
      process.stdout.write(`  ${test.name}... `);
      await test.fn();
      console.log('✓ PASSED');
      passed++;
    } catch (error) {
      console.log('✗ FAILED');
      console.error('    错误:', error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
