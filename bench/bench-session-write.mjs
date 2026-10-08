// 会话写入基准：量化每消息全量重写的代价
import { performance } from 'perf_hooks';
import fs from 'fs'; import os from 'os'; import path from 'path';
const { SessionContextManager } = await import('file:///D:/Git/newma-cli/dist/memory/session-context-manager.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-write-'));
const mgr = new SessionContextManager(dir);
await mgr.initialize();
await mgr.createSession('bench-1');

const SIZES = [200, 500];
for (const n of SIZES) {
  // 每条 ~200B 的典型消息
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    await mgr.addMessage(i % 2 ? 'assistant' : 'user', `msg-${i}-` + 'x'.repeat(180));
  }
  const total = performance.now() - t0;
  const fileKB = fs.statSync(dir + '/.memo/sessions/' + new Date().toISOString().slice(0,7) + '/' + mgr.getCurrentSession().id + '.json').size / 1024;
  console.log(`${n} msgs: total ${total.toFixed(0)}ms, avg ${(total/n).toFixed(2)}ms/msg, file ${fileKB.toFixed(0)}KB, bytes written ≈ ${(fileKB*n/1024).toFixed(1)}MB`);
}
fs.rmSync(dir, {recursive: true, force: true});
process.exit(0);
