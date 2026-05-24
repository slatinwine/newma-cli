/**
 * Intent Recognizer - 意图识别器
 *
 * 使用启发式规则和AI分析用户需求，自动选择最合适的规划算法。
 */

import chalk from 'chalk';
import { Config } from '../config';
import {
  Intent,
  IntentFeatures,
  TaskType,
  ComplexityLevel,
  PlanningAlgorithm,
} from './types';

/**
 * 意图识别器
 */
export class IntentRecognizer {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * 识别意图并推荐算法（主入口）
   *
   * @param requirement 用户需求
   * @param projectInfo 项目信息（可选）
   * @param useAI 是否使用AI进行识别（默认false，使用启发式规则）
   * @returns Intent 识别结果
   */
  async recognizeIntent(
    requirement: string,
    projectInfo?: Record<string, string>,
    useAI: boolean = false
  ): Promise<Intent> {
    // 提取特征
    const features = this.extractFeatures(requirement);

    if (useAI) {
      // 使用AI进行意图识别（更准确但更慢）
      return await this.recognizeWithAI(requirement, features, projectInfo);
    } else {
      // 使用启发式规则（快速但可能不够准确）
      return this.recognizeWithHeuristics(requirement, features);
    }
  }

  /**
   * 使用启发式规则识别意图
   *
   * 优点：快速、无需API调用
   * 缺点：可能不够准确，规则固定
   */
  private recognizeWithHeuristics(
    requirement: string,
    features: IntentFeatures
  ): Intent {
    const taskType = this.classifyTaskType(requirement, features);
    const complexity = this.assessComplexity(requirement, features);
    const algorithm = this.selectAlgorithm(taskType, complexity);
    const confidence = this.calculateConfidence(features, algorithm);
    const reasoning = this.generateReasoning(taskType, complexity, algorithm, features);
    const keywords = this.extractKeywords(requirement);

    return {
      taskType,
      complexity,
      recommendedAlgorithm: algorithm,
      confidence,
      reasoning,
      keywords,
      estimatedSteps: this.estimateSteps(requirement, complexity, features),
    };
  }

  /**
   * 使用AI进行意图识别
   *
   * 优点：更准确、可以理解复杂需求
   * 缺点：需要API调用、速度较慢
   */
  private async recognizeWithAI(
    requirement: string,
    features: IntentFeatures,
    projectInfo?: Record<string, string>
  ): Promise<Intent> {
    const endpoint = this.config.endpoint ||
      `${this.config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    const systemPrompt = `You are an expert at analyzing task requirements and recommending the best planning approach.

PLANNING ALGORITHMS:
1. FFT (Fast and Frugal Tree) - For simple questions and quick queries
   - Best for: Q&A, definitions, explanations
   - Response time: 1-2 seconds

2. Landmark Counting - For medium complexity tasks with clear sub-goals
   - Best for: Feature development, multi-step tasks
   - Response time: 3-5 seconds

3. ToT (Tree of Thoughts) - For complex tasks requiring deep reasoning
   - Best for: Architecture changes, complex refactoring
   - Response time: 10-30 seconds

4. Standard AI - Default fallback
   - Best for: Simple tasks or when other methods fail

TASK TYPES:
- question: Q&A, explanations, definitions
- code_generation: Writing code snippets
- feature_development: Building new features
- refactoring: Restructuring existing code
- debugging: Finding and fixing bugs
- documentation: Writing docs
- testing: Writing tests
- architecture: System design
- other: Other tasks

COMPLEXITY LEVELS:
- simple: Single step, well-defined
- medium: 3-10 steps, some dependencies
- complex: 10+ steps, many dependencies, architectural impact

OUTPUT FORMAT (JSON):
{
  "taskType": "feature_development",
  "complexity": "medium",
  "recommendedAlgorithm": "landmark",
  "confidence": 0.85,
  "reasoning": "Task involves multiple steps with clear dependencies",
  "keywords": ["authentication", "JWT", "routes"],
  "estimatedSteps": 8
}

Return ONLY JSON, no explanation.`;

    const userPrompt = `Analyze this requirement and recommend the best planning algorithm:

REQUIREMENT: ${requirement}

${features ? `\nFEATURES:\n- Length: ${features.length} chars\n- Words: ${features.wordCount}\n- Has question words: ${features.hasQuestionWords}\n- Mentions files: ${features.mentionsFiles}\n- Multiple steps: ${features.hasMultipleSteps}` : ''}

${projectInfo && Object.keys(projectInfo).length > 0 ? `\nPROJECT CONTEXT:\n${Object.keys(projectInfo).slice(0, 5).join('\n')}` : ''}

Return ONLY JSON.`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.3,  // Low temperature for consistent classification
          max_tokens: 1024,
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const intent: Intent = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!intent.taskType || !intent.complexity || !intent.recommendedAlgorithm) {
        throw new Error('Invalid intent format: missing required fields');
      }

      return intent;

    } catch (error: any) {
      console.log(chalk.yellow('⚠️  AI intent recognition failed, using heuristics'));
      // Fallback to heuristics
      return this.recognizeWithHeuristics(requirement, features);
    }
  }

  /**
   * 提取文本特征
   */
  private extractFeatures(text: string): IntentFeatures {
    const lowerText = text.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);

    // 疑问词
    const questionWords = ['what', 'how', 'why', 'where', 'when', 'who', 'which', '什么', '如何', '怎么', '为什么', '怎么'];
    const hasQuestionWords = questionWords.some(w => lowerText.includes(w));

    // 技术术语
    const technicalTerms = ['api', 'function', 'class', 'interface', 'component', 'module', 'service', 'database', '算法', '函数', '类', '接口'];
    const hasTechnicalTerms = technicalTerms.some(t => lowerText.includes(t));

    // 动作动词
    const actionVerbs = ['create', 'add', 'implement', 'build', 'develop', 'refactor', 'fix', 'test', '创建', '添加', '实现', '开发', '重构', '修复'];
    const hasActionVerbs = actionVerbs.some(v => lowerText.includes(v));

    // 文件相关
    const filePatterns = [/\.ts/, /\.js/, /\.py/, /\.json/, /file/i, /文件/];
    const mentionsFiles = filePatterns.some(p => p.test(text));

    // 多个文件
    const multipleFileIndicators = [' and ', ' plus ', ' also ', ' multiple ', '、', '和', '还有'];
    const mentionsMultipleFiles = mentionsFiles && multipleFileIndicators.some(i => lowerText.includes(i));

    // 依赖相关
    const dependencyWords = ['depend', 'require', 'import', 'install', '依赖', '需要', '导入'];
    const mentionsDependencies = dependencyWords.some(w => lowerText.includes(w));

    // 测试相关
    const testWords = ['test', 'spec', 'verify', 'check', '测试', '验证'];
    const mentionsTests = testWords.some(w => lowerText.includes(w));

    // 架构相关
    const architectureWords = ['architecture', 'design', 'structure', 'pattern', '架构', '设计', '结构'];
    const mentionsArchitecture = architectureWords.some(w => lowerText.includes(w));

    // 多步骤
    const stepIndicators = ['then', 'after', 'next', 'finally', 'step', '然后', '之后', '接下来', '步骤'];
    const hasMultipleSteps = stepIndicators.some(i => lowerText.includes(i));

    // 条件逻辑
    const conditionWords = ['if', 'when', 'case', 'depending', '如果', '当', '根据情况'];
    const hasConditions = conditionWords.some(w => lowerText.includes(w));

    // 需求不明确
    const uncertainIndicators = ['maybe', 'possibly', 'might', 'unclear', '可能', '也许'];
    const hasUnclearRequirements = uncertainIndicators.some(i => lowerText.includes(i));

    return {
      length: text.length,
      wordCount: words.length,
      hasQuestionWords,
      hasTechnicalTerms,
      hasActionVerbs,
      mentionsFiles,
      mentionsMultipleFiles,
      mentionsDependencies,
      mentionsTests,
      mentionsArchitecture,
      hasMultipleSteps,
      hasConditions,
      hasUnclearRequirements,
    };
  }

  /**
   * 分类任务类型
   */
  private classifyTaskType(requirement: string, features: IntentFeatures): TaskType {
    const lowerReq = requirement.toLowerCase();

    // 问答类
    if (features.hasQuestionWords && !features.hasActionVerbs) {
      return TaskType.QUESTION;
    }

    // 架构设计
    if (features.mentionsArchitecture) {
      return TaskType.ARCHITECTURE;
    }

    // 重构
    if (/refactor|restructure|clean|optimize|重构|优化|清理/.test(lowerReq)) {
      return TaskType.REFACTORING;
    }

    // 调试
    if (/debug|fix|error|bug|issue|调试|修复|错误/.test(lowerReq)) {
      return TaskType.DEBUGGING;
    }

    // 测试
    if (features.mentionsTests || /test|spec|测试/.test(lowerReq)) {
      return TaskType.TESTING;
    }

    // 文档
    if (/doc|readme|comment|文档|注释/.test(lowerReq)) {
      return TaskType.DOCUMENTATION;
    }

    // 功能开发（默认）
    if (features.hasActionVerbs || features.mentionsFiles) {
      return TaskType.FEATURE_DEVELOPMENT;
    }

    return TaskType.OTHER;
  }

  /**
   * 评估复杂度
   */
  private assessComplexity(requirement: string, features: IntentFeatures): ComplexityLevel {
    let complexityScore = 0;

    // 文本长度（0-2分）
    if (features.length > 200) complexityScore += 2;
    else if (features.length > 100) complexityScore += 1;

    // 多个文件（+2分）
    if (features.mentionsMultipleFiles) complexityScore += 2;

    // 多步骤（+2分）
    if (features.hasMultipleSteps) complexityScore += 2;

    // 条件逻辑（+1分）
    if (features.hasConditions) complexityScore += 1;

    // 依赖关系（+1分）
    if (features.mentionsDependencies) complexityScore += 1;

    // 架构相关（+3分）
    if (features.mentionsArchitecture) complexityScore += 3;

    // 需求不明确（+2分）
    if (features.hasUnclearRequirements) complexityScore += 2;

    // 评分
    if (complexityScore <= 3) return ComplexityLevel.SIMPLE;
    if (complexityScore <= 7) return ComplexityLevel.MEDIUM;
    return ComplexityLevel.COMPLEX;
  }

  /**
   * 选择算法
   */
  private selectAlgorithm(taskType: TaskType, complexity: ComplexityLevel): PlanningAlgorithm {
    // 简单任务
    if (complexity === ComplexityLevel.SIMPLE) {
      if (taskType === TaskType.QUESTION) {
        return PlanningAlgorithm.FFT;
      }
      return PlanningAlgorithm.STANDARD;
    }

    // 中等任务
    if (complexity === ComplexityLevel.MEDIUM) {
      if (taskType === TaskType.FEATURE_DEVELOPMENT ||
          taskType === TaskType.CODE_GENERATION ||
          taskType === TaskType.TESTING) {
        return PlanningAlgorithm.LANDMARK;
      }
      return PlanningAlgorithm.STANDARD;
    }

    // 复杂任务
    if (complexity === ComplexityLevel.COMPLEX) {
      if (taskType === TaskType.ARCHITECTURE ||
          taskType === TaskType.REFACTORING) {
        return PlanningAlgorithm.TOT;
      }
      return PlanningAlgorithm.LANDMARK;
    }

    return PlanningAlgorithm.STANDARD;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(features: IntentFeatures, algorithm: PlanningAlgorithm): number {
    let confidence = 0.5;  // 基础置信度

    // 特征明显性
    if (features.hasQuestionWords) confidence += 0.1;
    if (features.hasTechnicalTerms) confidence += 0.1;
    if (features.mentionsArchitecture) confidence += 0.15;
    if (features.mentionsMultipleFiles) confidence += 0.1;
    if (features.hasMultipleSteps) confidence += 0.1;

    // 算法特定调整
    if (algorithm === PlanningAlgorithm.FFT && features.hasQuestionWords) {
      confidence += 0.2;
    }
    if (algorithm === PlanningAlgorithm.LANDMARK && features.mentionsFiles) {
      confidence += 0.15;
    }
    if (algorithm === PlanningAlgorithm.TOT && features.mentionsArchitecture) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(
    taskType: TaskType,
    complexity: ComplexityLevel,
    algorithm: PlanningAlgorithm,
    features: IntentFeatures
  ): string {
    const reasons: string[] = [];

    reasons.push(`Task type: ${taskType}`);
    reasons.push(`Complexity: ${complexity}`);

    if (features.hasQuestionWords) {
      reasons.push('Contains question words (Q&A task)');
    }
    if (features.mentionsArchitecture) {
      reasons.push('Mentions architecture (complex task)');
    }
    if (features.mentionsMultipleFiles) {
      reasons.push('Involves multiple files');
    }
    if (features.hasMultipleSteps) {
      reasons.push('Multiple steps detected');
    }

    reasons.push(`Recommended: ${algorithm} planning`);

    return reasons.join('\n• ');
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const lowerText = text.toLowerCase();

    // 技术关键词
    const techKeywords = ['api', 'auth', 'jwt', 'database', 'interface', 'class', 'function',
                          '组件', '接口', '函数', '认证', '数据库'];

    techKeywords.forEach(kw => {
      if (lowerText.includes(kw) && !keywords.includes(kw)) {
        keywords.push(kw);
      }
    });

    return keywords.slice(0, 5);  // 最多5个关键词
  }

  /**
   * 估算步骤数
   */
  private estimateSteps(requirement: string, complexity: ComplexityLevel, features: IntentFeatures): number {
    if (complexity === ComplexityLevel.SIMPLE) return 1;
    if (complexity === ComplexityLevel.MEDIUM) return features.hasMultipleSteps ? 5 : 3;
    return features.hasMultipleSteps ? 12 : 8;
  }
}
