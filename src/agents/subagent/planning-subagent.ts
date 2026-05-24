/**
 * PlanningSubAgent - 规划阶段的 SubAgent
 *
 * 使用只读工具分析需求并生成执行计划
 */

import chalk from 'chalk';
import { BaseSubAgent } from './base-subagent';
import {
  SubAgentConfig,
  SubAgentContext,
  SubAgentResult,
  ExecutionPlan,
} from './types';

/**
 * PlanningSubAgent
 *
 * 负责分析需求并生成执行计划
 * 只允许使用只读工具
 */
export class PlanningSubAgent extends BaseSubAgent {
  protected getSubAgentConfig(): SubAgentConfig {
    return {
      id: 'planning-subagent',
      name: 'Planning SubAgent',
      description: 'Analyzes requirements and creates execution plans',
      systemPrompt: `You are a planning specialist.

Your job is to analyze user requirements and create detailed execution plans.

**YOUR ROLE**
1. Understand what the user wants to achieve
2. Analyze the project structure (using read-only tools)
3. Create a step-by-step execution plan
4. Return the plan in a structured format

**AVAILABLE TOOLS (READ-ONLY)**
- read_file: Read file contents to understand code
- list_directory: List directory contents
- find_files: Find files by pattern
- search_content: Search for content in files

**OUTPUT FORMAT**
Your response should include:
1. **Analysis**: Brief summary of what you understood
2. **TODO List**: Step-by-step tasks (as an array)
3. **Actions**: Specific actions to take (as an array)

Example:
\`\`\`json
{
  "analysis": "User wants to add a login feature",
  "todo": [
    "Analyze existing authentication code",
    "Design login component structure",
    "Create login page component",
    "Add authentication logic"
  ],
  "actions": [
    {
      "type": "read",
      "path": "src/auth/index.ts",
      "description": "Review existing auth code"
    },
    {
      "type": "create",
      "path": "src/components/Login.tsx",
      "content": "login component code",
      "description": "Create login page"
    }
  ]
}
\`\`\`

**IMPORTANT**
- ONLY use read-only tools
- Do NOT create, modify, or delete anything
- Be thorough in your analysis
- Provide clear, actionable steps`,
      allowedTools: [
        'read_file',
        'list_directory',
        'find_files',
        'search_content',
      ],
      maxIterations: 10,
      temperature: 0.7,
    };
  }

  /**
   * 执行规划任务
   *
   * @param requirement 用户需求
   * @param context 可选的额外上下文
   * @returns 规划结果
   */
  async execute(requirement: string, context?: any): Promise<SubAgentResult> {
    console.log(chalk.cyan('\n🧠 Phase 1: Planning (using tools)...'));
    console.log(chalk.gray('─'.repeat(50)));

    // 执行 Function Calling
    const result = await this.executeWithFunctionCalling(requirement, []);

    console.log(chalk.gray('─'.repeat(50)));

    // 解析计划
    const plan = this.parsePlan(result.output);

    // 显示计划
    this.displayPlan(plan);

    return {
      ...result,
      metadata: {
        plan,
      },
    };
  }

  /**
   * 解析 AI 返回的计划
   *
   * @param output AI 输出文本
   * @returns 解析后的计划
   */
  private parsePlan(output: string): ExecutionPlan {
    // 尝试提取 JSON 格式的计划
    const jsonMatch = output.match(/\{[\s\S]*"analysis"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // 验证格式
        if (parsed.todo && Array.isArray(parsed.todo)) {
          return {
            todo: parsed.todo,
            actions: parsed.actions || [],
          };
        }
      } catch (e) {
        // JSON 解析失败，fallback
      }
    }

    // Fallback: 从文本中提取 TODO 列表
    const todoList = this.extractTodoList(output);

    return {
      todo: todoList.length > 0 ? todoList : [output],
      actions: [],
    };
  }

  /**
   * 从文本中提取 TODO 列表
   */
  private extractTodoList(text: string): string[] {
    const todos: string[] = [];

    // 尝试匹配 Markdown 列表格式
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // 匹配 "1. item" 或 "- item" 或 "* item"
      const match = trimmed.match(/^(\d+\.|[-*])\s+(.+)/);
      if (match) {
        todos.push(match[2]);
      }
    }

    return todos;
  }

  /**
   * 显示计划
   */
  private displayPlan(plan: ExecutionPlan): void {
    console.log(chalk.cyan('\n📋 Generated Plan:'));
    console.log(chalk.magenta('\nTODO List:'));
    console.log(chalk.magenta('─'.repeat(50)));

    if (plan.todo && plan.todo.length > 0) {
      plan.todo.forEach((item, idx) => {
        console.log(chalk.gray(`  ${idx + 1}. ${item}`));
      });
    } else {
      console.log(chalk.gray('  No specific TODO items'));
    }

    console.log(chalk.magenta('─'.repeat(50)));

    if (plan.actions && plan.actions.length > 0) {
      console.log(chalk.magenta('\nPlanned Actions:'));
      plan.actions.forEach((action, idx) => {
        const icon = this.getActionIcon(action.type);
        const actionStr = chalk.gray(`${icon} [${action.type.toUpperCase()}] ${action.description}`);

        if (action.path) {
          console.log(`  ${idx + 1}. ${actionStr}`);
          console.log(chalk.gray(`     Path: ${action.path}`));
        } else if (action.command) {
          console.log(`  ${idx + 1}. ${actionStr}`);
          console.log(chalk.gray(`     Command: ${action.command}`));
        } else {
          console.log(`  ${idx + 1}. ${actionStr}`);
        }
      });
    }

    console.log('');
  }

  /**
   * 获取动作类型图标
   */
  private getActionIcon(type: string): string {
    const icons: Record<string, string> = {
      read: '📖',
      create: '📝',
      modify: '✏️',
      delete: '🗑️',
      run: '⚡',
      verify: '✅',
    };
    return icons[type] || '📌';
  }
}
