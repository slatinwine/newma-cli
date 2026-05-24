/**
 * Skills Analyzer
 *
 * Analyzes chat history and user requirements to extract plugin specifications
 */

import type {
  ChatMessage,
  ChatAnalysisResult,
  PluginRequirement,
  ToolRequirement,
} from './types';
import { callAI } from '../ai';
import type { Config } from '../config';

/**
 * Analyzes chat history to extract plugin requirements
 */
export class SkillsAnalyzer {
  private config: Config;
  private projectRoot: string;

  constructor(config: Config, projectRoot: string) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze chat history for plugin requirements
   */
  async analyzeChatHistory(messages: ChatMessage[]): Promise<ChatAnalysisResult> {
    console.log('[Skills Analyzer] Analyzing chat history...');

    // Filter relevant messages (user and assistant)
    const relevantMessages = messages.filter(m =>
      m.role === 'user' || m.role === 'assistant'
    );

    if (relevantMessages.length === 0) {
      return {
        requirements: this.createEmptyRequirement(),
        confidence: 0,
        missing: ['No conversation to analyze'],
        suggestions: ['Provide plugin requirements manually'],
        excerpts: [],
      };
    }

    // Build analysis prompt
    const analysisPrompt = this.buildAnalysisPrompt(relevantMessages);

    // Call AI to analyze
    const response = await callAI(
      this.config,
      {}, // No project info needed for analysis
      analysisPrompt,
      'think',
      [], // No history needed for extraction
      undefined,
      undefined,
      undefined,
      this.projectRoot
    );

    // Parse AI response
    const result = this.parseAnalysisResponse(response.content || '');

    console.log(`[Skills Analyzer] Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    if (result.missing.length > 0) {
      console.log(`[Skills Analyzer] Missing: ${result.missing.join(', ')}`);
    }

    return result;
  }

  /**
   * Analyze manual requirement input
   */
  async analyzeRequirement(description: string): Promise<ChatAnalysisResult> {
    console.log('[Skills Analyzer] Analyzing manual requirement...');

    const prompt = `Analyze this plugin requirement and extract structured information:

${description}

Please provide:
1. Plugin name
2. Description
3. Tools needed
4. Parameters for each tool
5. Required permissions
6. Any metadata

Format as JSON.`;

    const response = await callAI(
      this.config,
      {},
      prompt,
      'think',
      [],
      undefined,
      undefined,
      undefined,
      this.projectRoot
    );

    return this.parseAnalysisResponse(response.content || '');
  }

  /**
   * Build analysis prompt for chat history
   */
  private buildAnalysisPrompt(messages: ChatMessage[]): string {
    const conversation = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    return `Analyze this conversation and extract plugin requirements:

${conversation}

Based on this conversation, identify:
1. What problem the user wants to solve
2. What tools would be needed
3. What parameters each tool should accept
4. What permissions are required
5. Suggested plugin name and description

Respond with a JSON object containing:
{
  "requirements": {
    "name": "plugin-name",
    "description": "Plugin description",
    "tools": [
      {
        "name": "tool-name",
        "description": "Tool description",
        "category": "utility|analysis|transformation",
        "permissions": ["read_only", "safe", etc],
        "parameters": {...}
      }
    ]
  },
  "confidence": 0.0-1.0,
  "missing": ["info1", "info2"],
  "suggestions": ["suggestion1"],
  "excerpts": ["relevant quotes from conversation"]
}`;
  }

  /**
   * Parse AI analysis response
   */
  private parseAnalysisResponse(content: string): ChatAnalysisResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        requirements: this.validateRequirement(parsed.requirements),
        confidence: parsed.confidence || 0.5,
        missing: parsed.missing || [],
        suggestions: parsed.suggestions || [],
        excerpts: parsed.excerpts || [],
      };
    } catch (error) {
      console.error('[Skills Analyzer] Failed to parse response:', error);

      // Return empty requirement on failure
      return {
        requirements: this.createEmptyRequirement(),
        confidence: 0,
        missing: ['Failed to analyze conversation'],
        suggestions: ['Provide requirements manually'],
        excerpts: [],
      };
    }
  }

  /**
   * Validate and normalize requirement
   */
  private validateRequirement(req: any): PluginRequirement {
    return {
      name: req.name || 'unnamed-plugin',
      description: req.description || 'No description',
      version: req.version || '1.0.0',
      tools: Array.isArray(req.tools) ? req.tools.map(this.validateTool) : [],
      metadata: req.metadata || {},
      context: req.context || {},
    };
  }

  /**
   * Validate and normalize tool requirement
   */
  private validateTool(tool: any): ToolRequirement {
    return {
      name: tool.name || 'unnamed-tool',
      description: tool.description || 'No description',
      category: tool.category || 'utility',
      permissions: Array.isArray(tool.permissions) ? tool.permissions : ['read_only'],
      parameters: tool.parameters,
      implementationHints: tool.implementationHints || [],
      examples: tool.examples || [],
    };
  }

  /**
   * Create empty requirement
   */
  private createEmptyRequirement(): PluginRequirement {
    return {
      name: 'empty-plugin',
      description: 'No requirements provided',
      version: '1.0.0',
      tools: [],
      metadata: {},
    };
  }

  /**
   * Extract tool definitions from requirements
   */
  extractTools(requirement: PluginRequirement): ToolRequirement[] {
    return requirement.tools || [];
  }

  /**
   * Suggest improvements to requirements
   */
  suggestImprovements(requirement: PluginRequirement): string[] {
    const suggestions: string[] = [];

    if (!requirement.name || requirement.name === 'empty-plugin') {
      suggestions.push('Add a descriptive plugin name');
    }

    if (!requirement.description || requirement.description.length < 20) {
      suggestions.push('Provide a more detailed description');
    }

    if (!requirement.tools || requirement.tools.length === 0) {
      suggestions.push('Define at least one tool for the plugin');
    }

    for (const tool of requirement.tools) {
      if (!tool.parameters) {
        suggestions.push(`Add parameter schema for tool "${tool.name}"`);
      }

      if (!tool.implementationHints || tool.implementationHints.length === 0) {
        suggestions.push(`Add implementation hints for tool "${tool.name}"`);
      }
    }

    return suggestions;
  }
}
