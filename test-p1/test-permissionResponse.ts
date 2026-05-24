// test-p1/test-permissionResponse.ts
/**
 * PermissionManager 单元测试
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PermissionManager, type PermissionResponse } from '../src/permissions/permissionResponse';

// 测试辅助函数
async function withTestDir(fn: (dir: string, permFile: string) => Promise<void>): Promise<void> {
  const tmpDir = path.join(os.tmpdir(), 'newma-perm-test-' + Date.now() + Math.random().toString(36).slice(2, 8));
  await fs.mkdir(tmpDir, { recursive: true });

  // 创建权限文件路径
  const permFile = path.join(tmpDir, '.newma', 'permissions.json');

  // 清理可能存在的持久化文件
  try {
    await fs.unlink(permFile);
  } catch {
    // File doesn't exist, ignore
  }

  try {
    await fn(tmpDir, permFile);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// 清理当前用户的持久化文件
async function cleanGlobalPermissions(): Promise<void> {
  const permFile = path.join(os.homedir(), '.newma', 'permissions.json');
  try {
    await fs.unlink(permFile);
  } catch {
    // File doesn't exist, ignore
  }
}

// 测试套件
async function runTests() {
  // 清理全局持久化文件
  await cleanGlobalPermissions();

  let passed = 0;
  let failed = 0;

  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: 'PermissionManager - 初始化',
      fn: async () => {
        await withTestDir(async (dir, permFile) => {
          const manager = new PermissionManager(permFile);

          // 初始状态应该没有规则
          const rules = manager.listRules();
          if (rules.length !== 0) {
            throw new Error(`初始应该没有规则，实际: ${rules.length}`);
          }

          console.log('  ✓ 初始化成功，无规则');
        });
      },
    },

    {
      name: 'PermissionManager - check 未授权',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          const result = manager.check('file', { file_path: '/test/file.txt' });

          if (result !== null) {
            throw new Error('未配置规则时应该返回 null');
          }

          console.log('  ✓ 未授权工具返回 null');
        });
      },
    },

    {
      name: 'PermissionManager - allow_once 记录',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          // 记录 allow_once（不应持久化）
          manager.record({
            action: 'allow_once',
            tool: 'file',
          });

          // 仍然应该返回 null（allow_once 不缓存）
          const result = manager.check('file', { file_path: '/test/file.txt' });

          if (result !== null) {
            throw new Error('allow_once 不应该被缓存');
          }

          console.log('  ✓ allow_once 不被缓存');
        });
      },
    },

    {
      name: 'PermissionManager - allow_always 持久化',
      fn: async () => {
        await withTestDir(async () => {
          const manager1 = new PermissionManager();

          // 记录 allow_always
          manager1.record({
            action: 'allow_always',
            tool: 'file',
          });

          // 创建新实例（模拟重启）
          const manager2 = new PermissionManager();

          const result = manager2.check('file', { file_path: '/test/file.txt' });

          if (result === null || result.action !== 'allow_always') {
            throw new Error('allow_always 应该被持久化');
          }

          console.log('  ✓ allow_always 持久化成功');
        });
      },
    },

    {
      name: 'PermissionManager - allow_session 会话级',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          // 记录 allow_session
          manager.record({
            action: 'allow_session',
            tool: 'bash',
          });

          const result = manager.check('bash', { command: 'ls' });

          if (result === null || result.action !== 'allow_session') {
            throw new Error('allow_session 应该在会话中生效');
          }

          console.log('  ✓ allow_session 生效');

          // 清除会话规则
          manager.clearSessionRules();

          const result2 = manager.check('bash', { command: 'ls' });

          if (result2 !== null) {
            throw new Error('清除后应该返回 null');
          }

          console.log('  ✓ clearSessionRules 成功');
        });
      },
    },

    {
      name: 'PermissionManager - deny 持久化',
      fn: async () => {
        await withTestDir(async () => {
          const manager1 = new PermissionManager();

          // 记录 deny
          manager1.record({
            action: 'deny',
            tool: 'dangerous',
          });

          // 创建新实例
          const manager2 = new PermissionManager();

          const result = manager2.check('dangerous', { command: 'rm -rf /' });

          if (result === null || result.action !== 'deny') {
            throw new Error('deny 规则应该被持久化');
          }

          console.log('  ✓ deny 规则持久化成功');
        });
      },
    },

    {
      name: 'PermissionManager - 工具名匹配',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          manager.record({
            action: 'allow_always',
            tool: 'file',
          });

          // 精确匹配
          const result1 = manager.check('file', { file_path: '/test' });
          if (result1 === null) {
            throw new Error('应该匹配 file 工具');
          }

          // 不匹配其他工具
          const result2 = manager.check('bash', { command: 'ls' });
          if (result2 !== null) {
            throw new Error('不应该匹配 bash 工具');
          }

          console.log('  ✓ 工具名匹配正确');
        });
      },
    },

    {
      name: 'PermissionManager - glob 模式匹配',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          manager.record({
            action: 'allow_always',
            tool: 'file',
            pattern: 'src/**/*.ts',
          });

          // 匹配模式
          const result1 = manager.check('file', { file_path: 'src/components/Button.ts' });
          if (result1 === null) {
            throw new Error('应该匹配 src/**/*.ts 模式');
          }

          // 不匹配其他路径
          const result2 = manager.check('file', { file_path: 'test/file.test.js' });
          if (result2 !== null) {
            throw new Error('不应该匹配 test 目录');
          }

          console.log('  ✓ glob 模式匹配正确');
        });
      },
    },

    {
      name: 'PermissionManager - 通配符工具',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          manager.record({
            action: 'allow_always',
            tool: '*',
          });

          // 应该匹配所有工具
          const result1 = manager.check('file', { file_path: '/test' });
          const result2 = manager.check('bash', { command: 'ls' });

          if (result1 === null || result2 === null) {
            throw new Error('通配符 * 应该匹配所有工具');
          }

          console.log('  ✓ 通配符工具匹配成功');
        });
      },
    },

    {
      name: 'PermissionManager - listRules',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          manager.record({ action: 'allow_always', tool: 'file' });
          manager.record({ action: 'deny', tool: 'dangerous' });
          manager.record({ action: 'allow_session', tool: 'bash' });

          const rules = manager.listRules();

          // 应该只返回持久化规则（不包括 session）
          if (rules.length !== 2) {
            throw new Error(`应该返回 2 条持久化规则，实际: ${rules.length}`);
          }

          console.log('  ✓ listRules 返回', rules.length, '条规则');
        });
      },
    },

    {
      name: 'PermissionManager - removeRule',
      fn: async () => {
        await withTestDir(async () => {
          const manager = new PermissionManager();

          manager.record({ action: 'allow_always', tool: 'file' });
          manager.record({ action: 'deny', tool: 'dangerous' });

          // 移除第一条
          manager.removeRule(0);

          const rules = manager.listRules();

          if (rules.length !== 1) {
            throw new Error(`移除后应该剩余 1 条规则，实际: ${rules.length}`);
          }

          if (rules[0].tool !== 'dangerous') {
            throw new Error('剩余的应该是 dangerous 规则');
          }

          console.log('  ✓ removeRule 成功');
        });
      },
    },
  ];

  // 运行所有测试
  console.log('\n运行 PermissionManager 测试...\n');

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
