/**
 * Mock LLM 全链路测试：单次命令模式（one-shot）
 *
 * 起一个本地 OpenAI 兼容 mock server，把 OPENAI_BASE_URL 指过去，
 * 驱动 `newma "<需求>"` 完整跑 plan → execute，验证 AI 正常路径
 * （此前只有无 key 的失败路径被测过）。
 *
 * 前置：需要先 npm run build（CI 在测试前构建）。
 */

import { spawn } from 'child_process';
import { execFileSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const CLI = path.resolve(__dirname, '..', 'dist', 'cli.js');
const maybeSuite = fs.existsSync(CLI) ? describe : describe.skip;

/** 请求计数与记录（供断言 AI 真实被调用） */
let requestCount = 0;

/** OpenAI 兼容 mock：任何 chat 请求都返回一个“创建文件”的计划 */
function startMockServer(port = 0): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        requestCount++;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    todo: ['创建 hello-mock.txt'],
                    actions: [
                      {
                        type: 'create',
                        path: 'hello-mock.txt',
                        content: 'created by mock llm e2e\n',
                      },
                    ],
                    done: false,
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          })
        );
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newma-mockllm-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'm@t.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'm'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README.md'), '# mock\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  return dir;
}

function runOneShot(
  dir: string,
  port: number,
  requirement: string,
  extraEnv: Record<string, string> = {},
  timeoutMs = 120_000
): Promise<{ stdout: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [CLI, requirement, '--max-iterations', '1', '--mode', 'plan'],
      {
        cwd: dir,
        env: {
          ...process.env,
          NO_COLOR: '1',
          NEWMA_LOG: 'error',
          NEWMA_CACHE: 'off', // 隔离全局磁盘缓存（~/.kode/cache）
          OPENAI_API_KEY: 'mock-key-not-real',
          OPENAI_BASE_URL: `http://127.0.0.1:${port}`,
          ...extraEnv,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stdout += d));

    // 计划确认弹窗（inquirer）出现后自动同意执行
    const confirmWatch = setInterval(() => {
      if ((stdout.includes('Action Plan') || stdout.includes('执行本轮')) && child.stdin.writable) {
        child.stdin.write('y\n');
        clearInterval(confirmWatch);
      }
    }, 250);

    const timer = setTimeout(() => {
      clearInterval(confirmWatch);
      child.kill('SIGKILL');
      reject(new Error(`one-shot timed out. Output:\n${stdout.slice(-2000)}`));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      clearInterval(confirmWatch);
      resolve({ stdout, code });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      clearInterval(confirmWatch);
      reject(e);
    });
  });
}

maybeSuite('🔌 Mock LLM 全链路（one-shot plan → execute）', () => {
  let server: http.Server;
  let port: number;
  let dir: string;

  beforeAll(async () => {
    server = await startMockServer();
    const addr = server.address();
    if (typeof addr === 'object' && addr) port = addr.port;
    dir = makeTempProject();
  });

  afterAll(() => {
    server?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test(
    '计划被生成且动作真实执行（文件落盘）',
    async () => {
      const before = requestCount;
      const { stdout, code } = await runOneShot(dir, port, 'create a hello file');

      expect(code).toBe(0);
      expect(requestCount).toBeGreaterThan(before); // LLM 真的被调用
      expect(fs.existsSync(path.join(dir, 'hello-mock.txt'))).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'hello-mock.txt'), 'utf-8')).toContain(
        'created by mock llm e2e'
      );
      expect(stdout).toContain('hello-mock.txt');
    },
    150_000
  );
});
