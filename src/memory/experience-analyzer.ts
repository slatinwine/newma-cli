/**
 * Experience Analyzer
 *
 * 经验分析器，从记忆系统中提取可复用的技能
 */

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { callAI } from '../ai';
import { NewmaConfig } from '../config';
import {
  SkillSuggestion,
  MemoryDataSummary,
  Evidence,
  Example,
  AnalyzerOptions,
} from './types-precipitation';

/**
 * 分析结果
 */
export interface AnalysisResult {
  /** 生成的建议数量 */
  suggestionsGenerated: number;
  /** 通过过滤的建议数量 */
  suggestionsPassed: number;
  /** 执行时间（毫秒） */
  duration: number;
  /** 使用的 Token 数量 */
  tokensUsed: number;
}

/**
 * 部分分析结果（单个维度）
 */
interface PartialSuggestion {
  name: string;
  description: string;
  type: 'knowledge' | 'action' | 'analysis';
  complexity: number;
  tags: string[];
  confidence: number;
  evidence: Evidence[];
  whenToUse: string[];
  coreKnowledge: string;
  examples: Example[];
}

/**
 * 经验分析器
 */
export class ExperienceAnalyzer {
  private projectRoot: string;
  private memoDir: string;
  private options: AnalyzerOptions;

  constructor(projectRoot: string, options: AnalyzerOptions) {
    this.projectRoot = projectRoot;
    this.memoDir = join(projectRoot, '.memo');
    this.options = options;
  }

  /**
   * 执行完整分析
   */
  async analyze(config: NewmaConfig): Promise<AnalysisResult> {
    const startTime = Date.now();

    console.log('[Analyzer] Starting experience analysis...');
    console.log(`[Analyzer] Confidence threshold: ${this.options.confidenceThreshold}`);
    console.log(`[Analyzer] Max skills: ${this.options.maxSkills}`);
    console.log(`[Analyzer] Analysis period: ${this.options.analysisDays} days`);

    try {
      // 1. 收集记忆数据
      const memoryData = await this.collectMemoryData();
      console.log(`[Analyzer] ✓ Collected memory data from ${this.getDataSourcesCount(memoryData)} sources`);

      // 2. 调用 AI 进行分析
      const suggestions = await this.analyzeWithAI(memoryData, config);
      console.log(`[Analyzer] ✓ AI generated ${suggestions.length} suggestions`);

      // 3. 过滤低置信度建议
      const filteredSuggestions = this.filterByConfidence(suggestions);
      console.log(`[Analyzer] ✓ ${filteredSuggestions.length} suggestions passed confidence filter`);

      // 4. 限制数量
      const finalSuggestions = filteredSuggestions.slice(0, this.options.maxSkills);
      console.log(`[Analyzer] ✓ Selected top ${finalSuggestions.length} suggestions`);

      const duration = Date.now() - startTime;
      console.log(`[Analyzer] ✓ Analysis completed in ${duration}ms`);

      // 5. 保存建议到临时目录（供 Generator 读取）
      await this.saveSuggestions(finalSuggestions);

      return {
        suggestionsGenerated: suggestions.length,
        suggestionsPassed: filteredSuggestions.length,
        duration,
        tokensUsed: this.estimateTokensUsed(memoryData),
      };
    } catch (error: any) {
      console.error(`[Analyzer] ✗ Analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 收集记忆数据
   */
  private async collectMemoryData(): Promise<MemoryDataSummary> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.options.analysisDays);

    console.log(`[Analyzer] Collecting data from ${this.formatDate(startDate)} to ${this.formatDate(endDate)}`);

    const data: MemoryDataSummary = {
      errors: [],
      history: [],
      preferences: {},
      context: {},
      reasoning: [],
      decisions: [],
      sessions: [],
      dateRange: { start: startDate, end: endDate },
    };

    try {
      // 1. 错误记录
      data.errors = await this.loadErrorRecords(startDate, endDate);

      // 2. 执行历史
      data.history = await this.loadExecutionHistory(startDate, endDate);

      // 3. 用户偏好
      data.preferences = await this.loadUserPreferences();

      // 4. 项目上下文
      data.context = await this.loadProjectContext();

      // 5. 推理过程
      data.reasoning = await this.loadReasoningHistory(startDate, endDate);

      // 6. 决策记录
      data.decisions = await this.loadDecisions(startDate, endDate);

      // 7. 会话历史
      data.sessions = await this.loadSessionHistory(startDate, endDate);

      // 8. 🎮 分支树结局（决策路线统计）
      data.branches = await this.loadBranchOutcomes(startDate, endDate);
    } catch (error: any) {
      console.warn(`[Analyzer] ⚠ Some memory data could not be loaded: ${error.message}`);
    }

    return data;
  }

  /**
   * 使用 AI 分析记忆数据
   */
  private async analyzeWithAI(memoryData: MemoryDataSummary, config: NewmaConfig): Promise<SkillSuggestion[]> {
    console.log('[Analyzer] Calling AI for pattern recognition...');

    // 构建 AI Prompt
    const prompt = this.buildAnalysisPrompt(memoryData);

    try {
      // 调用 AI（使用 think 模式）
      const response = await callAI(
        config,
        { projectRoot: this.projectRoot, fileTree: '' }, // 简化的 projectInfo
        prompt,
        'think',
        [], // 空 history
        undefined,
        undefined,
        undefined,
        this.projectRoot
      );

      // 解析 AI 响应
      const suggestions = this.parseAIResponse(response.content || '');

      return suggestions;
    } catch (error: any) {
      console.error(`[Analyzer] AI analysis failed: ${error.message}`);
      throw new Error(`Failed to analyze with AI: ${error.message}`);
    }
  }

  /**
   * 构建分析 Prompt
   */
  private buildAnalysisPrompt(memoryData: MemoryDataSummary): string {
    const weights = this.options.weights || {
      errors: 0.4,
      history: 0.3,
      preferences: 0.2,
      others: 0.1,
    };

    return `你是一个经验总结专家，负责从开发者的记忆数据中提取可复用的技能。

## 任务
分析以下记忆数据，识别可复用的技能模式。

## 数据来源

### 1. 错误记录 (权重: ${weights.errors || 0.4})
\`\`\`json
${JSON.stringify(memoryData.errors.slice(0, 10), null, 2)}
\`\`\`

### 2. 执行历史 (权重: ${weights.history || 0.3})
\`\`\`json
${JSON.stringify(memoryData.history.slice(0, 10), null, 2)}
\`\`\`

### 3. 用户偏好 (权重: ${weights.preferences || 0.2})
\`\`\`json
${JSON.stringify(memoryData.preferences, null, 2)}
\`\`\`

### 4. 项目上下文 (权重: ${(weights.others || 0.1) / 3})
\`\`\`json
${JSON.stringify(memoryData.context, null, 2)}
\`\`\`

### 5. 推理过程 (权重: ${(weights.others || 0.1) / 3})
\`\`\`json
${JSON.stringify(memoryData.reasoning.slice(0, 5), null, 2)}
\`\`\`

### 6. 决策记录 (权重: ${(weights.others || 0.1) / 3})
\`\`\`json
${JSON.stringify(memoryData.decisions.slice(0, 5), null, 2)}
\`\`\`

### 7. 分支结局 (决策路线统计，攻略生成的原料)
\`\`\`json
${JSON.stringify((memoryData.branches || []).slice(0, 15), null, 2)}
\`\`\`

## 分析要求
1. 识别重复出现的模式（出现 3 次以上）
2. 提取最佳实践（成功案例）
3. 总结常见陷阱和解决方案
4. 从"分支结局"中提取决策策略：哪类技术选型/方案路线在本项目中成功率更高，哪些路线反复失败或被放弃
5. 估计每个技能的置信度（0.0-1.0）
6. 只保留置信度 > ${this.options.confidenceThreshold} 的技能

## 输出格式
返回 JSON 数组，每个元素包含:
\`\`\`json
[
  {
    "name": "技能名称",
    "description": "简短描述（50字内）",
    "type": "knowledge|action|analysis",
    "complexity": 1-5,
    "tags": ["标签1", "标签2"],
    "confidence": 0.0-1.0,
    "evidence": [
      {
        "source": "errors|history|preferences|...",
        "description": "证据描述",
        "examples": ["示例1", "示例2"],
        "count": 3,
        "lastSeen": "2026-01-31T12:00:00.000Z"
      }
    ],
    "whenToUse": ["使用场景1", "场景2"],
    "coreKnowledge": "核心知识点（Markdown格式，包含章节）",
    "examples": [
      {
        "scenario": "场景描述",
        "solution": "解决方案",
        "code": "相关代码（可选）"
      }
    ]
  }
]
\`\`\`

## 限制
- 最多生成 ${this.options.maxSkills} 个技能
- 每个技能至少 2 条支持证据
- 置信度必须基于数据频率和质量
- 优先提取具有通用价值的技能

请开始分析，并返回 JSON 格式的结果。`;
  }

  /**
   * 解析 AI 响应
   */
  private parseAIResponse(response: string): SkillSuggestion[] {
    try {
      // 尝试提取 JSON（处理可能的 Markdown 代码块）
      let jsonStr = response.trim();

      // 移除可能的代码块标记
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        lines.shift(); // 移除第一行
        if (lines[lines.length - 1] === '```') {
          lines.pop(); // 移除最后一行
        }
        jsonStr = lines.join('\n');
      }

      // 移除可能的 "json" 标记
      jsonStr = jsonStr.replace(/^json\s*/, '');

      // 解析 JSON
      const suggestions = JSON.parse(jsonStr) as SkillSuggestion[];

      // 验证和补充数据
      return suggestions.map((suggestion, index) => ({
        ...suggestion,
        id: `skill-${Date.now()}-${index}`,
        generatedAt: new Date(),
      }));
    } catch (error: any) {
      console.error(`[Analyzer] Failed to parse AI response: ${error.message}`);
      console.error(`[Analyzer] Response was: ${response.substring(0, 500)}...`);
      throw new Error('Invalid AI response format');
    }
  }

  /**
   * 按置信度过滤
   */
  private filterByConfidence(suggestions: SkillSuggestion[]): SkillSuggestion[] {
    return suggestions.filter((s) => s.confidence >= this.options.confidenceThreshold);
  }

  /**
   * 保存建议到临时文件
   */
  private async saveSuggestions(suggestions: SkillSuggestion[]): Promise<void> {
    const tempDir = join(this.projectRoot, '.memo', 'precipitation');
    const tempFile = join(tempDir, `suggestions-${Date.now()}.json`);

    // 确保目录存在
    const { mkdir } = require('fs/promises');
    await mkdir(tempDir, { recursive: true });

    // 保存
    await writeFile(tempFile, JSON.stringify(suggestions, null, 2), 'utf-8');

    console.log(`[Analyzer] ✓ Suggestions saved to ${tempFile}`);
  }

  // ========== 数据加载方法 ==========

  private async loadErrorRecords(startDate: Date, endDate: Date): Promise<any[]> {
    // 从 .memo/errors/ 读取
    // 简化实现：直接读取 JSON 文件
    try {
      const errorFile = join(this.memoDir, 'errors.json');
      const content = await readFile(errorFile, 'utf-8');
      const errors = JSON.parse(content);

      // 过滤时间范围
      return errors.filter((e: any) => {
        const date = new Date(e.timestamp || e.date);
        return date >= startDate && date <= endDate;
      });
    } catch (error) {
      console.warn('[Analyzer] Could not load error records');
      return [];
    }
  }

  private async loadExecutionHistory(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const historyFile = join(this.memoDir, 'sessions.json');
      const content = await readFile(historyFile, 'utf-8');
      const data = JSON.parse(content);

      // 提取执行记录
      const executions = data.sessions || [];

      // 过滤时间范围
      return executions.filter((e: any) => {
        const date = new Date(e.startTime || e.timestamp);
        return date >= startDate && date <= endDate;
      });
    } catch (error) {
      console.warn('[Analyzer] Could not load execution history');
      return [];
    }
  }

  private async loadUserPreferences(): Promise<any> {
    try {
      const prefsFile = join(this.memoDir, 'preferences.json');
      const content = await readFile(prefsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('[Analyzer] Could not load user preferences');
      return {};
    }
  }

  private async loadProjectContext(): Promise<any> {
    try {
      const contextFile = join(this.memoDir, 'context', 'context.json');
      const content = await readFile(contextFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('[Analyzer] Could not load project context');
      return {};
    }
  }

  private async loadReasoningHistory(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const reasoningFile = join(this.memoDir, 'reasoning.json');
      const content = await readFile(reasoningFile, 'utf-8');
      const data = JSON.parse(content);

      const reasonings = data.reasonings || [];

      return reasonings.filter((r: any) => {
        const date = new Date(r.timestamp || r.date);
        return date >= startDate && date <= endDate;
      });
    } catch (error) {
      console.warn('[Analyzer] Could not load reasoning history');
      return [];
    }
  }

  private async loadDecisions(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const decisionsFile = join(this.memoDir, 'decisions.json');
      const content = await readFile(decisionsFile, 'utf-8');
      const data = JSON.parse(content);

      const decisions = data.decisions || [];

      return decisions.filter((d: any) => {
        const date = new Date(d.timestamp || d.date);
        return date >= startDate && date <= endDate;
      });
    } catch (error) {
      console.warn('[Analyzer] Could not load decisions');
      return [];
    }
  }

  private async loadSessionHistory(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const sessionsFile = join(this.memoDir, 'sessions.json');
      const content = await readFile(sessionsFile, 'utf-8');
      const data = JSON.parse(content);

      const sessions = data.sessions || [];

      return sessions.filter((s: any) => {
        const date = new Date(s.startTime || s.timestamp);
        return date >= startDate && date <= endDate;
      });
    } catch (error) {
      console.warn('[Analyzer] Could not load session history');
      return [];
    }
  }

  /**
   * 🎮 加载分支树结局（决策路线的成功/失败/放弃统计，攻略生成的原料）
   */
  private async loadBranchOutcomes(startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const branchesDir = join(this.memoDir, 'branches');
      const files = await readdir(branchesDir).catch(() => [] as string[]);

      const outcomes: any[] = [];

      for (const file of files) {
        if (!file.endsWith('.json') || file === 'active.json') continue;

        try {
          const content = await readFile(join(branchesDir, file), 'utf-8');
          const tree = JSON.parse(content);

      for (const node of tree.nodes || []) {
        const date = new Date(node.createdAt);
        if (date < startDate || date > endDate) continue;
        if (node.type === 'save') continue; // 存档点不是决策结局

        const chosen = (node.options || []).find(
          (o: any) => o.id === node.selectedOptionId
        );

        // 节点级结局（注意：重访会把 outcome 重置为 active，
        // 此时历史战绩在选项级 MCTS 统计里——由下方补充采集）
        if (node.outcome !== 'active') {
          outcomes.push({
            session: tree.sessionId,
            decisionType: node.type,
            question: node.prompt,
            chosenOption: chosen?.label ?? '(none)',
            outcome: node.outcome, // succeeded | failed | abandoned
            note: node.outcomeNote ?? '',
            createdAt: node.createdAt,
          });
        }

        // 选项级 MCTS 统计（同一决策点各路线的 N/W/Q，含被重访覆盖的历史）
        const withStats = (node.options || []).filter(
          (o: any) => o.stats && o.stats.visits > 0
        );
        if (withStats.length > 0) {
          outcomes.push({
            session: tree.sessionId,
            decisionType: node.type,
            question: node.prompt,
            chosenOption: withStats
              .map((o: any) => `${o.label}: ${o.stats.visits}x Q=${(o.stats.value / o.stats.visits).toFixed(2)}`)
              .join(' | '),
            outcome: node.outcome === 'active' ? 'in-progress (per-option stats)' : `${node.outcome} (per-option stats)`,
            note: `presented ${node.presentedCount ?? 1}x`,
            createdAt: node.createdAt,
          });
        }
      }
        } catch {
          // 单个分支树文件损坏跳过
        }
      }

      return outcomes;
    } catch (error) {
      console.warn('[Analyzer] Could not load branch outcomes');
      return [];
    }
  }

  // ========== 辅助方法 ==========

  private getDataSourcesCount(data: MemoryDataSummary): number {
    let count = 0;
    if (data.errors.length > 0) count++;
    if (data.history.length > 0) count++;
    if (Object.keys(data.preferences).length > 0) count++;
    if (Object.keys(data.context).length > 0) count++;
    if (data.reasoning.length > 0) count++;
    if (data.decisions.length > 0) count++;
    if (data.sessions.length > 0) count++;
    if (data.branches && data.branches.length > 0) count++;
    return count;
  }

  private estimateTokensUsed(data: MemoryDataSummary): number {
    // 粗略估算：JSON 字符数 / 4
    const jsonStr = JSON.stringify(data);
    return Math.ceil(jsonStr.length / 4);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

// 辅助函数
async function writeFile(path: string, content: string, encoding: BufferEncoding): Promise<void> {
  const { writeFile: wf } = require('fs/promises');
  return wf(path, content, encoding);
}
