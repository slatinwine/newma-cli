#!/usr/bin/env node
/**
 * 发布冒烟验收（npm run verify 的最后一环）
 *
 * 检查项：
 * 1. dist/cli.js 存在且 --version 输出与 package.json 一致
 * 2. --help 正常退出
 * 3. main 入口 dist/index.js 可被 ESM import（公共库面可用）
 * 4. dist/bin/create-plugin.js 存在且带 shebang（bin 可执行）
 * 5. npm pack 干跑成功，产物不含 dev 垃圾
 *
 * 任何一项失败即退出码 1——这是"产品级"的最低门槛。
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
};

console.log('Smoke verification:');

check('dist/cli.js exists', () => {
  if (!fs.existsSync(path.join(root, 'dist/cli.js'))) throw new Error('missing');
});

check('--version matches package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  const out = spawnSync(process.execPath, [path.join(root, 'dist/cli.js'), '--version'], {
    encoding: 'utf-8',
  });
  if (out.status !== 0) throw new Error(`exit ${out.status}`);
  if (out.stdout.trim() !== pkg.version) {
    throw new Error(`CLI reports "${out.stdout.trim()}", package.json says "${pkg.version}"`);
  }
});

check('--help exits cleanly', () => {
  const out = spawnSync(process.execPath, [path.join(root, 'dist/cli.js'), '--help'], {
    encoding: 'utf-8',
  });
  if (out.status !== 0) throw new Error(`exit ${out.status}`);
  if (!/newma/i.test(out.stdout)) throw new Error('no usage text');
});

check('main entry (dist/index.js) is importable', () => {
  const mod = import(
    `file://${process.platform === 'win32' ? '/' : ''}${path
      .join(root, 'dist/index.js')
      .replace(/\\/g, '/')}`
  );
  return mod; // async check below
});

check('bin/create-plugin.js present with shebang', () => {
  const f = path.join(root, 'dist/bin/create-plugin.js');
  if (!fs.existsSync(f)) throw new Error('missing (build it via npm run build)');
  const head = fs.readFileSync(f, 'utf-8').split('\n')[0];
  if (!head.startsWith('#!')) throw new Error(`no shebang, first line: ${head}`);
});

check('npm pack dry-run: no dev debris in tarball', () => {
  // Windows 下 npm 是 .cmd，Node 20+ 需经 shell 调起
  const out = execSync('npm pack --dry-run', {
    cwd: root,
    encoding: 'utf-8',
  });
  const bad = ['archive/', 'tests/', 'test-ultrathink/', '.env', 'yarn.lock']
    .filter((p) => out.includes(p));
  if (bad.length) throw new Error(`tarball contains: ${bad.join(', ')}`);
});

// main 入口是异步 import，单独跑
const entry = path.join(root, 'dist/index.js').replace(/\\/g, '/');
try {
  const mod = await import(
    `${process.platform === 'win32' ? 'file:///' : 'file://'}${entry}`
  );
  const names = Object.keys(mod);
  if (!names.includes('BranchTreeManager') || !names.includes('logger')) {
    throw new Error(`unexpected exports: ${names.slice(0, 8).join(', ')}`);
  }
  console.log('  ✓ main entry (dist/index.js) is importable and exports public API');
} catch (error) {
  failed++;
  console.error(`  ✗ main entry (dist/index.js) is importable\n    ${error.message}`);
}

console.log(failed === 0 ? '\nAll smoke checks passed.' : `\n${failed} smoke check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
