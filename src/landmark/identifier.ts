/**
 * Landmark Identifier - 路标识别器
 *
 * 从用户需求中识别关键里程碑（路标），使用AI分析和提取子目标。
 */

import chalk from 'chalk';
import { Config } from '../config';
import { Landmark, RawLandmark, DependencyAnalysis, LandmarkType } from './types';
import { Action } from '../types';
import fetch from 'node-fetch';

/**
 * 路标识别器
 */
export class LandmarkIdentifier {
  /**
   * 识别路标（核心算法）
   *
   * 步骤：
   * 1. 使用AI从需求中提取关键里程碑
   * 2. 分析路标间的依赖关系
   * 3. 为每个路标分配具体动作
   *
   * @param config OpenAI配置
   * @param requirement 用户需求
   * @param projectInfo 项目信息
   * @param context 额外上下文
   * @returns 识别的路标列表
   */
  async identifyLandmarks(
    config: Config,
    requirement: string,
    projectInfo: Record<string, string>,
    context: string = ''
  ): Promise<Landmark[]> {
    // Step 1: 使用AI提取路标
    const rawLandmarks = await this.extractLandmarksWithAI(
      config,
      requirement,
      projectInfo,
      context
    );

    // Step 2: 分析依赖关系
    const withDependencies = await this.analyzeDependencies(
      config,
      rawLandmarks,
      requirement,
      projectInfo
    );

    // Step 3: 为每个路标分配动作
    const withActions = await this.assignActionsToLandmarks(
      config,
      withDependencies,
      requirement,
      projectInfo
    );

    return withActions;
  }

  /**
   * 使用AI从需求中提取路标
   *
   * Prompt策略：
   * - 要求AI识别可验证的子目标
   * - 提供路标类型的定义和示例
   * - 返回结构化的JSON格式
   */
  private async extractLandmarksWithAI(
    config: Config,
    requirement: string,
    projectInfo: Record<string, string>,
    context: string
  ): Promise<RawLandmark[]> {
    const endpoint = config.endpoint ||
      `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    const systemPrompt = `You are a task planning expert. Your job is to break down requirements into key milestones (landmarks).

LANDMARK TYPES:
- file_creation: Creating new files (e.g., components, models, tests)
- file_modification: Modifying existing files
- command_execution: Running commands (e.g., build, test, install)
- test: Running tests to verify functionality
- verification: Verifying results manually or automatically
- dependency_install: Installing dependencies
- refactoring: Refactoring existing code
- documentation: Writing or updating documentation

RULES:
1. Each landmark should be a VERIFIABLE sub-goal
2. Landmarks should be roughly equal in complexity (2-5 steps each)
3. Order landmarks logically (what should happen first)
4. Be specific but not overly detailed
5. Typical number: 3-7 landmarks for most tasks

OUTPUT FORMAT (JSON array):
[
  {
    "description": "Create user model with authentication fields",
    "type": "file_creation",
    "estimatedSteps": 2,
    "priority": "high"
  },
  ...
]`;

    const userPrompt = `Break down this requirement into key milestones (landmarks):

REQUIREMENT: ${requirement}

${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ''}

${Object.keys(projectInfo).length > 0 ? `PROJECT CONTEXT:\n${Object.keys(projectInfo).slice(0, 10).join('\n')}` : ''}

Return ONLY a JSON array of landmarks. No explanation, no markdown, just JSON.`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.7,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in API response');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const rawLandmarks: RawLandmark[] = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(rawLandmarks) || rawLandmarks.length === 0) {
        throw new Error('Invalid landmarks format or empty array');
      }

      // Validate and normalize
      return rawLandmarks.map((lm, idx) => ({
        description: lm.description || `Landmark ${idx + 1}`,
        type: lm.type || LandmarkType.FILE_CREATION,
        estimatedSteps: lm.estimatedSteps || 2,  // Ensure always a number
        priority: lm.priority || 'medium',
      }));

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }

      console.error(chalk.red(`❌ Landmark extraction error: ${error.message}`));
      throw error;
    }
  }

  /**
   * 分析路标间的依赖关系
   *
   * 使用AI判断哪些路标必须在其他路标之前完成
   */
  private async analyzeDependencies(
    config: Config,
    rawLandmarks: RawLandmark[],
    requirement: string,
    projectInfo: Record<string, string>
  ): Promise<Landmark[]> {
    const endpoint = config.endpoint ||
      `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    // 为每个路标分配ID
    const landmarks: Landmark[] = rawLandmarks.map((lm, idx) => ({
      id: `lm-${idx + 1}`,
      description: lm.description,
      type: lm.type,
      dependsOn: [],
      actions: [],
      estimatedSteps: lm.estimatedSteps || 2,  // Default to 2 steps
      priority: lm.priority || 'medium',        // Default to medium
    }));

    // 如果只有1-2个路标，不需要复杂的依赖分析
    if (landmarks.length <= 2) {
      // 简单顺序依赖：后一个依赖前一个
      for (let i = 1; i < landmarks.length; i++) {
        landmarks[i].dependsOn = [`lm-${i}`];
      }
      return landmarks;
    }

    // 使用AI分析依赖关系
    const landmarksList = landmarks
      .map((lm, idx) => `${idx + 1}. [${lm.id}] ${lm.description} (${lm.type})`)
      .join('\n');

    const userPrompt = `Analyze dependencies between these landmarks for the requirement: "${requirement}"

LANDMARKS:
${landmarksList}

For EACH landmark, identify which other landmarks must be completed BEFORE it can start.

OUTPUT FORMAT (JSON object):
{
  "lm-1": {
    "dependsOn": [],
    "reason": "First milestone, no dependencies"
  },
  "lm-2": {
    "dependsOn": ["lm-1"],
    "reason": "Needs user model to be created first"
  },
  ...
}

Rules:
- First landmark typically has no dependencies
- Avoid circular dependencies
- Only mark NECESSARY dependencies (things that MUST come before)
- Return ONLY JSON, no explanation`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.5,  // Lower temperature for more consistent analysis
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in API response');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const analysis: Record<string, DependencyAnalysis> = JSON.parse(jsonMatch[0]);

      // Apply dependencies to landmarks
      for (const landmark of landmarks) {
        const depInfo = analysis[landmark.id];
        if (depInfo && Array.isArray(depInfo.dependsOn)) {
          landmark.dependsOn = depInfo.dependsOn;
        }
      }

      return landmarks;

    } catch (error: any) {
      // Fallback: simple sequential dependency if AI analysis fails
      console.log(chalk.yellow('⚠️  Dependency analysis failed, using sequential order'));
      for (let i = 1; i < landmarks.length; i++) {
        landmarks[i].dependsOn = [`lm-${i}`];
      }
      return landmarks;
    }
  }

  /**
   * 为每个路标分配具体动作
   *
   * 使用AI为每个路标生成实现它的具体Action列表
   */
  private async assignActionsToLandmarks(
    config: Config,
    landmarks: Landmark[],
    requirement: string,
    projectInfo: Record<string, string>
  ): Promise<Landmark[]> {
    const endpoint = config.endpoint ||
      `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    for (const landmark of landmarks) {
      // 根据路标类型生成不同的prompt
      const actionPrompt = this.generateActionPrompt(landmark, requirement, projectInfo);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.7,
            max_tokens: 2048,
            messages: [
              {
                role: 'system',
                content: `You are a code generation expert. Generate specific actions to implement a milestone.

ACTION TYPES:
- create: Create a new file with content
- modify: Modify an existing file
- run: Run a shell command
- verify: Run a verification command

Return ONLY a JSON array of actions. No explanation.`,
              },
              {
                role: 'user',
                content: actionPrompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('No content in API response');
        }

        // Extract JSON array
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          landmark.actions = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: generate a simple action based on type
          landmark.actions = this.generateFallbackActions(landmark);
        }

        landmark.estimatedSteps = landmark.actions.length;

      } catch (error: any) {
        console.log(chalk.yellow(`⚠️  Action generation failed for ${landmark.id}, using fallback`));
        landmark.actions = this.generateFallbackActions(landmark);
        landmark.estimatedSteps = landmark.actions.length;
      }
    }

    return landmarks;
  }

  /**
   * 生成用于动作生成的prompt
   */
  private generateActionPrompt(
    landmark: Landmark,
    requirement: string,
    projectInfo: Record<string, string>
  ): string {
    let prompt = `Generate specific actions to implement this milestone:

MILESTONE: ${landmark.description}
TYPE: ${landmark.type}
PRIORITY: ${landmark.priority}

ORIGINAL REQUIREMENT: ${requirement}

`;

    if (Object.keys(projectInfo).length > 0) {
      prompt += `PROJECT STRUCTURE:\n${Object.keys(projectInfo).slice(0, 5).join('\n')}\n\n`;
    }

    prompt += `Generate ${landmark.estimatedSteps || 2} actions to complete this milestone.

OUTPUT FORMAT (JSON array):
[
  {
    "type": "create",
    "path": "src/models/User.ts",
    "content": "export interface User { id: number; name: string; }"
  },
  {
    "type": "run",
    "command": "npm test"
  }
]

Return ONLY JSON, no explanation.`;

    return prompt;
  }

  /**
   * 生成fallback动作（当AI生成失败时）
   */
  private generateFallbackActions(landmark: Landmark): Action[] {
    const baseAction: Partial<Action> = {
      type: 'create',
    };

    switch (landmark.type) {
      case LandmarkType.FILE_CREATION:
        return [{
          ...baseAction,
          type: 'create',
          path: `temp/${landmark.id}.txt`,
          content: `// ${landmark.description}\n// To be implemented`,
        } as Action];

      case LandmarkType.COMMAND_EXECUTION:
      case LandmarkType.TEST:
        return [{
          ...baseAction,
          type: 'run',
          command: `echo "Implementing: ${landmark.description}"`,
        } as Action];

      case LandmarkType.VERIFICATION:
        return [{
          ...baseAction,
          type: 'verify',
          command: `echo "Verifying: ${landmark.description}"`,
        } as Action];

      default:
        return [{
          ...baseAction,
          type: 'create',
          path: `temp/${landmark.id}.md`,
          content: `# ${landmark.description}\n\nTODO: Implement this milestone`,
        } as Action];
    }
  }
}
