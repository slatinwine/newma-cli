/**
 * REPL 历史记录导航模块
 */

/**
 * 历史导航管理器
 */
export class HistoryNavigator {
  private history: string[] = [];
  private index: number = -1;
  private pendingInput?: string;
  private maxSize: number = 1000;

  /**
   * 添加命令到历史
   */
  add(command: string): void {
    if (!command.trim()) return;

    // 避免连续重复
    if (this.history[this.history.length - 1] !== command) {
      this.history.push(command);

      // 限制大小
      if (this.history.length > this.maxSize) {
        this.history.shift();
      }
    }

    this.index = -1;
    this.pendingInput = undefined;
  }

  /**
   * 向上导航（更早的命令）
   */
  navigateUp(currentInput: string): string | null {
    if (this.history.length === 0) return null;

    // 保存当前输入
    if (this.index === -1) {
      this.pendingInput = currentInput;
    }

    if (this.index < this.history.length - 1) {
      this.index++;
      return this.history[this.history.length - 1 - this.index];
    }

    return this.history[0];
  }

  /**
   * 向下导航（更新的命令）
   */
  navigateDown(): string | null {
    if (this.index === -1) return null;

    if (this.index > 0) {
      this.index--;
      return this.history[this.history.length - 1 - this.index];
    }

    // 返回保存的输入
    this.index = -1;
    return this.pendingInput ?? '';
  }

  /**
   * 重置导航状态
   */
  reset(): void {
    this.index = -1;
    this.pendingInput = undefined;
  }

  /**
   * 获取历史列表
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * 搜索历史
   */
  search(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(cmd =>
      cmd.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
    this.index = -1;
    this.pendingInput = undefined;
  }
}
