// Node.js ESM loader that auto-resolves imports without .js extension
// Usage: node --loader ./loader.mjs dist/cli.js
//
// Windows 兼容：用 fileURLToPath/pathToFileURL 处理盘符路径，
// 不再手拼 URL pathname（原写法在 Windows 上产生 /D:/... 坏路径）。
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('.')) {
    return nextResolve(specifier, context);
  }
  if (/\.(js|mjs|cjs|json)$/.test(specifier)) {
    return nextResolve(specifier, context);
  }

  const parentDir = context.parentURL
    ? path.dirname(fileURLToPath(context.parentURL))
    : process.cwd();

  const asFile = path.join(parentDir, specifier + '.js');
  if (fs.existsSync(asFile)) {
    return nextResolve(pathToFileURL(asFile).href, context);
  }

  const asIndex = path.join(parentDir, specifier, 'index.js');
  if (fs.existsSync(asIndex)) {
    return nextResolve(pathToFileURL(asIndex).href, context);
  }

  return nextResolve(specifier, context);
}
