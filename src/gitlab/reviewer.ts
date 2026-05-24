// src/gitlab/reviewer.ts
/**
 * Merge Request Reviewer
 * Uses AI to analyze code changes and generate review comments
 */

import chalk from 'chalk';
import { Config } from '../config';
import { GitLabClient } from './client';
import {
  GitLabConfig,
  ReviewResult,
  ReviewIssue,
  ReviewSeverity,
  ReviewCategory,
  DiffFile,
  AIReviewRequest,
  AIReviewResponse,
} from './types';

/**
 * Merge Request Reviewer
 */
export class MergeRequestReviewer {
  private config: GitLabConfig;
  private aiConfig: Config;
  private client: GitLabClient;

  constructor(config: GitLabConfig, aiConfig: Config) {
    this.config = config;
    this.aiConfig = aiConfig;
    this.client = new GitLabClient(config);
  }

  /**
   * Review a merge request
   */
  async reviewMergeRequest(projectId: number, mrIid: number): Promise<ReviewResult> {
    console.log(chalk.cyan(`🔍 Reviewing MR !${mrIid}...`));

    try {
      // Get MR details
      const mr = await this.client.getMRDetail(projectId, mrIid);
      console.log(chalk.gray(`📝 MR: ${mr.title}`));
      console.log(chalk.gray(`🌿 Branch: ${mr.source_branch} → ${mr.target_branch}`));

      // Get MR changes
      const { changes, source_branch, target_branch } = await this.client.getMRChanges(projectId, mrIid);
      console.log(chalk.gray(`📊 Files changed: ${changes.length}`));

      // Filter files to review
      const filesToReview = this.filterFilesToReview(changes);
      console.log(chalk.gray(`🔎 Files to review: ${filesToReview.length}`));

      // Review each file
      const allIssues: ReviewIssue[] = [];
      for (const diff of filesToReview) {
        console.log(chalk.gray(`  Reviewing: ${diff.new_path}...`));

        const fileIssues = await this.reviewFile(diff, source_branch, target_branch);
        allIssues.push(...fileIssues);

        if (fileIssues.length > 0) {
          console.log(chalk.yellow(`    ⚠️  Found ${fileIssues.length} issue(s)`));
        } else {
          console.log(chalk.green(`    ✅ No issues found`));
        }
      }

      // Calculate summary
      const summary = this.calculateSummary(allIssues);

      console.log(chalk.green(`\n✅ Review complete: ${summary.total} issue(s) found`));
      console.log(chalk.gray(`   Errors: ${summary.errors}, Warnings: ${summary.warnings}, Info: ${summary.info}`));

      return { issues: allIssues, summary };
    } catch (error: any) {
      console.error(chalk.red(`❌ Review failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Review a single file
   */
  private async reviewFile(
    diff: DiffFile,
    sourceBranch: string,
    targetBranch: string
  ): Promise<ReviewIssue[]> {
    try {
      // Get file language
      const language = this.detectLanguage(diff.new_path);

      // Build project context
      const projectInfo = await this.buildProjectInfo(diff);

      // Build AI review request
      const request: AIReviewRequest = {
        projectInfo,
        diff: diff.diff,
        fileName: diff.new_path,
        language,
      };

      // Call AI for review
      const response = await this.callAIForReview(request);

      // Convert AI response to review issues
      return response.issues.map(issue => ({
        file: diff.new_path,
        line: issue.line,
        severity: issue.severity,
        category: issue.category,
        message: issue.message,
        suggestion: issue.suggestion,
        code: issue.code,
      }));
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to review ${diff.new_path}: ${error.message}`));
      return [];
    }
  }

  /**
   * Call AI for code review — direct API call for reliable JSON output
   */
  private async callAIForReview(request: AIReviewRequest): Promise<AIReviewResponse> {
    const prompt = this.buildReviewPrompt(request);

    try {
      // Build endpoint URL from config
      // Config baseUrl may already include path like /api/paas/v4 (智谱) or be just the domain
      const baseUrl = (this.aiConfig.baseUrl || 'https://api.openai.com').replace(/\/+$/, '');
      let endpoint: string;
      if (this.aiConfig.endpoint) {
        endpoint = this.aiConfig.endpoint;
      } else if (baseUrl.includes('/v1') || baseUrl.includes('/v4') || baseUrl.includes('/api/paas')) {
        //baseUrl already contains versioned path (e.g. 智谱: .../api/paas/v4)
        endpoint = `${baseUrl}/chat/completions`;
      } else {
        endpoint = `${baseUrl}/v1/chat/completions`;
      }

      const requestBody: any = {
        model: this.aiConfig.model || 'gpt-4',
        temperature: 0,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. Analyze the code diff and respond with valid JSON only. Follow the exact schema requested.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      // Only add response_format for APIs known to support it
      // 智谱 (bigmodel.cn) does NOT reliably support json_object
      const isZhipu = baseUrl.includes('bigmodel.cn');
      const isOpenAI = baseUrl.includes('api.openai.com');
      if (isOpenAI || this.aiConfig.supportsResponseFormat === true) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiConfig.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`API returned ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';

      // Parse AI response — try multiple strategies
      if (content) {
        const parsed = this.parseJSONResponse(content);
        if (parsed) {
          // Normalize: accept both { issues: [...] } and bare [...]
          if (Array.isArray(parsed)) {
            return { issues: parsed } as AIReviewResponse;
          }
          if (parsed.issues && Array.isArray(parsed.issues)) {
            return parsed as AIReviewResponse;
          }
          // Single issue object without wrapper
          if (parsed.line || parsed.severity || parsed.message) {
            return { issues: [parsed] } as unknown as AIReviewResponse;
          }
        }

        console.log(chalk.gray(`    ⚠️  AI response was not valid JSON, skipping`));
      }

      // Fallback: return empty response
      return { issues: [] };
    } catch (error: any) {
      console.error(chalk.red(`❌ AI review failed: ${error.message}`));
      return { issues: [] };
    }
  }

  /**
   * Build review prompt for AI
   */
  private buildReviewPrompt(request: AIReviewRequest): string {
    return `Review the following code changes and identify potential issues.

**File**: ${request.fileName}
**Language**: ${request.language}

**Diff**:
\`\`\`diff
${request.diff}
\`\`\`

**Instructions**:
1. Identify bugs, security issues, performance problems, architectural concerns, and suggestions
2. For each issue, specify the line number (from the diff), severity (error/warning/info), and category
3. Provide clear, actionable feedback
4. Include specific suggestions for fixes when possible

**Response Format** (JSON only):
{
  "issues": [
    {
      "line": 10,
      "severity": "error|warning|info",
      "category": "bug|security|performance|architecture|suggestion|style",
      "message": "Clear description of the issue",
      "suggestion": "Specific fix suggestion (optional)",
      "code": "Example code fix (optional)"
    }
  ]
}

**Categories**:
- bug: Logic errors, incorrect implementation
- security: Security vulnerabilities, sensitive data exposure
- performance: Performance issues, inefficient code
- architecture: Design concerns, structural issues
- suggestion: Improvements, best practices
- style: Code style, formatting (minor issues)

**Severity Levels**:
- error: Must fix before merge (blocks CI)
- warning: Should fix (non-blocking)
- info: Nice to have (informational)

Respond with JSON only. No explanations outside the JSON structure.`;
  }

  /**
   * Robust JSON parser for AI responses
   * Tries multiple strategies to extract valid JSON from AI output
   */
  private parseJSONResponse(content: string): any | null {
    // Strategy 1: Try ```json ... ``` code block (greedy to handle nested blocks)
    const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*)```/);
    if (codeBlockMatch) {
      const parsed = this.tryParseJSON(codeBlockMatch[1].trim());
      if (parsed) return parsed;
    }

    // Strategy 2: Try to find balanced braces — outermost { ... }
    const braceResult = this.extractBalancedJSON(content, '{', '}');
    if (braceResult) {
      const parsed = this.tryParseJSON(braceResult);
      if (parsed) return parsed;
    }

    // Strategy 3: Try to find balanced brackets — outermost [ ... ]
    const bracketResult = this.extractBalancedJSON(content, '[', ']');
    if (bracketResult) {
      const parsed = this.tryParseJSON(bracketResult);
      if (parsed) return parsed;
    }

    // Strategy 4: Last resort — try the whole content
    const parsed = this.tryParseJSON(content.trim());
    if (parsed) return parsed;

    return null;
  }

  /**
   * Try to parse JSON with common fixes
   */
  private tryParseJSON(text: string): any | null {
    // Quick try first
    try {
      return JSON.parse(text);
    } catch (_e) { /* reviewer: tryParseJSON */ }

    // Apply fixes one at a time, try after each
    let cleaned = text;

    // Remove trailing commas before } or ] (but not inside strings)
    cleaned = this.removeTrailingCommas(cleaned);

    try {
      return JSON.parse(cleaned);
    } catch (_e) { /* reviewer: tryParseJSON */ }

    return null;
  }

  /**
   * Remove trailing commas before } or ] outside of strings
   */
  private removeTrailingCommas(text: string): string {
    let result = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        result += ch;
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        result += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        result += ch;
        continue;
      }
      // Skip comma that is followed by whitespace and then } or ]
      if (!inString && ch === ',') {
        // Look ahead: skip whitespace, check for } or ]
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        if (j < text.length && (text[j] === '}' || text[j] === ']')) {
          // Skip the comma
          continue;
        }
      }
      result += ch;
    }
    return result;
  }

  /**
   * Extract the outermost balanced JSON structure
   */
  private extractBalancedJSON(text: string, open: string, close: string): string | null {
    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === open) {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === close) {
        depth--;
        if (depth === 0 && start >= 0) {
          return text.substring(start, i + 1);
        }
      }
    }
    return null;
  }

  /**
   * Build project info context
   */
  private async buildProjectInfo(diff: DiffFile): Promise<Record<string, string>> {
    // Basic project context
    const context: Record<string, string> = {
      [diff.new_path]: `File: ${diff.new_path}`,
    };

    // Try to get related files if projectId is available
    if (this.config.projectId) {
      try {
        // Get repository tree to understand project structure
        const tree = await this.client.getRepositoryTree(
          this.config.projectId,
          'HEAD',
          this.getDirectoryPath(diff.new_path)
        );

        // Add related files to context
        for (const item of tree.slice(0, 10)) { // Limit to 10 files
          if (item.type === 'blob' && item.path !== diff.new_path) {
            try {
              const content = await this.client.getFileContent(
                this.config.projectId,
                item.path,
                'HEAD'
              );
              // Only include first 100 lines of each file
              const lines = content.split('\n').slice(0, 100).join('\n');
              context[item.path] = lines;
            } catch {
              // Skip files that can't be read
              context[item.path] = `File: ${item.path}`;
            }
          }
        }
      } catch (error) {
        // If we can't get project context, continue with basic info
      }
    }

    return context;
  }

  /**
   * Filter files to review
   */
  private filterFilesToReview(changes: DiffFile[]): DiffFile[] {
    const maxFiles = this.config.maxFiles || 20;
    const maxLines = this.config.maxLinesPerFile || 500;

    let filtered = changes.filter(diff => {
      // Skip deleted files
      if (diff.deleted_file) {
        return false;
      }

      // Skip binary files
      const extension = this.getExtension(diff.new_path);
      const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.exe'];
      if (binaryExtensions.includes(extension)) {
        return false;
      }

      // Skip files that are too large
      const lineCount = diff.diff.split('\n').length;
      if (lineCount > maxLines) {
        console.log(chalk.yellow(`⚠️  Skipping ${diff.new_path} (${lineCount} lines exceeds limit of ${maxLines})`));
        return false;
      }

      return true;
    });

    // Limit number of files
    if (filtered.length > maxFiles) {
      console.log(chalk.yellow(`⚠️  Too many files (${filtered.length}), limiting to ${maxFiles}`));
      filtered = filtered.slice(0, maxFiles);
    }

    return filtered;
  }

  /**
   * Calculate review summary
   */
  private calculateSummary(issues: ReviewIssue[]) {
    const summary = {
      total: issues.length,
      errors: 0,
      warnings: 0,
      info: 0,
      byCategory: {} as Record<ReviewCategory, number>,
    };

    // Initialize category counts
    const categories: ReviewCategory[] = ['bug', 'security', 'performance', 'architecture', 'suggestion', 'style'];
    categories.forEach(cat => summary.byCategory[cat] = 0);

    // Count issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          summary.errors++;
          break;
        case 'warning':
          summary.warnings++;
          break;
        case 'info':
          summary.info++;
          break;
      }
      summary.byCategory[issue.category]++;
    }

    return summary;
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const extension = this.getExtension(filePath);
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.sh': 'Shell',
      '.bash': 'Bash',
      '.zsh': 'Zsh',
      '.fish': 'Fish',
      '.ps1': 'PowerShell',
      '.sql': 'SQL',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.json': 'JSON',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.md': 'Markdown',
      '.txt': 'Plain Text',
    };

    return languageMap[extension] || 'Unknown';
  }

  /**
   * Get file extension
   */
  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot !== -1 ? filePath.slice(lastDot) : '';
  }

  /**
   * Get directory path from file path
   */
  private getDirectoryPath(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash !== -1 ? filePath.slice(0, lastSlash) : '';
  }
}

/**
 * Publish review results to GitLab MR
 */
export async function publishReviewResults(
  client: GitLabClient,
  projectId: number,
  mrIid: number,
  result: ReviewResult
): Promise<void> {
  if (result.issues.length === 0) {
    // Post success message
    const message = `✅ **Code Review Passed**

No issues found in this merge request. The changes look good!`;

    await client.createNote(projectId, mrIid, message);
    console.log(chalk.green('✅ Published review results to GitLab'));
    return;
  }

  // Group issues by file
  const issuesByFile = new Map<string, ReviewIssue[]>();
  for (const issue of result.issues) {
    const issues = issuesByFile.get(issue.file) || [];
    issues.push(issue);
    issuesByFile.set(issue.file, issues);
  }

  // Build review message
  let message = `🔍 **Code Review Results**

**Summary**: ${result.summary.total} issue(s) found
- ❌ Errors: ${result.summary.errors}
- ⚠️  Warnings: ${result.summary.warnings}
- ℹ️  Info: ${result.summary.info}

`;

  // Add issues by file
  for (const [file, issues] of issuesByFile) {
    message += `\n### 📄 ${file}\n\n`;

    for (const issue of issues) {
      const emoji = getSeverityEmoji(issue.severity);
      const category = getCategoryEmoji(issue.category);

      message += `${emoji} **Line ${issue.line}** - ${issue.message}\n`;
      message += `   ${category} \`${issue.category}\`\n`;

      if (issue.suggestion) {
        message += `   💡 **Suggestion**: ${issue.suggestion}\n`;
      }

      if (issue.code) {
        message += `   \`\`\`\n${issue.code}\n   \`\`\`\n`;
      }

      message += '\n';
    }
  }

  // Add footer
  message += `\n---\n*Reviewed by [Newma](https://github.com/your-repo/newma) AI Code Reviewer*`;

  // Post review to GitLab
  await client.createNote(projectId, mrIid, message);
  console.log(chalk.green('✅ Published review results to GitLab'));
}

/**
 * Get emoji for severity level
 */
function getSeverityEmoji(severity: ReviewSeverity): string {
  switch (severity) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
  }
}

/**
 * Get emoji for category
 */
function getCategoryEmoji(category: ReviewCategory): string {
  switch (category) {
    case 'bug':
      return '🐛';
    case 'security':
      return '🔒';
    case 'performance':
      return '⚡';
    case 'architecture':
      return '🏗️';
    case 'suggestion':
      return '💡';
    case 'style':
      return '🎨';
  }
}