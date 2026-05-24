/**
 * FFT Planner - Fast and Frugal Tree for Planning
 *
 * A fast planning algorithm that:
 * 1. Analyzes task complexity using heuristics
 * 2. For simple tasks: generates a single plan immediately
 * 3. For complex tasks: generates 2-3 alternative options for user selection
 *
 * Goal: Provide fast planning (1-5s) vs. ToT (10-30s) while maintaining quality.
 */

import chalk from 'chalk';
import { Config } from '../config';
import fetch from 'node-fetch';
import inquirer from 'inquirer';
import {
  FFTPlanInput,
  FFTPlanResult,
  FFTPlanOption,
  PlanAction,
  ComplexityAnalysis,
  ClarifyingAnswers,
} from './types';

/**
 * FFT Planner - Main class for fast planning
 */
export class FFTPlanner {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Main entry point: generate plan using FFT approach
   *
   * @param input - Planning input (requirement, project info, user profile)
   * @returns FFT planning result
   */
  async generatePlan(input: FFTPlanInput): Promise<FFTPlanResult> {
    const startTime = Date.now();

    console.log(chalk.gray('⚡ [FFT Planner] Analyzing task complexity...\n'));

    // Step 1: Analyze complexity
    const complexityAnalysis = await this.analyzeComplexity(input);

    console.log(chalk.gray(`⚡ [FFT] Complexity: ${complexityAnalysis.level.toUpperCase()}`));
    console.log(chalk.gray(`⚡ [FFT] Reasoning: ${complexityAnalysis.reasoning}\n`));

    // Step 2: Generate plan based on complexity
    if (complexityAnalysis.level === 'simple') {
      // Simple task: single plan
      const plan = await this.generateSinglePlan(input, complexityAnalysis);
      const analysisTime = Date.now() - startTime;

      return {
        complexity: 'simple',
        reasoning: complexityAnalysis.reasoning,
        plan,
        analysisTime,
      };
    } else {
      // Complex task: multiple options
      const options = await this.generateMultipleOptions(input, complexityAnalysis);
      const analysisTime = Date.now() - startTime;

      return {
        complexity: 'complex',
        reasoning: complexityAnalysis.reasoning,
        options,
        analysisTime,
      };
    }
  }

  /**
   * Analyze task complexity using hybrid approach
   *
   * Strategy:
   * 1. Quick rules for obvious cases (fast, 0ms)
   * 2. AI judgment for ambiguous cases (slower, ~500ms)
   *
   * This balances accuracy with performance.
   */
  private async analyzeComplexity(input: FFTPlanInput): Promise<ComplexityAnalysis> {
    // Step 1: Try quick rules first
    const quickResult = this.quickComplexityCheck(input);

    if (quickResult.confidence > 0.8) {
      // Quick rule confident → return immediately
      return quickResult;
    }

    // Step 2: Quick rule uncertain → ask AI
    console.log(chalk.gray('⚡ [FFT] Using AI for complexity analysis...\n'));
    return await this.aiComplexityCheck(input);
  }

  /**
   * Quick complexity check using simple rules
   * Returns high confidence (0.9) for obvious cases
   * Returns low confidence (0.4) for ambiguous cases
   */
  private quickComplexityCheck(input: FFTPlanInput): ComplexityAnalysis {
    const { requirement } = input;

    // Rule 1: Very short description → likely simple
    if (requirement.length < 15) {
      return {
        level: 'simple',
        reasoning: '任务描述简短',
        indicators: {
          keywordMatches: [],
          techStackCount: 0,
          estimatedSteps: 1,
        },
        confidence: 0.9,
      };
    }

    // Rule 2: Obvious complex keywords
    const complexKeywords = [
      '重构',
      '架构',
      '迁移',
      '微服务',
      '系统设计',
      'refactor',
      'architecture',
      'migration',
      'microservice',
      'distributed system',
    ];

    const matchedKeywords = complexKeywords.filter(kw =>
      requirement.toLowerCase().includes(kw.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      return {
        level: 'complex',
        reasoning: `包含复杂关键词: ${matchedKeywords[0]}`,
        indicators: {
          keywordMatches: matchedKeywords,
          techStackCount: 0,
          estimatedSteps: 0,
        },
        confidence: 0.9,
      };
    }

    // Rule 3: Multiple tech stacks mentioned (3+)
    const techStacks = this.detectTechStacks(requirement);
    if (techStacks.length >= 3) {
      return {
        level: 'complex',
        reasoning: `涉及 ${techStacks.length} 个技术栈`,
        indicators: {
          keywordMatches: [],
          techStackCount: techStacks.length,
          estimatedSteps: 0,
        },
        confidence: 0.9,
      };
    }

    // Rule 4: Ambiguous → low confidence, will trigger AI
    return {
      level: 'simple',  // Default assumption
      reasoning: '需要进一步分析',
      indicators: {
        keywordMatches: [],
        techStackCount: techStacks.length,
        estimatedSteps: 0,
      },
      confidence: 0.4,  // Low confidence → trigger AI
    };
  }

  /**
   * AI-based complexity check for ambiguous cases
   * Uses AI to understand semantic complexity
   */
  private async aiComplexityCheck(input: FFTPlanInput): Promise<ComplexityAnalysis> {
    const { requirement } = input;

    const userPrompt = `判断任务复杂度：

${requirement}

判断标准：
- SIMPLE（简单）：创建单个文件、小功能、明确步骤、单一技术栈
- COMPLEX（复杂）：多个文件、多技术栈、需要设计决策、架构考虑

只返回JSON，格式：{"level":"simple" or "complex", "reasoning":"简短理由"}`;

    const systemPrompt = `You are a task complexity analyzer.

CRITICAL RULES:
1. Respond ONLY with valid JSON
2. No markdown, no explanations, no additional text
3. Start with '{', end with '}'
4. JSON format: {"level":"simple" or "complex", "reasoning":"short reason"}

Examples:
{"level":"simple","reasoning":"单一文件"}
{"level":"complex","reasoning":"多技术栈"}

Start your response with '{' immediately.`;

    let rawResponse = '';
    try {
      rawResponse = await this.callAIDirect(userPrompt, systemPrompt);

      // Log the raw response for debugging
      console.log(chalk.gray(`⚡ [FFT] AI response: ${rawResponse.substring(0, 100)}...`));

      // Extract JSON using enhanced extraction logic
      const cleanedResponse = this.extractJSON(rawResponse);

      // Parse JSON
      const result = JSON.parse(cleanedResponse);

      // Validate result
      if (!result.level || (result.level !== 'simple' && result.level !== 'complex')) {
        throw new Error(`Invalid level value: ${result.level}`);
      }

      // Extract tech stacks for indicators
      const techStacks = this.detectTechStacks(requirement);

      return {
        level: result.level,
        reasoning: result.reasoning || 'AI判断',
        indicators: {
          keywordMatches: [],
          techStackCount: techStacks.length,
          estimatedSteps: 0,
        },
        confidence: 0.85,  // AI judgment confidence
      };
    } catch (error: any) {
      console.error(chalk.red(`❌ [FFT] AI complexity check failed: ${error.message}`));
      console.error(chalk.gray(`Response was: ${rawResponse?.substring(0, 200)}...`));

      // Fallback: assume simple
      return {
        level: 'simple',
        reasoning: 'AI判断失败，按简单处理',
        indicators: {
          keywordMatches: [],
          techStackCount: 0,
          estimatedSteps: 1,
        },
        confidence: 0.5,
      };
    }
  }

  /**
   * Detect technology stacks mentioned in requirement
   */
  private detectTechStacks(requirement: string): string[] {
    const techKeywords = [
      'react', 'vue', 'angular', 'svelte', 'next',
      'node', 'express', 'nest', 'koa',
      'python', 'django', 'flask', 'fastapi',
      'java', 'spring', 'kotlin',
      'go', 'rust', 'typescript', 'javascript',
      'mongodb', 'postgresql', 'mysql', 'redis',
      'docker', 'kubernetes', 'aws', 'azure',
      'graphql', 'grpc', 'rest', 'api',
    ];

    const lowerReq = requirement.toLowerCase();
    return techKeywords.filter(tech =>
      lowerReq.includes(tech.toLowerCase())
    );
  }

  /**
   * Extract JSON from AI response
   * Handles multiple formats:
   * 1. ```json ... ```
   * 2. ``` ... ```
   * 3. Text with JSON embedded (extract first { to last })
   * 4. Plain JSON
   */
  private extractJSON(content: string): string {
    let cleaned = content.trim();

    // Step 1: Remove markdown code blocks
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }

    // Step 2: Find first '{' and last '}'
    // This handles cases where AI adds explanatory text before/after JSON
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return cleaned;
  }

  /**
   * Generate single plan for simple tasks
   */
  private async generateSinglePlan(
    input: FFTPlanInput,
    complexityAnalysis: ComplexityAnalysis
  ): Promise<FFTPlanOption> {
    console.log(chalk.gray('⚡ [FFT] Generating single plan...\n'));

    const { requirement, projectInfo, userProfile } = input;

    const prompt = this.buildSinglePlanPrompt(requirement, projectInfo, userProfile);

    try {
      // Direct API call to bypass Intent Recognition and Landmark Counting
      const response = await this.callAIDirect(prompt);

      const plan = this.parsePlanFromAIResponse(response, 'balanced');
      plan.confidence = complexityAnalysis.confidence;

      console.log(chalk.gray(`⚡ [FFT] Plan generated: ${plan.actions.length} actions\n`));

      return plan;
    } catch (error) {
      console.error(chalk.red(`❌ [FFT] Error generating plan: ${error}`));
      console.log(chalk.yellow('⚠️  Using rule-based fallback planner...\n'));

      // Use rule-based fallback planner
      const { fallbackPlanner } = await import('../planning/fallback-planner');
      const fallbackPlan = fallbackPlanner.generatePlan(requirement);

      return {
        id: `fft-plan-${Date.now()}`,
        name: '基础方案 (Rule-Based)',
        description: '基于规则生成的方案',
        strategy: 'balanced',
        actions: fallbackPlan.actions,
        estimatedTime: 5000,
        riskLevel: 'medium',
        pros: ['快速生成', '基于常见模式'],
        cons: ['可能不够精确', '建议使用 AI 规划'],
        confidence: 0.5,
      };
    }
  }

  /**
   * Generate multiple options for complex tasks
   */
  private async generateMultipleOptions(
    input: FFTPlanInput,
    complexityAnalysis: ComplexityAnalysis
  ): Promise<FFTPlanOption[]> {
    console.log(chalk.gray('⚡ [FFT] Generating multiple options...\n'));

    const { requirement, projectInfo, userProfile } = input;

    // Ask clarifying questions first for better customization
    const answers = await this.askClarifyingQuestions(requirement);

    const prompt = this.buildMultipleOptionsPrompt(requirement, projectInfo, userProfile, answers);

    try {
      // Direct API call to bypass Intent Recognition and Landmark Counting
      const response = await this.callAIDirect(prompt);

      const options = this.parseMultipleOptionsFromAIResponse(
        response,
        complexityAnalysis
      );

      console.log(chalk.gray(`⚡ [FFT] Generated ${options.length} options\n`));

      return options;
    } catch (error) {
      console.error(chalk.red(`❌ [FFT] Error generating options: ${error}`));
      console.log(chalk.yellow('⚠️  Using rule-based fallback planner...\n'));

      // Use rule-based fallback planner
      const { fallbackPlanner } = await import('../planning/fallback-planner');
      const fallbackPlan = fallbackPlanner.generatePlan(requirement);

      const fallbackOption: FFTPlanOption = {
        id: `fft-plan-${Date.now()}`,
        name: '标准方案 (Rule-Based)',
        description: '基于规则生成的标准实施方案',
        strategy: 'balanced',
        actions: fallbackPlan.actions,
        estimatedTime: 10000,
        riskLevel: 'medium',
        pros: ['快速生成', '基于常见模式', '稳妥可靠'],
        cons: ['可能缺少针对性优化', '建议使用 AI 规划'],
        confidence: 0.5,
      };

      return [fallbackOption];
    }
  }

  /**
   * Build prompt for single plan generation
   */
  private buildSinglePlanPrompt(
    requirement: string,
    projectInfo: Record<string, string>,
    userProfile?: string
  ): string {
    let prompt = `REQUIREMENT: ${requirement}

${Object.keys(projectInfo).length > 0 ? `PROJECT CONTEXT:\n${JSON.stringify(projectInfo, null, 2)}\n` : ''}

Generate a specific, actionable plan with:
- name: Plan name
- description: Brief description (1-2 sentences)
- actions: Array of specific actions with format:
  {"type": "create", "path": "file/path", "content": "file content"}
  {"type": "modify", "path": "file/path", "oldContent": "old", "newContent": "new"}
  {"type": "run", "command": "shell command"}
  {"type": "verify", "command": "test command"}
- estimatedTime: Time in milliseconds
- riskLevel: low/medium/high
- pros: Array of advantages
- cons: Array of disadvantages

IMPORTANT: Each action MUST have a "type" field (create/modify/run/verify).

Respond with a single JSON object.`;

    if (userProfile) {
      prompt += `\n\nUSER PROFILE:\n${userProfile}\n\nAdapt your plan to match the user's preferences.`;
    }

    return prompt;
  }

  /**
   * Direct AI call bypassing Intent Recognition and Landmark Counting
   * This ensures FFT planner works independently without triggering other algorithms
   *
   * Note: Does NOT use userProfile to avoid context pollution from previous conversations
   */
  private async callAIDirect(prompt: string, customSystemPrompt?: string): Promise<string> {
    // Build endpoint URL carefully to avoid double /v1 paths
    let endpoint: string;

    if (this.config.endpoint) {
      // User provided custom endpoint - use as-is
      endpoint = this.config.endpoint;
    } else {
      // Construct from baseUrl
      const baseUrl = this.config.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes

      // Check if baseUrl already includes /v1
      if (baseUrl.endsWith('/v1')) {
        endpoint = `${baseUrl}/chat/completions`;
      } else {
        endpoint = `${baseUrl}/v1/chat/completions`;
      }
    }

    // Build system prompt
    let systemPrompt: string;

    if (customSystemPrompt) {
      // Use custom system prompt for specialized calls (like complexity check)
      systemPrompt = customSystemPrompt;
    } else {
      // Default system prompt for plan generation
      systemPrompt = `You are an expert software architect.
Generate clear, actionable implementation plans.

CRITICAL OUTPUT REQUIREMENTS:
1. Respond with ONLY valid JSON - no markdown, no explanations, no text outside JSON
2. Do NOT wrap JSON in \`\`\`json code blocks
3. Start your response immediately with '{' and end with '}'
4. If you must explain anything, put it in the "description" field
5. ⚠️ DO NOT number your points (1., 2., 3.) - START WITH '{' IMMEDIATELY
6. Violating these rules will cause the system to fail

Format your entire response as a single JSON object (for single plans) or JSON object with "options" array (for multiple options).

Example format:
{
  "name": "Plan Name",
  "description": "Description",
  "actions": [
    {"type": "create", "path": "file.txt", "content": "..."},
    {"type": "run", "command": "..."}
  ],
  "estimatedTime": 10000,
  "riskLevel": "medium",
  "pros": ["..."],
  "cons": ["..."]
}

OR for multiple options:
{
  "options": [
    {"name": "...", "strategy": "conservative", "actions": [...]},
    {"name": "...", "strategy": "balanced", "actions": [...]},
    {"name": "...", "strategy": "aggressive", "actions": [...]}
  ]
}

Remember: Start with '{', end with '}', nothing else.`;
    }

    try {
      const requestBody: any = {
        model: this.config.model,
        temperature: 0.7,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      };

      // Enable JSON mode only for official OpenAI API
      // Some OpenAI-compatible providers have deprecated json_object type
      // and only accept 'json_schema' or 'text'
      const isOpenAI = !this.config.baseUrl ||
                       this.config.baseUrl.includes('api.openai.com');

      if (isOpenAI) {
        requestBody.response_format = { type: "json_object" };
      }

      let fetchResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // If API doesn't support response_format, retry without it
      if (!fetchResponse.ok) {
        const err = await fetchResponse.text();
        if (err.includes('response_format') || err.includes('json_object')) {
          console.log(chalk.yellow('⚠️  [FFT] API does not support response_format, retrying without it'));
          delete requestBody.response_format;

          fetchResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
        }

        // If still not ok, throw error
        if (!fetchResponse.ok) {
          const err2 = await fetchResponse.text();
          throw new Error(`OpenAI API error: ${fetchResponse.status} - ${err2}`);
        }
      }

      const data = await fetchResponse.json();
      const message = data.choices?.[0]?.message;

      if (!message?.content) {
        throw new Error('No content in API response');
      }

      return message.content;
    } catch (error: any) {
      console.error(chalk.red(`❌ [FFT] Direct API call failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Ask clarifying questions to better understand user needs
   */
  private async askClarifyingQuestions(requirement: string): Promise<ClarifyingAnswers | undefined> {
    console.log(chalk.cyan('\n📋 为了更好地为您定制方案，请回答几个问题\n'));
    console.log(chalk.gray('(也可以选择跳过，使用默认设置生成通用方案)\n'));

    const { shouldAsk } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldAsk',
        message: '是否回答几个问题以定制方案？',
        default: true,
      },
    ]);

    if (!shouldAsk) {
      console.log(chalk.gray('ℹ️  使用默认设置生成通用方案...\n'));
      return undefined;
    }

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'experience',
        message: '1. 您的技术经验水平？',
        choices: [
          { name: '🌱 初学者 - 刚接触这些技术', value: 'beginner' },
          { name: '🌿 有一定经验 - 使用过相关技术', value: 'intermediate' },
          { name: '🌳 专家 - 深入理解且有项目经验', value: 'expert' },
        ],
        default: 'intermediate',
      },
      {
        type: 'list',
        name: 'projectScale',
        message: '2. 项目规模？',
        choices: [
          { name: '👤 个人项目 - 自己使用或学习', value: 'personal' },
          { name: '👥 小团队 - 2-5人协作', value: 'small-team' },
          { name: '🏢 企业级 - 多团队、大规模用户', value: 'enterprise' },
        ],
        default: 'personal',
      },
      {
        type: 'list',
        name: 'timeConstraint',
        message: '3. 时间要求？',
        choices: [
          { name: '🔥 紧急 - 需要尽快完成', value: 'urgent' },
          { name: '⏰ 正常 - 标准开发周期', value: 'normal' },
          { name: '📅 灵活 - 不着急，可以慢慢来', value: 'flexible' },
        ],
        default: 'normal',
      },
      {
        type: 'list',
        name: 'priority',
        message: '4. 最看重什么？',
        choices: [
          { name: '⚡ 开发速度 - 快速上线', value: 'speed' },
          { name: '💎 代码质量 - 可维护性和最佳实践', value: 'quality' },
          { name: '⚖️ 平衡 - 速度和质量兼顾', value: 'balance' },
        ],
        default: 'balance',
      },
    ]);

    console.log(chalk.gray('\n✅ 已记录您的偏好，正在生成定制方案...\n'));

    return answers as ClarifyingAnswers;
  }

  /**
   * Build prompt for multiple options generation
   */
  private buildMultipleOptionsPrompt(
    requirement: string,
    projectInfo: Record<string, string>,
    userProfile?: string,
    answers?: ClarifyingAnswers
  ): string {
    let prompt = `REQUIREMENT: ${requirement}

${Object.keys(projectInfo).length > 0 ? `PROJECT CONTEXT:\n${JSON.stringify(projectInfo, null, 2)}\n` : ''}`;

    // Add user preferences if available
    if (answers) {
      prompt += `
USER PREFERENCES:
- Experience: ${answers.experience} (beginner/intermediate/expert)
- Project Scale: ${answers.projectScale} (personal/small-team/enterprise)
- Time Constraint: ${answers.timeConstraint} (urgent/normal/flexible)
- Priority: ${answers.priority} (speed/quality/balance)

IMPORTANT: Generate options that match these preferences!
- If user is beginner → prioritize simple, well-documented solutions
- If user wants speed → prioritize quick implementation approaches
- If user wants quality → prioritize best practices and maintainability
- If urgent → suggest fastest path to working solution
`;
    }

    prompt += `
Generate 3 alternative implementation approaches:

1. 保守方案: Minimal changes, quick to implement (MVP approach)
2. 激进方案: Full refactor, best practices (complete overhaul)
3. 平衡方案: Gradual approach, balanced trade-offs (incremental)

For each option, provide:
- name: Option name (conservative/aggressive/balanced)
- description: Brief description
- strategy: conservative/aggressive/balanced
- actions: Array of specific actions with format:
  {"type": "create", "path": "file/path", "content": "file content"}
  {"type": "modify", "path": "file/path", "oldContent": "old", "newContent": "new"}
  {"type": "run", "command": "shell command"}
  {"type": "verify", "command": "test command"}
- estimatedTime: Time in milliseconds
- riskLevel: low/medium/high
- pros: Array of advantages
- cons: Array of disadvantages

IMPORTANT: Each action MUST have a "type" field (create/modify/run/verify).

Respond with a JSON object containing an "options" array with 3 items.`;

    if (userProfile) {
      prompt += `\n\nUSER PROFILE:\n${userProfile}\n\nAdapt your options to match the user's preferences.`;
    }

    return prompt;
  }

  /**
   * Parse single plan from AI response
   */
  private parsePlanFromAIResponse(content: string, strategy: 'conservative' | 'aggressive' | 'balanced'): FFTPlanOption {
    try {
      // Extract JSON using enhanced extraction logic
      const jsonStr = this.extractJSON(content);

      // Parse JSON directly
      const data = JSON.parse(jsonStr);

      // Validate and sanitize actions
      const validActions = (data.actions || []).filter((action: any) => {
        if (!action || typeof action !== 'object') {
          console.error(chalk.yellow(`⚠️  [FFT] Invalid action format: ${JSON.stringify(action)}`));
          return false;
        }

        if (!action.type || !['create', 'modify', 'run', 'verify'].includes(action.type)) {
          console.error(chalk.yellow(`⚠️  [FFT] Action missing or invalid type: ${JSON.stringify(action)}`));
          return false;
        }

        return true;
      });

      if (validActions.length < (data.actions || []).length) {
        const invalidCount = (data.actions || []).length - validActions.length;
        console.log(chalk.yellow(`⚠️  [FFT] Filtered ${invalidCount} invalid actions\n`));
      }

      return {
        id: `fft-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name || '方案',
        description: data.description || '',
        strategy,
        actions: validActions,
        estimatedTime: data.estimatedTime || 10000,
        riskLevel: data.riskLevel || 'medium',
        pros: data.pros || [],
        cons: data.cons || [],
        confidence: 0.7,
      };
    } catch (error: any) {
      console.error(chalk.red(`❌ [FFT] Error parsing plan: ${error.message}`));
      console.error(chalk.gray(`Received: ${content.substring(0, 200)}...`));

      // Return fallback plan
      return {
        id: `fft-plan-${Date.now()}`,
        name: '基础方案',
        description: '根据需求分析生成的方案',
        strategy,
        actions: [],
        estimatedTime: 10000,
        riskLevel: 'medium',
        pros: ['可行性高'],
        cons: ['需进一步细化'],
        confidence: 0.5,
      };
    }
  }

  /**
   * Parse multiple options from AI response
   */
  private parseMultipleOptionsFromAIResponse(
    content: string,
    complexityAnalysis: ComplexityAnalysis
  ): FFTPlanOption[] {
    try {
      // Extract JSON using enhanced extraction logic
      const jsonStr = this.extractJSON(content);

      const data = JSON.parse(jsonStr);
      const optionsData = data.options || [];

      return optionsData.map((opt: any, idx: number) => {
        // Validate and sanitize actions for each option
        const validActions = (opt.actions || []).filter((action: any) => {
          if (!action || typeof action !== 'object') {
            console.error(chalk.yellow(`⚠️  [FFT] Option ${idx + 1}: Invalid action format`));
            return false;
          }

          if (!action.type || !['create', 'modify', 'run', 'verify'].includes(action.type)) {
            console.error(chalk.yellow(`⚠️  [FFT] Option ${idx + 1}: Action missing or invalid type`));
            return false;
          }

          return true;
        });

        if (validActions.length < (opt.actions || []).length) {
          const invalidCount = (opt.actions || []).length - validActions.length;
          console.log(chalk.yellow(`⚠️  [FFT] Option ${idx + 1}: Filtered ${invalidCount} invalid actions`));
        }

        return {
          id: `fft-plan-${Date.now()}-${idx}`,
          name: opt.name || `方案 ${idx + 1}`,
          description: opt.description || '',
          strategy: opt.strategy || 'balanced',
          actions: validActions,
          estimatedTime: opt.estimatedTime || 15000,
          riskLevel: opt.riskLevel || 'medium',
          pros: opt.pros || [],
          cons: opt.cons || [],
          confidence: complexityAnalysis.confidence,
        };
      });
    } catch (error: any) {
      console.error(chalk.red(`❌ [FFT] Error parsing options: ${error.message}`));
      console.error(chalk.gray(`Received: ${content.substring(0, 200)}...`));

      // Return fallback options
      return [
        {
          id: `fft-plan-${Date.now()}-0`,
          name: '保守方案 (MVP)',
          description: '快速实现核心功能',
          strategy: 'conservative',
          actions: [],
          estimatedTime: 10000,
          riskLevel: 'low',
          pros: ['快速', '低风险'],
          cons: ['功能有限'],
          confidence: 0.5,
        },
        {
          id: `fft-plan-${Date.now()}-1`,
          name: '平衡方案 (渐进式)',
          description: '平衡实施，预留扩展',
          strategy: 'balanced',
          actions: [],
          estimatedTime: 15000,
          riskLevel: 'medium',
          pros: ['可控', '可扩展'],
          cons: ['需迭代'],
          confidence: 0.5,
        },
        {
          id: `fft-plan-${Date.now()}-2`,
          name: '激进方案 (完整重构)',
          description: '完全重构，最佳实践',
          strategy: 'aggressive',
          actions: [],
          estimatedTime: 30000,
          riskLevel: 'high',
          pros: ['长期质量'],
          cons: ['耗时长', '高风险'],
          confidence: 0.5,
        },
      ];
    }
  }
}

/**
 * Convenience function to create FFT planner and generate plan
 */
export async function generateFFTPlan(
  config: Config,
  requirement: string,
  projectInfo: Record<string, string>,
  userProfile?: string
): Promise<FFTPlanResult> {
  const planner = new FFTPlanner(config);
  return await planner.generatePlan({ requirement, projectInfo, userProfile });
}
