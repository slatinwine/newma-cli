/**
 * 推理器 (Reasoner)
 *
 * 职责：分析需求，生成推理过程和行动计划
 * 这是四步循环的第一步
 */

import { callAI } from '../ai';
import { Config } from '../config';
import { ReasoningResult, Action } from './types';
import chalk from 'chalk';

export class Reasoner {
  constructor(
    private config: Config,
    private projectRoot: string
  ) {}

  /**
   * 推理：分析需求，生成计划和推理过程
   *
   * @param requirement 用户需求
   * @param projectInfo 项目信息
   * @param previousReasoning 之前的推理（用于迭代改进）
   * @returns 推理结果
   */
  async reason(
    requirement: string,
    projectInfo: Record<string, string>,
    previousReasoning?: ReasoningResult
  ): Promise<ReasoningResult> {
    console.log(chalk.cyan('\n🧠 步骤 1: 推理\n'));
    console.log(chalk.gray('分析需求，生成推理过程和行动计划...\n'));

    const prompt = this.buildReasoningPrompt(requirement, projectInfo, previousReasoning);

    try {
      const response = await callAI(
        this.config,
        projectInfo,
        prompt,
        'plan',
        undefined,  // no history
        undefined,  // no tools in reasoning phase
        undefined,  // no permissions
        undefined,  // no compression
        this.projectRoot,
        undefined,  // no signal
        undefined,  // no ultrathink
        undefined   // no user profile
      );

      // 解析 AI 响应
      const result = this.parseReasoningResponse(response);

      // 显示推理结果
      this.displayReasoningResult(result);

      return result;

    } catch (error: any) {
      console.error(chalk.red('❌ 推理失败：'), error.message);
      throw error;
    }
  }

  /**
   * 构建推理提示词
   */
  private buildReasoningPrompt(
    requirement: string,
    projectInfo: Record<string, string>,
    previousReasoning?: ReasoningResult
  ): string {
    let prompt = `你是 KODE 的推理器。你的任务是分析需求并生成**可执行的命令**。

**用户需求**：
${requirement}

**项目信息**：
${JSON.stringify(projectInfo, null, 2).substring(0, 2000)}...

**🚨 最重要：你必须返回 JSON 格式的 actions，系统会自动执行这些命令**

**命令类型**：
1. **run** - 执行 shell 命令
   - 查看文件：{"type": "run", "command": "cat README.md"}
   - 列出文件：{"type": "run", "command": "ls -la src/"}
   - 搜索代码：{"type": "run", "command": "grep -r 'pattern' src/"}
   - 运行测试：{"type": "run", "command": "npm test"}

2. **create** - 创建新文件
   - {"type": "create", "path": "src/newfile.ts", "content": "文件内容"}

3. **modify** - 修改现有文件
   - {"type": "modify", "path": "src/file.ts", "oldContent": "旧内容", "newContent": "新内容"}

**必须返回的 JSON 格式**：
{
  "type": "task",
  "todo": ["步骤1：描述", "步骤2：描述", "步骤3：描述"],
  "actions": [
    {"type": "run", "command": "具体的命令"},
    {"type": "create", "path": "文件路径", "content": "内容"}
  ],
  "reasoning": ["为什么这样做", "分析思路"],
  "confidence": 0.8,
  "expectedOutcome": "执行后预期达到什么效果",
  "risks": ["可能的风险"]
}

**示例**：

用户需求："总结项目"
正确的 actions：
[
  {"type": "run", "command": "cat README.md"},
  {"type": "run", "command": "cat package.json"},
  {"type": "run", "command": "ls -la src/"},
  {"type": "run", "command": "find src -name '*.ts' | head -20"}
]

用户需求："添加用户认证"
正确的 actions：
[
  {"type": "run", "command": "ls -la src/"},
  {"type": "create", "path": "src/auth.ts", "content": "..."},
  {"type": "modify", "path": "src/index.ts", "oldContent": "...", "newContent": "..."}
]

**重要提醒**：
- 不要只分析，要生成具体的命令
- 命令必须是可以直接执行的
- 如果需要先查看文件，添加 {"type": "run", "command": "cat ..."} 命令
- 所有命令会被系统自动执行，你只需要生成 JSON`;

    if (previousReasoning) {
      prompt += `

**之前的推理（失败）**：
推理过程：${previousReasoning.reasoning.join('\n')}
置信度：${previousReasoning.confidence}
风险：${previousReasoning.risks.join(', ')}

**请改进你的方案**：
- 分析为什么之前失败了
- 生成新的、更具体的命令
- 确保命令可以直接执行`;
    }

    return prompt;
  }

  /**
   * 解析 AI 响应为推理结果
   */
  private parseReasoningResponse(response: any): ReasoningResult {
    // 提取 actions 和 todo
    const actions: Action[] = response.actions || [];
    const todo: string[] = response.todo || [];

    // 提取推理过程
    const reasoning: string[] = response.reasoning || [
      `计划包含 ${todo.length} 个主要步骤`,
      `将执行 ${actions.length} 个操作`,
    ];

    // 提取其他信息
    const confidence = response.confidence || 0.7;
    const expectedOutcome = response.expectedOutcome || '完成用户需求';
    const risks = response.risks || [];

    // 构建计划
    const plan = {
      description: todo.join(' → '),
      actions,
    };

    return {
      reasoning,
      confidence,
      plan,
      expectedOutcome,
      risks,
    };
  }

  /**
   * 显示推理结果
   */
  private displayReasoningResult(result: ReasoningResult): void {
    // 显示推理过程
    console.log(chalk.cyan('📝 推理过程：'));
    console.log(chalk.gray('─'.repeat(50)));
    result.reasoning.forEach((thought, idx) => {
      console.log(chalk.gray(`${idx + 1}. ${thought}`));
    });
    console.log(chalk.gray('─'.repeat(50)));

    // 显示置信度
    const confidenceColor = result.confidence > 0.7 ? 'green' : result.confidence > 0.4 ? 'yellow' : 'red';
    console.log(chalk[confidenceColor](`\n✓ 置信度：${(result.confidence * 100).toFixed(0)}%`));

    // 显示预期结果
    console.log(chalk.gray(`\n🎯 预期结果：`));
    console.log(chalk.white(`  ${result.expectedOutcome}`));

    // 显示风险
    if (result.risks.length > 0) {
      console.log(chalk.yellow(`\n⚠️  潜在风险：`));
      result.risks.forEach((risk, idx) => {
        console.log(chalk.yellow(`  ${idx + 1}. ${risk}`));
      });
    }

    console.log(chalk.gray('\n' + '─'.repeat(50)));
  }
}
