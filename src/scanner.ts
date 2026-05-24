// src/scanner.ts
import fs from 'fs';
import path from 'path';

export interface ScanOptions {
  maxLinesPerFile?: number;
  maxFiles?: number;
  listOnly?: boolean; // Only return file list, no content
}

/**
 * 递归扫描目录，返回一个「相对路径 → 前 N 行内容」的映射。
 * 为防止 token 爆炸，仅保留每个文件前 `maxLinesPerFile` 行。
 */
export async function scanDirectory(
  root: string,
  options?: number | ScanOptions
): Promise<Record<string, string>> {
  // Handle legacy signature: scanDirectory(root, maxLinesPerFile)
  let maxLinesPerFile = 200;
  let maxFiles = Infinity;
  let listOnly = false;

  if (typeof options === 'number') {
    maxLinesPerFile = options;
  } else if (typeof options === 'object') {
    maxLinesPerFile = options.maxLinesPerFile ?? 200;
    maxFiles = options.maxFiles ?? Infinity;
    listOnly = options.listOnly ?? false;
  }

  const result: Record<string, string> = {};
  let fileCount = 0;

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Stop if we've reached maxFiles
      if (fileCount >= maxFiles) break;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 过滤常见噪声目录
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'].includes(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!['.js', '.ts', '.json', '.md', '.html', '.css', '.tsx', '.jsx', '.vue', '.py', '.go', '.rs'].includes(ext))
          continue;

        const relativePath = path.relative(root, fullPath);

        if (listOnly) {
          // Only store file path, no content
          result[relativePath] = `[File: ${relativePath}]`;
        } else {
          // Store actual content (truncated)
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const trimmed = content.split('\n').slice(0, maxLinesPerFile).join('\n');
          result[relativePath] = trimmed;
        }

        fileCount++;
      }
    }
  }

  await walk(root);
  return result;
}
