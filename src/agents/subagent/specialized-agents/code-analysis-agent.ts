/**
 * Code Analysis Agent
 * 代码分析专家，负责分析代码结构、模式和问题
 */

import { BaseSpecializedAgent } from './base-specialized-agent';
import { SubTask, AgentConfig } from '../subtask';
import { callAIWithFunctionCalling } from '../../../ai';

export class CodeAnalysisAgent extends BaseSpecializedAgent {
  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      enabled: true,
      temperature: 0.3,
      maxIterations: 10,
      tools: ['read_file', 'list_directory', 'find_files', 'search_content'],
      systemPrompt: `You are a code analysis expert with deep knowledge of software architecture and design patterns.

**Your Expertise:**
- Analyze code structure and organization
- Identify design patterns and anti-patterns
- Detect potential bugs and security issues
- Evaluate code quality and maintainability
- Suggest improvements and refactoring opportunities

**Analysis Framework:**
1. **Structure**: Module organization, dependencies, layering
2. **Patterns**: Design patterns usage, SOLID principles
3. **Quality**: Code complexity, duplication, naming conventions
4. **Security**: Common vulnerabilities, data handling
5. **Performance**: Bottlenecks, optimization opportunities

**Output Format:**
Provide a structured analysis with:
- Executive Summary (3-5 bullet points)
- Detailed Findings (categorized by area)
- Code Examples (with line references)
- Recommendations (prioritized by impact)
- Risk Assessment (High/Medium/Low)

Focus on actionable insights that can guide implementation decisions.`
    };

    super({ ...defaultConfig, ...config });
  }

  protected getDefaultPrompt(): string {
    return this.agentConfig.systemPrompt || '';
  }

  protected async callAI(systemPrompt: string, userMessage: string): Promise<any> {
    return callAIWithFunctionCalling(
      this.getConfig(),
      {}, // projectInfo
      userMessage,
      [], // history
      { getAllTools: () => [] } as any, // ToolRegistry (临时空实现)
      undefined // signal
    );
  }

  protected async processResponse(response: any, task: SubTask): Promise<any> {
    const result: any = {
      type: response.type,
      analysis: response.content || '',
      toolCalls: response.toolCalls || [],
      reasoning: response.reasoning || []
    };

    // 提取关键发现
    if (response.content) {
      result.keyFindings = this.extractKeyFindings(response.content);
      result.recommendations = this.extractRecommendations(response.content);
      result.risks = this.assessRisks(response.content);
    }

    return result;
  }

  /**
   * 提取关键发现
   */
  private extractKeyFindings(content: string): string[] {
    const findings: string[] = [];
    const lines = content.split('\n');

    let inFindingsSection = false;
    for (const line of lines) {
      if (line.includes('Key Findings') || line.includes('关键发现')) {
        inFindingsSection = true;
        continue;
      }

      if (inFindingsSection && line.trim().startsWith('-')) {
        findings.push(line.trim().replace(/^-\s*/, ''));
      } else if (inFindingsSection && line.trim() === '') {
        break;
      }
    }

    return findings;
  }

  /**
   * 提取建议
   */
  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const lines = content.split('\n');

    let inRecsSection = false;
    for (const line of lines) {
      if (line.includes('Recommendations') || line.includes('建议')) {
        inRecsSection = true;
        continue;
      }

      if (inRecsSection && line.match(/^\d+\./)) {
        recommendations.push(line.trim());
      } else if (inRecsSection && line.trim() === '') {
        break;
      }
    }

    return recommendations;
  }

  /**
   * 评估风险
   */
  private assessRisks(content: string): { risk: string; description: string }[] {
    const risks: { risk: string; description: string }[] = [];

    // 查找风险关键词
    const riskPatterns = [
      { pattern: /high risk|高风险/gi, level: 'High' },
      { pattern: /medium risk|中等风险/gi, level: 'Medium' },
      { pattern: /low risk|低风险/gi, level: 'Low' }
    ];

    for (const { pattern, level } of riskPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        risks.push({ risk: level, description: `Found ${matches.length} ${level} risk(s)` });
      }
    }

    return risks;
  }

  /**
   * 获取配置（从 SessionManager）
   */
  private getConfig() {
    return {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    };
  }
}
