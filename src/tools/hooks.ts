// src/tools/hooks.ts
/**
 * 工具 Hook 系统
 * 参考 Claude Code 2.1.88 src/services/tools/toolHooks.ts
 * 支持 beforeToolUse / afterToolUse / onToolError 钩子
 */

export interface ToolHookContext {
  tool: string;
  input: unknown;
  sessionId?: string;
  timestamp: number;
}

export interface ToolHookResult {
  /** beforeToolUse: false 表示阻止执行 */
  proceed?: boolean;
  /** beforeToolUse: 阻止原因 */
  reason?: string;
  /** afterToolUse/onToolError: 修改后的输出 */
  modifiedOutput?: unknown;
  /** afterToolUse: 是否重试 */
  retry?: boolean;
}

export interface ToolHook {
  /** 工具名，* 表示所有工具 */
  toolPattern: string;
  /** 工具调用前 */
  beforeToolUse?(ctx: ToolHookContext): ToolHookResult | Promise<ToolHookResult>;
  /** 工具调用后 */
  afterToolUse?(ctx: ToolHookContext, output: unknown): ToolHookResult | Promise<ToolHookResult>;
  /** 工具调用出错 */
  onToolError?(ctx: ToolHookContext, error: Error): ToolHookResult | Promise<ToolHookResult>;
}

export class ToolHookManager {
  private hooks: ToolHook[] = [];

  /**
   * 注册一个钩子
   */
  register(hook: ToolHook): this {
    this.hooks.push(hook);
    return this;
  }

  /**
   * 移除所有匹配的钩子
   */
  unregister(toolPattern: string): void {
    this.hooks = this.hooks.filter((h) => h.toolPattern !== toolPattern);
  }

  /**
   * 运行 beforeToolUse 钩子链
   * 任一钩子返回 proceed=false 则阻止执行
   */
  async runBefore(ctx: ToolHookContext): Promise<{ proceed: boolean; reason?: string }> {
    for (const hook of this.hooks) {
      if (!this.matches(hook.toolPattern, ctx.tool)) continue;
      if (!hook.beforeToolUse) continue;

      try {
        const result = await hook.beforeToolUse(ctx);
        if (result.proceed === false) {
          return { proceed: false, reason: result.reason };
        }
      } catch (e) {
        // 钩子错误不阻止执行
      }
    }
    return { proceed: true };
  }

  /**
   * 运行 afterToolUse 钩子链
   */
  async runAfter(ctx: ToolHookContext, output: unknown): Promise<unknown> {
    let currentOutput = output;

    for (const hook of this.hooks) {
      if (!this.matches(hook.toolPattern, ctx.tool)) continue;
      if (!hook.afterToolUse) continue;

      try {
        const result = await hook.afterToolUse(ctx, currentOutput);
        if (result.modifiedOutput !== undefined) {
          currentOutput = result.modifiedOutput;
        }
      } catch {
        // 钩子错误不影响
      }
    }

    return currentOutput;
  }

  /**
   * 运行 onToolError 钩子链
   */
  async runError(ctx: ToolHookContext, error: Error): Promise<{ retry?: boolean }> {
    for (const hook of this.hooks) {
      if (!this.matches(hook.toolPattern, ctx.tool)) continue;
      if (!hook.onToolError) continue;

      try {
        const result = await hook.onToolError(ctx, error);
        if (result.retry) {
          return { retry: true };
        }
      } catch {
        // 钩子错误不影响
      }
    }
    return {};
  }

  /**
   * 列出所有已注册的钩子
   */
  list(): Array<{ toolPattern: string; hasBefore: boolean; hasAfter: boolean; hasError: boolean }> {
    return this.hooks.map((h) => ({
      toolPattern: h.toolPattern,
      hasBefore: !!h.beforeToolUse,
      hasAfter: !!h.afterToolUse,
      hasError: !!h.onToolError,
    }));
  }

  private matches(pattern: string, tool: string): boolean {
    if (pattern === '*') return true;
    if (pattern === tool) return true;
    // 简单前缀匹配
    if (pattern.endsWith('*') && tool.startsWith(pattern.slice(0, -1))) return true;
    return false;
  }
}

// ─── 内置钩子工厂 ───

/**
 * 创建文件写入审计钩子
 */
export function createAuditHook(): ToolHook {
  return {
    toolPattern: 'file',
    afterToolUse(ctx, output) {
      const input = ctx.input as Record<string, unknown>;
      if (input.action === 'delete') {
        console.log(`[audit] DELETE: ${input.path}`);
      }
      return {};
    },
  };
}

/**
 * 创建工具调用耗时统计钩子
 */
export function createTimingHook(): ToolHook {
  const timings = new Map<string, number>();

  return {
    toolPattern: '*',
    beforeToolUse(ctx) {
      timings.set(ctx.tool + ':' + ctx.timestamp, Date.now());
      return {};
    },
    afterToolUse(ctx) {
      const key = ctx.tool + ':' + ctx.timestamp;
      const start = timings.get(key);
      if (start) {
        const duration = Date.now() - start;
        timings.delete(key);
        // 超过 5 秒发出警告
        if (duration > 5000) {
          console.log(`[timing] ${ctx.tool} took ${duration}ms`);
        }
      }
      return {};
    },
  };
}
