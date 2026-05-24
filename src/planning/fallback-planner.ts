/**
 * Rule-Based Fallback Planner
 *
 * Generates basic plans for common patterns when AI planning fails.
 * Provides graceful degradation by using rule-based heuristics.
 */

import { Action } from '../validation/schemas';

/**
 * Fallback planner for generating basic plans
 */
export class FallbackPlanner {
  /**
   * Generate a basic plan based on requirement analysis
   */
  generatePlan(requirement: string): { todo: string[]; actions: Action[] } {
    const lowerReq = requirement.toLowerCase();

    // Pattern: Test-related
    if (this.matchesAny(lowerReq, ['test', '测试', 'spec', '单元测试', '测试用例'])) {
      return this.generateTestPlan(requirement);
    }

    // Pattern: Build/compile
    if (this.matchesAny(lowerReq, ['build', 'compile', '构建', '编译', '打包', '构建项目'])) {
      return this.generateBuildPlan(requirement);
    }

    // Pattern: Install dependencies
    if (this.matchesAny(lowerReq, ['install', '依赖', 'dependency', 'npm install', 'npm i', 'yarn add'])) {
      return this.getInstallPlan(requirement);
    }

    // Pattern: Lint/format
    if (this.matchesAny(lowerReq, ['lint', 'format', '格式化', '代码规范', 'eslint', 'prettier'])) {
      return this.generateLintPlan(requirement);
    }

    // Pattern: Clean/clear
    if (this.matchesAny(lowerReq, ['clean', 'clear', '清理', '清除', '删除缓存'])) {
      return this.generateCleanPlan(requirement);
    }

    // Pattern: Git operations
    if (this.matchesAny(lowerReq, ['git', 'commit', 'push', 'pull', '分支', 'branch'])) {
      return this.generateGitPlan(requirement);
    }

    // Pattern: Documentation
    if (this.matchesAny(lowerReq, ['doc', 'readme', '文档', '说明', '注释'])) {
      return this.generateDocPlan(requirement);
    }

    // Default: Generic exploration plan
    return this.generateGenericPlan(requirement);
  }

  /**
   * Generate test-related plan
   */
  private generateTestPlan(requirement: string): { todo: string[]; actions: Action[] } {
    return {
      todo: [
        'Run existing tests',
        'Check test coverage',
        'Verify test results',
      ],
      actions: [
        {
          type: 'run',
          command: 'npm test',
        },
        {
          type: 'run',
          command: 'npm run test:coverage 2>/dev/null || echo "No coverage script"',
        },
      ],
    };
  }

  /**
   * Generate build/compile plan
   */
  private generateBuildPlan(requirement: string): { todo: string[]; actions: Action[] } {
    return {
      todo: [
        'Clean previous build',
        'Build project',
        'Check build output',
      ],
      actions: [
        {
          type: 'run',
          command: 'npm run clean 2>/dev/null || rm -rf dist/ 2>/dev/null || true',
        },
        {
          type: 'run',
          command: 'npm run build',
        },
        {
          type: 'run',
          command: 'ls -la dist/ 2>/dev/null || ls -la build/ 2>/dev/null || echo "Build directory not found"',
        },
      ],
    };
  }

  /**
   * Generate install dependencies plan
   */
  private getInstallPlan(requirement: string): { todo: string[]; actions: Action[] } {
    // Try to extract package name from requirement
    const packageMatch = requirement.match(/(?:install|add|i)\s+([@\w\d\-_/]+)/);

    return {
      todo: [
        'Install dependencies',
        'Verify installation',
      ],
      actions: [
        {
          type: 'run',
          command: packageMatch
            ? `npm install ${packageMatch[1]}`
            : 'npm install',
        },
        {
          type: 'run',
          command: 'npm list --depth=0',
        },
      ],
    };
  }

  /**
   * Generate lint/format plan
   */
  private generateLintPlan(requirement: string): { todo: string[]; actions: Action[] } {
    return {
      todo: [
        'Run linter',
        'Auto-fix issues if available',
        'Check formatting',
      ],
      actions: [
        {
          type: 'run',
          command: 'npm run lint 2>/dev/null || eslint . 2>/dev/null || echo "No linter configured"',
        },
        {
          type: 'run',
          command: 'npm run format 2>/dev/null || prettier --write . 2>/dev/null || echo "No formatter configured"',
        },
      ],
    };
  }

  /**
   * Generate clean plan
   */
  private generateCleanPlan(requirement: string): { todo: string[]; actions: Action[] } {
    return {
      todo: [
        'Remove build artifacts',
        'Clear cache',
        'Remove temporary files',
      ],
      actions: [
        {
          type: 'run',
          command: 'npm run clean 2>/dev/null || rm -rf dist/ build/ *.log 2>/dev/null || true',
        },
        {
          type: 'run',
          command: 'rm -rf node_modules/.cache .cache 2>/dev/null || true',
        },
      ],
    };
  }

  /**
   * Generate git operations plan
   */
  private generateGitPlan(requirement: string): { todo: string[]; actions: Action[] } {
    const lowerReq = requirement.toLowerCase();

    if (lowerReq.includes('commit') || lowerReq.includes('提交')) {
      return {
        todo: ['Check git status', 'Stage changes', 'Commit changes'],
        actions: [
          { type: 'run', command: 'git status' },
          { type: 'run', command: 'git add .' },
          { type: 'run', command: 'git commit -m "Update"' },
        ],
      };
    }

    if (lowerReq.includes('push') || lowerReq.includes('推送')) {
      return {
        todo: ['Push changes to remote'],
        actions: [
          { type: 'run', command: 'git push' },
        ],
      };
    }

    if (lowerReq.includes('pull') || lowerReq.includes('拉取')) {
      return {
        todo: ['Pull latest changes'],
        actions: [
          { type: 'run', command: 'git pull' },
        ],
      };
    }

    // Default git status
    return {
      todo: ['Check git status'],
      actions: [
        { type: 'run', command: 'git status' },
      ],
    };
  }

  /**
   * Generate documentation plan
   */
  private generateDocPlan(requirement: string): { todo: string[]; actions: Action[] } {
    return {
      todo: [
        'Review existing documentation',
        'Check if README exists',
      ],
      actions: [
        {
          type: 'run',
          command: 'ls -la README.md 2>/dev/null || ls -la docs/ 2>/dev/null || echo "No documentation found"',
        },
      ],
    };
  }

  /**
   * Generate generic exploration plan
   */
  private generateGenericPlan(requirement: string): { todo: string[]; actions: Action[] } {
    return {
      todo: [
        'Understand the requirement',
        'Analyze project structure',
        'Identify relevant files',
      ],
      actions: [
        {
          type: 'run',
          command: 'pwd',
        },
        {
          type: 'run',
          command: 'ls -la',
        },
      ],
    };
  }

  /**
   * Check if requirement matches any of the keywords
   */
  private matchesAny(requirement: string, keywords: string[]): boolean {
    return keywords.some(keyword => requirement.includes(keyword));
  }

  /**
   * Extract action type from requirement
   */
  detectActionType(requirement: string): 'create' | 'modify' | 'run' | 'verify' | 'unknown' {
    const lowerReq = requirement.toLowerCase();

    if (this.matchesAny(lowerReq, ['create', 'new', 'add', 'create', '创建', '新建', '添加'])) {
      return 'create';
    }

    if (this.matchesAny(lowerReq, ['modify', 'update', 'change', 'edit', 'refactor', '修改', '更新', '重构', '编辑'])) {
      return 'modify';
    }

    if (this.matchesAny(lowerReq, ['run', 'execute', 'test', 'build', '运行', '执行', '测试', '构建'])) {
      return 'run';
    }

    if (this.matchesAny(lowerReq, ['verify', 'check', 'validate', '验证', '检查'])) {
      return 'verify';
    }

    return 'unknown';
  }
}

/**
 * Singleton instance
 */
export const fallbackPlanner = new FallbackPlanner();
