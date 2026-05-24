// src/context/soulLoader.ts
/**
 * SOUL 文件加载器
 * 融合 OpenClaw SOUL.md + Claude Code CLAUDE.md 设计
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigScanner, getConfigScanner, type ProjectContext } from './configScanner';

export interface SoulConfig {
  /** ~/.newma/SOUL.md — 全局灵魂 */
  globalSoul: string | null;
  /** <project>/.newma/SOUL.md — 项目级灵魂覆盖 */
  projectSoul: string | null;
  /** <project>/NEWMA.md — 项目约定（向上查找） */
  projectRules: string | null;
  /** 子目录 NEWMA.md */
  subDirRules: Map<string, string>;
  /** 项目根目录 */
  projectRoot: string | null;
  /** 构建好的完整提示词 */
  prompt: string;
}

const SOUL_FILE = 'SOUL.md';
const NEWMA_DIR = '.newma';
const CONFIG_FILES = ['NEWMA.md', 'CLAUDE.md'];

/**
 * 加载 SOUL 配置（复用 ConfigScanner 的扫描逻辑）
 */
export async function loadSoul(cwd: string): Promise<SoulConfig> {
  const scanner = getConfigScanner();
  const ctx = await scanner.scan(cwd);

  return {
    globalSoul: ctx.globalSoul,
    projectSoul: ctx.projectSoul,
    projectRules: ctx.projectRules,
    subDirRules: ctx.subDirRules,
    projectRoot: ctx.projectRoot,
    prompt: buildSoulPrompt(ctx),
  };
}

/**
 * 从 ProjectContext 构建 system prompt 注入文本
 */
export function buildSoulPrompt(ctx: ProjectContext): string {
  const parts: string[] = [];

  if (ctx.globalSoul) {
    parts.push('<!-- Global Soul -->');
    parts.push(ctx.globalSoul);
  }

  if (ctx.projectSoul) {
    parts.push('<!-- Project Soul Override -->');
    parts.push(ctx.projectSoul);
  }

  if (ctx.projectRules) {
    parts.push('<!-- Project Rules -->');
    parts.push(ctx.projectRules);
  }

  for (const [dir, content] of ctx.subDirRules) {
    parts.push(`<!-- ${dir} Rules -->`);
    parts.push(content);
  }

  return parts.join('\n\n');
}

/**
 * 初始化默认 SOUL.md（首次使用时）
 */
export async function initDefaultSoul(cwd: string): Promise<string> {
  const soulDir = path.join(os.homedir(), NEWMA_DIR);
  const soulPath = path.join(soulDir, SOUL_FILE);

  if (fs.existsSync(soulPath)) {
    return soulPath;
  }

  const defaultSoul = `# SOUL.md - Newma 灵魂定义

## 身份
- **名字**: 牛码 (Newma)
- **物种**: AI 编程助手
- **风格**: 直接、高效、不废话
- **Emoji**: 🐂

## 核心原则
- 先做再问，能自己查就别打扰用户
- 不装，不懂就说不懂
- 代码质量 > 代码速度 > 代码数量
- 安全第一，破坏性操作必须确认

## 沟通风格
- 简短精炼，直奔主题
- 用代码说话，少用形容词
- 出错了直接说原因和修复方案
- 不用 emoji（除非用户要求）

## 边界
- 不主动推送代码到远程
- 不修改 .env 和密钥文件
- 不删除用户没确认的东西
- 群聊中不代替用户发言

## 记忆
每次会话是新开始，SOUL.md 和 MEMORY.md 是连续性的保障。
`;

  try {
    fs.mkdirSync(soulDir, { recursive: true });
    fs.writeFileSync(soulPath, defaultSoul, 'utf-8');
    return soulPath;
  } catch {
    throw new Error(`Failed to create SOUL.md at ${soulPath}`);
  }
}
