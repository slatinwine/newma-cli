#!/usr/bin/env node
/**
 * postbuild：给 dist 里的无后缀相对导入补 .js 后缀
 *
 * 背景：tsconfig 是 ESM（module: ES2022）且源码相对导入不带后缀，
 * tsc 原样保留 → 纯 Node ESM 无法解析，此前必须挂 loader.mjs 运行。
 * 本脚本在构建产物上做确定性改写，使 `node dist/cli.js` 开箱即用。
 *
 * 规则：形如 from './x' / import './x' / await import('./x') 的相对说明符，
 * 若 x.js 或 x/index.js 存在则补全；已带后缀的不动。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('[fix-dist-imports] dist/ not found — run tsc first');
  process.exit(1);
}

// 收集产物文件
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
};
walk(distDir);

// 相对导入说明符：from '…' / import '…' / import('…')
const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(?\s*)('|")(\.[^'"]+)\2/g;

let rewritten = 0;
let patchedFiles = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf-8');
  let changed = false;

  const out = source.replace(IMPORT_RE, (match, prefix, quote, specifier) => {
    if (/\.(js|mjs|cjs|json)$/.test(specifier)) return match; // 已带后缀

    const base = path.resolve(path.dirname(file), specifier);
    if (fs.existsSync(base + '.js')) {
      changed = true;
      rewritten++;
      return `${prefix}${quote}${specifier}.js${quote}`;
    }
    if (fs.existsSync(path.join(base, 'index.js'))) {
      changed = true;
      rewritten++;
      return `${prefix}${quote}${specifier}/index.js${quote}`;
    }
    return match; // 目标不存在（类型导入被擦除后的残留等）——不动
  });

  if (changed) {
    fs.writeFileSync(file, out, 'utf-8');
    patchedFiles++;
  }
}

console.log(`[fix-dist-imports] ${patchedFiles}/${files.length} files patched, ${rewritten} imports rewritten`);
