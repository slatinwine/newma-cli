/**
 * REPL 端到端黑盒测试
 *
 * 用管道驱动编译产物（node dist/cli.js -i），验证用户真实可见的行为：
 * - 启动横幅与命令注册（/help）
 * - /save + /saves 存档闭环
 * - /flags /tree /next 命令链路
 *
 * 前置：需要先 npm run build（CI 在测试前构建）。
 */

import { spawn } from 'child_process';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CLI = path.resolve(__dirname, '..', 'dist', 'cli.js');
// dist 产物是无后缀 ESM 导入已被 postbuild 改写——直接跑，无 loader
const maybeSuite = fs.existsSync(CLI) ? describe : describe.skip;

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newma-e2e-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'e2e@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'e2e'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  return dir;
}

interface RunResult {
  stdout: string;
  code: number | null;
}

/** 驱动一次 REPL 会话：按序写入输入行，收集输出直到进程退出 */
function runRepl(cwd: string, inputs: string[], timeoutMs = 90_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, '-i', '--quiet'], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stdout += d.toString()));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`REPL timed out after ${timeoutMs}ms. Output so far:\n${stdout.slice(-2000)}`));
    }, timeoutMs);

    // 逐行喂入：给每条命令留出处理时间
    let i = 0;
    const feed = () => {
      if (i >= inputs.length) {
        child.stdin.end();
        return;
      }
      child.stdin.write(inputs[i] + '\n');
      i++;
      setTimeout(feed, 400);
    };
    // 等 REPL 就绪（横幅出现）再开始喂
    const ready = setInterval(() => {
      if (stdout.includes('❯') || stdout.includes('NEWMA')) {
        clearInterval(ready);
        setTimeout(feed, 300);
      }
    }, 200);

    child.on('close', (code) => {
      clearTimeout(timer);
      clearInterval(ready);
      resolve({ stdout, code });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      clearInterval(ready);
      reject(err);
    });
  });
}

maybeSuite('🖥️ REPL 端到端（dist CLI 黑盒）', () => {
  let dir: string;

  beforeAll(() => {
    dir = makeTempProject();
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(
    '/help 列出存档/分支命令（命令注册完整）',
    async () => {
      const { stdout } = await runRepl(dir, ['/help', '/exit']);
      expect(stdout).toContain('Save & Branch System');
      expect(stdout).toContain('/save');
      expect(stdout).toContain('/back-to');
      expect(stdout).toContain('/continue');
    },
    120_000
  );

  test(
    '/save → /saves 存档闭环（含 git 锚点）',
    async () => {
      const { stdout } = await runRepl(dir, [
        '/save e2e-checkpoint',
        '/saves',
        '/exit',
      ]);
      expect(stdout).toContain('Saved "e2e-checkpoint"');
      expect(stdout).toMatch(/git:[0-9a-f]{7}/); // 绑定了 git commit
      expect(stdout).toContain('e2e-checkpoint'); // /saves 列表可见
    },
    120_000
  );

  test(
    '/flags 设置 + /tree 渲染（决策链路落盘可见）',
    async () => {
      const { stdout } = await runRepl(dir, [
        '/flags set lib=vitest',
        '/tree',
        '/exit',
      ]);
      expect(stdout).toContain('lib = vitest');
      expect(stdout).toContain('Decision Tree');
      expect(stdout).toContain('Flags:');
    },
    120_000
  );
});
