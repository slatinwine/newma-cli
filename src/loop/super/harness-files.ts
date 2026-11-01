/**
 * HarnessFileStore — Harness 文件化（Harness² 前提：harness = 可编辑组件文件）
 *
 * Harness² 把模型外的一切拆成 8 类可编辑组件；DeepSeek 蓝图里这些散在代码中。
 * 本模块把它们落成 .kode/harness/ 下的文件：
 *   system-prompt.md / guardrails.md / memory-policy.md / tool-guidance.md
 *   subagents.md / skills.md / scripts.md / plugins.md
 *
 * 一切自我改进（Harness² 的 Propose–Probe–Compose、经验层的沉淀）都以这些
 * 文件为操作对象。文件不可变历史存 .history/，供行为对比与回滚。
 *
 * 安全边界约定（与 security.ts / Harness² 警告一致）：这些文件是 harness 的
 * 一部分，不是安全边界——真正的权限校验必须在代码层执行。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

/** 8 类可编辑 harness 组件（Harness² 的组件清单） */
export type HarnessComponentKind =
  | 'system-prompt'
  | 'guardrails'
  | 'memory-policy'
  | 'tool-guidance'
  | 'subagents'
  | 'skills'
  | 'scripts'
  | 'plugins';

export const HARNESS_COMPONENT_KINDS: readonly HarnessComponentKind[] = [
  'system-prompt',
  'guardrails',
  'memory-policy',
  'tool-guidance',
  'subagents',
  'skills',
  'scripts',
  'plugins',
];

/** 某一时刻全部组件内容的快照（行为对比的输入/输出单位） */
export interface HarnessSnapshot {
  version: 1;
  /** 快照内容哈希（同哈希 = 同 harness，对比时可跳过） */
  hash: string;
  createdAt: string;
  files: Record<HarnessComponentKind, string>;
}

/** 单组件的当前状态 */
export interface HarnessComponentState {
  kind: HarnessComponentKind;
  file: string;
  exists: boolean;
  hash?: string;
  /** 修订次数（本会话内覆盖次数 + 启动时历史条目数） */
  revisions: number;
}

// ============================================================================
// Store
// ============================================================================

export class HarnessFileStore {
  private readonly dir: string;
  private readonly historyDir: string;
  private revisionCounts = new Map<HarnessComponentKind, number>();

  constructor(dir: string) {
    this.dir = dir;
    this.historyDir = join(dir, '.history');
  }

  get root(): string {
    return this.dir;
  }

  fileFor(kind: HarnessComponentKind): string {
    return join(this.dir, `${kind}.md`);
  }

  // ------------------------------------------------------------------
  // 脚手架
  // ------------------------------------------------------------------

  /** 初始化缺失的组件文件（幂等）。返回新建的组件列表。 */
  scaffold(): HarnessComponentKind[] {
    mkdirSync(this.dir, { recursive: true });
    const created: HarnessComponentKind[] = [];
    for (const kind of HARNESS_COMPONENT_KINDS) {
      const file = this.fileFor(kind);
      if (!existsSync(file)) {
        writeFileSync(file, defaultComponentContent(kind), 'utf8');
        created.push(kind);
      }
    }
    return created;
  }

  // ------------------------------------------------------------------
  // 读取
  // ------------------------------------------------------------------

  /** 读取单个组件；文件不存在返回 undefined。 */
  read(kind: HarnessComponentKind): string | undefined {
    const file = this.fileFor(kind);
    if (!existsSync(file)) return undefined;
    return readFileSync(file, 'utf8');
  }

  /** 读取全部组件为快照（缺失组件以空串占位，保证 files 结构完整）。 */
  snapshot(): HarnessSnapshot {
    const files = {} as Record<HarnessComponentKind, string>;
    for (const kind of HARNESS_COMPONENT_KINDS) {
      files[kind] = this.read(kind) ?? '';
    }
    return {
      version: 1,
      hash: harnessHash(files),
      createdAt: new Date().toISOString(),
      files,
    };
  }

  /** 列出各组件当前状态。 */
  status(): HarnessComponentState[] {
    return HARNESS_COMPONENT_KINDS.map((kind) => {
      const content = this.read(kind);
      const exists = content !== undefined;
      if (!this.revisionCounts.has(kind)) {
        this.revisionCounts.set(kind, exists ? this.countHistory(kind) : 0);
      }
      return {
        kind,
        file: this.fileFor(kind),
        exists,
        hash: exists ? hashContent(content) : undefined,
        revisions: this.revisionCounts.get(kind) ?? 0,
      };
    });
  }

  // ------------------------------------------------------------------
  // 写入（改进的唯一入口；旧内容进 .history/）
  // ------------------------------------------------------------------

  /**
   * 覆盖一个组件。返回是否真的写入了（内容相同则跳过，返回 false）。
   * 旧内容原子化移入 .history/<kind>.<timestamp>.md，可回滚可对比。
   */
  write(kind: HarnessComponentKind, content: string): boolean {
    mkdirSync(this.dir, { recursive: true });
    const file = this.fileFor(kind);
    const old = existsSync(file) ? readFileSync(file, 'utf8') : undefined;

    if (old !== undefined && old === content) return false;

    if (old !== undefined) {
      mkdirSync(this.historyDir, { recursive: true });
      const tmp = join(this.historyDir, `${kind}.${Date.now()}.md.tmp-${process.pid}`);
      writeFileSync(tmp, old, 'utf8');
      renameSync(tmp, join(this.historyDir, `${kind}.${Date.now()}.md`));
    }

    // 原子写新内容
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, file);

    const key = kind as HarnessComponentKind;
    this.revisionCounts.set(key, (this.revisionCounts.get(key) ?? 0) + 1);
    return true;
  }

  /** 批量应用一组编辑（变体提案 → 落地）。返回实际发生变化的组件。 */
  applyEdits(edits: ReadonlyArray<{ kind: HarnessComponentKind; newContent: string }>): HarnessComponentKind[] {
    return edits.filter((e) => this.write(e.kind, e.newContent)).map((e) => e.kind);
  }

  // ------------------------------------------------------------------
  // 历史与回滚
  // ------------------------------------------------------------------

  /** 列出某组件的历史条目（时间升序）。 */
  history(kind: HarnessComponentKind): string[] {
    if (!existsSync(this.historyDir)) return [];
    const prefix = `${kind}.`;
    return readdirSync(this.historyDir)
      .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
      .sort()
      .map((f) => join(this.historyDir, f));
  }

  /** 回滚某组件到指定历史文件（当前内容先入历史）。 */
  rollback(kind: HarnessComponentKind, historyFile: string): boolean {
    if (!existsSync(historyFile)) return false;
    return this.write(kind, readFileSync(historyFile, 'utf8'));
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private countHistory(kind: HarnessComponentKind): number {
    return this.history(kind).length;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** 组件内容哈希。 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

/** 快照哈希：逐组件哈希后整体哈希，顺序稳定。 */
export function harnessHash(files: Record<HarnessComponentKind, string>): string {
  const canonical = HARNESS_COMPONENT_KINDS.map((k) => `${k}:${hashContent(files[k])}`).join('|');
  return hashContent(canonical);
}

/** 两个快照的差异组件列表（用于对比报告）。 */
export function diffSnapshots(
  a: HarnessSnapshot,
  b: HarnessSnapshot
): Array<{ kind: HarnessComponentKind; changed: boolean }> {
  return HARNESS_COMPONENT_KINDS.map((kind) => ({
    kind,
    changed: hashContent(a.files[kind]) !== hashContent(b.files[kind]),
  }));
}

/** 新组件文件的默认内容（脚手架占位，人类/agent 都可改）。 */
function defaultComponentContent(kind: HarnessComponentKind): string {
  const descriptions: Record<HarnessComponentKind, string> = {
    'system-prompt': '# System Prompt\n\n模型的人格与行为准则。改动会影响所有任务的基础行为。',
    guardrails: '# Guardrails\n\n软性护栏（提示层）。注意：这不是安全边界，硬性权限校验在代码层。',
    'memory-policy': '# Memory Policy\n\n记忆的写入与召回策略说明。',
    'tool-guidance': '# Tool Guidance\n\n工具使用偏好与常见坑。',
    subagents: '# Subagents\n\n子代理的分工与调用约定。',
    skills: '# Skills\n\n可复用技能清单与触发条件。',
    scripts: '# Scripts\n\n可复用脚本清单与用法。',
    plugins: '# Plugins\n\n中间件插件说明。',
  };
  return `${descriptions[kind]}\n\n<!-- Harness² 组件：可由人或 agent 编辑；每次覆盖自动留档 .history/ -->\n`;
}

/** 目录便捷构造。 */
export function createHarnessStore(projectRoot: string, dir?: string): HarnessFileStore {
  return new HarnessFileStore(dir ?? join(projectRoot, '.kode', 'harness'));
}
