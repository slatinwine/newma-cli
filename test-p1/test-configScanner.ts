// test-p1/test-configScanner.ts
/**
 * ConfigScanner 单元测试
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigScanner, getConfigScanner } from '../src/context/configScanner';

// 测试辅助函数
async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const tmpDir = path.join(os.tmpdir(), 'newma-test-' + Date.now());
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function writeFile(dir: string, filename: string, content: string): Promise<void> {
  const filePath = path.join(dir, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

// 测试套件
async function runTests() {
  let passed = 0;
  let failed = 0;

  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: 'ConfigScanner - 基本扫描',
      fn: async () => {
        await withTempDir(async (dir) => {
          const scanner = new ConfigScanner();
          const ctx = await scanner.scan(dir);

          // 应该找到项目根（即使没有配置文件）
          console.log('  ✓ 项目根:', ctx.projectRoot);
          console.log('  ✓ 全局灵魂:', ctx.globalSoul === null ? 'null' : 'found');
          console.log('  ✓ 项目规则:', ctx.projectRules === null ? 'null' : 'found');
        });
      },
    },

    {
      name: 'ConfigScanner - 扫描 NEWMA.md',
      fn: async () => {
        await withTempDir(async (dir) => {
          // 创建 NEWMA.md
          await writeFile(dir, 'NEWMA.md', '# 项目规则\n\n这是一个测试项目。');

          const scanner = new ConfigScanner();
          const ctx = await scanner.scan(dir);

          if (ctx.projectRules === null) {
            throw new Error('应该找到 NEWMA.md');
          }

          if (!ctx.projectRules.includes('这是一个测试项目')) {
            throw new Error('NEWMA.md 内容不匹配');
          }

          console.log('  ✓ 成功扫描 NEWMA.md');
          console.log('  ✓ 内容长度:', ctx.projectRules.length);
        });
      },
    },

    {
      name: 'ConfigScanner - 扫描子目录',
      fn: async () => {
        await withTempDir(async (dir) => {
          // 创建子目录配置
          await writeFile(dir, 'src/NEWMA.md', '# src 目录\n\nTypeScript 代码。');
          await writeFile(dir, 'test/NEWMA.md', '# test 目录\n\n测试文件。');

          const scanner = new ConfigScanner({ maxDepth: 3 });
          const ctx = await scanner.scan(dir);

          if (ctx.subDirRules.size !== 2) {
            throw new Error(`应该找到 2 个子目录配置，实际: ${ctx.subDirRules.size}`);
          }

          console.log('  ✓ 找到 2 个子目录配置');
          console.log('  ✓ 子目录:', Array.from(ctx.subDirRules.keys()).join(', '));
        });
      },
    },

    {
      name: 'ConfigScanner - 向上查找',
      fn: async () => {
        await withTempDir(async (dir) => {
          // 在项目根创建 NEWMA.md
          await writeFile(dir, 'NEWMA.md', '# 项目根\n\n根配置。');

          // 在子目录扫描
          const subDir = path.join(dir, 'src', 'components');
          await fs.mkdir(subDir, { recursive: true });

          const scanner = new ConfigScanner();
          const ctx = await scanner.scan(subDir);

          if (ctx.projectRules === null) {
            throw new Error('应该向上找到项目根的 NEWMA.md');
          }

          console.log('  ✓ 从子目录成功向上查找');
          console.log('  ✓ 项目根:', ctx.projectRoot);
        });
      },
    },

    {
      name: 'ConfigScanner - 排除 node_modules',
      fn: async () => {
        await withTempDir(async (dir) => {
          // 创建 node_modules/NEWMA.md（应该被排除）
          await writeFile(dir, 'node_modules/NEWMA.md', '# 不应该被扫描');

          // 创建正常目录的 NEWMA.md（应该被扫描）
          await writeFile(dir, 'src/NEWMA.md', '# src 目录');

          const scanner = new ConfigScanner({ maxDepth: 3 });
          const ctx = await scanner.scan(dir);

          if (ctx.subDirRules.size !== 1) {
            throw new Error(`应该只找到 1 个配置（排除 node_modules），实际: ${ctx.subDirRules.size}`);
          }

          const foundKey = Array.from(ctx.subDirRules.keys())[0];
          if (foundKey.includes('node_modules')) {
            throw new Error('不应该扫描 node_modules');
          }

          console.log('  ✓ node_modules 被正确排除');
        });
      },
    },

    {
      name: 'ConfigScanner - 缓存机制',
      fn: async () => {
        await withTempDir(async (dir) => {
          const scanner = new ConfigScanner({ cacheTTL: 1000 });

          // 第一次扫描
          const ctx1 = await scanner.scan(dir);
          const cacheStats1 = scanner.getCacheStats();

          // 第二次扫描（应该使用缓存）
          const ctx2 = await scanner.scan(dir);
          const cacheStats2 = scanner.getCacheStats();

          if (cacheStats1.size !== 1 || cacheStats2.size !== 1) {
            throw new Error('缓存大小应该是 1');
          }

          console.log('  ✓ 缓存机制工作正常');
          console.log('  ✓ 缓存大小:', cacheStats2.size);

          // 使缓存失效
          scanner.invalidate(dir);
          const cacheStats3 = scanner.getCacheStats();

          if (cacheStats3.size !== 0) {
            throw new Error('缓存应该被清空');
          }

          console.log('  ✓ 缓存失效成功');
        });
      },
    },

    {
      name: 'ConfigScanner - buildPrompt',
      fn: async () => {
        await withTempDir(async (dir) => {
          await writeFile(dir, 'NEWMA.md', '# 项目规则\n\n规则内容。');

          const scanner = new ConfigScanner();
          const ctx = await scanner.scan(dir);
          const prompt = scanner.buildPrompt(ctx);

          if (!prompt.includes('项目规则')) {
            throw new Error('prompt 应该包含配置内容');
          }

          if (!prompt.includes('┌─────────────────────────────────────────')) {
            throw new Error('prompt 应该包含分隔符');
          }

          console.log('  ✓ buildPrompt 生成成功');
          console.log('  ✓ prompt 长度:', prompt.length);
        });
      },
    },

    {
      name: 'getConfigScanner - 单例模式',
      fn: async () => {
        const scanner1 = getConfigScanner();
        const scanner2 = getConfigScanner();

        if (scanner1 !== scanner2) {
          throw new Error('应该返回相同的实例');
        }

        console.log('  ✓ 单例模式工作正常');
      },
    },

    {
      name: 'scanCurrentProject - 快捷方法',
      fn: async () => {
        const ctx = await import('../src/context/configScanner').then(
          m => m.scanCurrentProject()
        );

        console.log('  ✓ scanCurrentProject 执行成功');
        console.log('  ✓ 项目根:', ctx.projectRoot?.slice(-50));
      },
    },
  ];

  // 运行所有测试
  console.log('\n运行 ConfigScanner 测试...\n');

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
