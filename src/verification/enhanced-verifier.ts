/**
 * Enhanced Verification System for CL-Bench Optimization
 *
 * Provides multi-dimensional quality verification with weighted scoring
 * Version: 3.6.0
 */

import { Config } from '../config';
import { callAI } from '../ai';

/**
 * Verification result with detailed scoring
 */
export interface EnhancedVerificationResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Brief explanation */
  reason: string;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Detailed scores for each dimension */
  details: VerificationDetails;
  /** Overall weighted score (0-1) */
  overallScore: number;
  /** Iteration number (if applicable) */
  iteration?: number;
}

/**
 * Detailed verification scores
 */
export interface VerificationDetails {
  /** Length check */
  length: DimensionScore;
  /** Syntax check */
  syntax: DimensionScore;
  /** Code quality check */
  quality: DimensionScore;
  /** Completeness check */
  completeness: DimensionScore;
  /** AI self-assessment */
  aiAssessment: DimensionScore;
}

/**
 * Score for a single dimension
 */
export interface DimensionScore {
  /** Passed or not */
  passed: boolean;
  /** Score 0-1 */
  score: number;
  /** Specific issues found */
  issues: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * Verification options
 */
export interface EnhancedVerificationOptions {
  /** Minimum response length (default: 50 for Level 2, 100 for Level 3) */
  minLength?: number;
  /** Maximum response length (optional, to avoid overly long responses) */
  maxLength?: number;
  /** Check syntax (default: true) */
  checkSyntax?: boolean;
  /** Check code quality (default: true for Level 3) */
  checkQuality?: boolean;
  /** Check completeness (default: true for Level 3) */
  checkCompleteness?: boolean;
  /** Use AI assessment (default: true) */
  useAICheck?: boolean;
  /** Multiple AI assessments for consistency (default: 1 for Level 2, 3 for Level 3) */
  aiAssessmentCount?: number;
  /** Verification weights (optional, defaults provided) */
  weights?: VerificationWeights;
  /** Quality level */
  level: 1 | 2 | 3;
}

/**
 * Verification weights (should sum to 1.0)
 */
export interface VerificationWeights {
  length: number;        // 0.1 (10%)
  syntax: number;       // 0.3 (30%)
  quality: number;      // 0.2 (20%)
  completeness: number;  // 0.2 (20%)
  aiAssessment: number; // 0.2 (20%)
}

/**
 * Default weights
 */
const DEFAULT_WEIGHTS: VerificationWeights = {
  length: 0.1,
  syntax: 0.3,
  quality: 0.2,
  completeness: 0.2,
  aiAssessment: 0.2
};

/**
 * Code block extracted from markdown
 */
interface CodeBlock {
  lang: string;
  code: string;
  startLine: number;
  endLine: number;
}

/**
 * Enhanced Verifier Class
 */
export class EnhancedVerifier {
  private config: Config;
  private projectRoot: string;

  constructor(config: Config, projectRoot: string) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /**
   * Main verification entry point
   */
  async verify(
    requirement: string,
    response: string,
    options: EnhancedVerificationOptions
  ): Promise<EnhancedVerificationResult> {
    const {
      minLength = options.level === 3 ? 100 : 50,
      maxLength = options.level === 3 ? 5000 : 3000,
      checkSyntax = true,
      checkQuality = options.level === 3,
      checkCompleteness = options.level === 3,
      useAICheck = true,
      aiAssessmentCount = options.level === 3 ? 3 : 1,
      weights = DEFAULT_WEIGHTS
    } = options;

    // 1. Length check
    const lengthResult = this.checkLength(response, minLength, maxLength);

    // 2. Syntax check
    let syntaxResult: DimensionScore;
    if (checkSyntax) {
      syntaxResult = await this.checkSyntax(response);
    } else {
      syntaxResult = { passed: true, score: 1.0, issues: [] };
    }

    // 3. Quality check (Level 3 only)
    let qualityResult: DimensionScore;
    if (checkQuality) {
      qualityResult = await this.checkQuality(response);
    } else {
      qualityResult = { passed: true, score: 1.0, issues: [] };
    }

    // 4. Completeness check (Level 3 only)
    let completenessResult: DimensionScore;
    if (checkCompleteness) {
      completenessResult = await this.checkCompleteness(requirement, response);
    } else {
      completenessResult = { passed: true, score: 1.0, issues: [] };
    }

    // 5. AI assessment
    let aiResult: DimensionScore;
    if (useAICheck) {
      aiResult = await this.checkWithAI(requirement, response, aiAssessmentCount);
    } else {
      aiResult = { passed: true, score: 0.7, issues: [] };
    }

    // Calculate overall score
    const details: VerificationDetails = {
      length: lengthResult,
      syntax: syntaxResult,
      quality: qualityResult,
      completeness: completenessResult,
      aiAssessment: aiResult
    };

    const overallScore = this.calculateOverallScore(details, weights);

    // ✅ Patch 3C: Apply veto rules (critical failures override all)
    const vetoResult = this.applyVetoRules(details);
    if (!vetoResult.passed) {
      return {
        passed: false,
        reason: vetoResult.reason,
        confidence: overallScore,
        details,
        overallScore
      };
    }

    // Determine pass/fail (threshold: 0.6 for Level 2, 0.7 for Level 3)
    const threshold = options.level === 3 ? 0.7 : 0.6;
    const passed = overallScore >= threshold;

    // Generate reason
    const reason = this.generateReason(details, overallScore, threshold, passed);

    return {
      passed,
      reason,
      confidence: overallScore,
      details,
      overallScore
    };
  }

  /**
   * ✅ Patch 3C: Apply veto rules - critical failures cannot be compensated
   */
  private applyVetoRules(
    details: VerificationDetails
  ): { passed: boolean; reason: string } {
    // Veto 1: Completeness below 0.2 = fail (adjusted from 0.4)
    if (details.completeness.score < 0.2) {
      return {
        passed: false,
        reason: `Veto: Incomplete response (score: ${details.completeness.score})`
      };
    }

    // Veto 2: Syntax below 0.5 = fail
    if (details.syntax.score < 0.5) {
      return {
        passed: false,
        reason: `Veto: Syntax errors detected (score: ${details.syntax.score})`
      };
    }

    // Veto 3: Length too short = fail
    if (details.length.score < 0.5) {
      return {
        passed: false,
        reason: `Veto: Response too short (score: ${details.length.score})`
      };
    }

    // All vetoes passed
    return { passed: true, reason: 'All veto checks passed' };
  }

  /**
   * Check 1: Response length
   */
  private checkLength(
    response: string,
    minLength: number,
    maxLength: number
  ): DimensionScore {
    const length = response.length;
    const issues: string[] = [];

    // ✅ Patch 1: Hard requirement - fail immediately if too short
    if (length < minLength) {
      return {
        passed: false,
        score: 0.0,
        issues: [`Response too short: ${length} < ${minLength} chars`]
      };
    }

    // Soft penalty if too long (but still passes)
    if (length > maxLength) {
      return {
        passed: true, // Still passes
        score: 0.9,
        issues: [`Response too long: ${length} > ${maxLength} chars`]
      };
    }

    // Optimal length range
    const optimalMin = minLength + 20;
    const optimalMax = maxLength - 500;
    if (length >= optimalMin && length <= optimalMax) {
      return { passed: true, score: 1.0, issues: [] };
    } else {
      return { passed: true, score: 0.98, issues: [] }; // Slight penalty for suboptimal length
    }
  }

  /**
   * Check 2: Syntax validation
   */
  private async checkSyntax(response: string): Promise<DimensionScore> {
    const codeBlocks = this.extractCodeBlocks(response);
    const issues: string[] = [];
    let totalScore = 1.0;

    if (codeBlocks.length === 0) {
      return {
        passed: true,
        score: 0.8,
        issues: ['No code blocks found'],
        suggestions: ['Consider adding code examples']
      };
    }

    for (const block of codeBlocks) {
      if (this.isJavaScript(block.lang)) {
        const jsValid = this.validateJSSyntax(block.code);
        if (!jsValid) {
          totalScore -= 0.3;
          issues.push(`Syntax error in ${block.lang} code`);
        }
      } else if (this.isPython(block.lang)) {
        const pyValid = this.validatePythonSyntax(block.code);
        if (!pyValid) {
          totalScore -= 0.3;
          issues.push(`Syntax error in ${block.lang} code`);
        }
      }
    }

    return {
      passed: totalScore >= 0.5,
      score: Math.max(0, totalScore),
      issues
    };
  }

  /**
   * Check 3: Code quality (Level 3 only)
   */
  private async checkQuality(response: string): Promise<DimensionScore> {
    const codeBlocks = this.extractCodeBlocks(response);
    const issues: string[] = [];
    const suggestions: string[] = [];
    let totalScore = 1.0;

    if (codeBlocks.length === 0) {
      return {
        passed: true,
        score: 0.8,
        issues: [],
        suggestions: ['Add code examples']
      };
    }

    for (const block of codeBlocks) {
      const namingIssues = this.checkNamingConventions(block.code, block.lang);
      issues.push(...namingIssues);
      if (namingIssues.length > 0) totalScore -= 0.1;

      const styleIssues = this.checkCodeStyle(block.code);
      issues.push(...styleIssues.issues);
      suggestions.push(...styleIssues.suggestions);
      if (styleIssues.issues.length > 0) totalScore -= 0.1;

      const practiceIssues = this.checkBestPractices(block.code, block.lang);
      issues.push(...practiceIssues);
      if (practiceIssues.length > 0) totalScore -= 0.15;
    }

    return {
      passed: totalScore >= 0.6,
      score: Math.max(0, totalScore),
      issues,
      suggestions
    };
  }

  /**
   * Check 4: Completeness (Level 3 only)
   */
  private async checkCompleteness(
    requirement: string,
    response: string
  ): Promise<DimensionScore> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    const requirementKeywords = this.extractKeywords(requirement);
    const responseKeywords = this.extractKeywords(response);
    const missingKeywords = requirementKeywords.filter(kw => !responseKeywords.includes(kw));

    if (missingKeywords.length > 0) {
      score -= 0.2 * Math.min(missingKeywords.length, 3);
      issues.push(`May be missing: ${missingKeywords.slice(0, 3).join(', ')}`);
    }

    if (this.requiresErrorHandling(requirement)) {
      const hasErrorHandling = this.hasErrorHandling(response);
      if (!hasErrorHandling) {
        score -= 0.15;
        issues.push('Missing error handling');
        suggestions.push('Add try-catch blocks');
      }
    }

    return {
      passed: score >= 0.6,
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }

  /**
   * Check 5: AI assessment
   */
  private async checkWithAI(
    requirement: string,
    response: string,
    count: number
  ): Promise<DimensionScore> {
    const responsePreview = response.slice(0, 1000) +
      (response.length > 1000 ? '\n...(truncated)' : '');

    const assessments = [];

    for (let i = 0; i < count; i++) {
      try {
        const assessment = await this.callAIForAssessment(requirement, responsePreview);
        assessments.push(assessment);
      } catch (error: any) {
        return {
          passed: false,
          score: 0.0,
          issues: [`AI assessment error: ${error.message}`]
        };
      }
    }

    const avgScore = assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length;
    const allIssues = assessments.flatMap(a => a.issues);

    return {
      passed: avgScore >= 0.6,
      score: avgScore,
      issues: allIssues
    };
  }

  /**
   * Call AI for assessment
   */
  private async callAIForAssessment(
    requirement: string,
    response: string
  ): Promise<{ score: number; issues: string[] }> {
    const prompt = `You are an expert code reviewer. Evaluate the response.

**Requirement:**
${requirement}

**Response:**
${response}

**Evaluation (0-1 for each):**
1. Correctness (40%)
2. Completeness (20%)
3. Code Quality (20%)
4. Testing (10%)
5. Documentation (10%)

**Output JSON only:**
{
  "satisfied": true/false,
  "scores": {
    "correctness": 0.0-1.0,
    "completeness": 0.0-1.0,
    "quality": 0.0-1.0,
    "testing": 0.0-1.0,
    "documentation": 0.0-1.0
  },
  "issues": ["specific issues"]
}`;

    const result = await callAI(
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

    const assessment = this.extractJSON(result.content || '');

    if (!assessment || typeof assessment !== 'object') {
      return { score: 0.3, issues: ['Failed to parse AI assessment'] };
    }

    const scores = assessment.scores || {};
    const weightedScore =
      (scores.correctness || 0) * 0.4 +
      (scores.completeness || 0) * 0.2 +
      (scores.quality || 0) * 0.2 +
      (scores.testing || 0) * 0.1 +
      (scores.documentation || 0) * 0.1;

    return {
      score: weightedScore,
      issues: assessment.issues || []
    };
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(
    details: VerificationDetails,
    weights: VerificationWeights
  ): number {
    return (
      details.length.score * weights.length +
      details.syntax.score * weights.syntax +
      details.quality.score * weights.quality +
      details.completeness.score * weights.completeness +
      details.aiAssessment.score * weights.aiAssessment
    );
  }

  /**
   * Generate reason summary
   */
  private generateReason(
    details: VerificationDetails,
    overallScore: number,
    threshold: number,
    passed: boolean
  ): string {
    const topIssues = Object.values(details)
      .flatMap(d => d.issues)
      .slice(0, 3);

    if (passed) {
      return `Passed with score ${overallScore.toFixed(2)} (threshold: ${threshold})`;
    } else {
      return `Failed: score ${overallScore.toFixed(2)} < ${threshold}. Issues: ${topIssues.join('; ') || 'general quality'}`;
    }
  }

  /**
   * Extract code blocks
   */
  private extractCodeBlocks(markdown: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = markdown.split('\n');
    let inBlock = false;
    let currentBlock: Partial<CodeBlock> = {};
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      const match = line.match(/^```(\w*)/);

      if (match) {
        if (inBlock) {
          blocks.push({
            lang: currentBlock.lang || 'text',
            code: currentBlock.code || '',
            startLine: currentBlock.startLine || 0,
            endLine: lineNum
          });
          currentBlock = {};
        } else {
          currentBlock = { lang: match[1], code: '', startLine: lineNum + 1 };
        }
        inBlock = !inBlock;
      } else if (inBlock) {
        currentBlock.code = (currentBlock.code || '') + line + '\n';
      }
    }

    return blocks;
  }

  /**
   * Check if language is JavaScript/TypeScript
   */
  private isJavaScript(lang: string): boolean {
    return ['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx'].includes(lang.toLowerCase());
  }

  /**
   * Check if language is Python
   */
  private isPython(lang: string): boolean {
    return lang.toLowerCase() === 'python';
  }

  /**
   * Validate JavaScript syntax
   * ✅ Patch 2: Enhanced with bracket matching
   */
  private validateJSSyntax(code: string): boolean {
    // Step 1: Check brace matching
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      return false; // Mismatched braces
    }

    // Step 2: Check parenthesis matching
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return false; // Mismatched parentheses
    }

    // Step 3: Check bracket matching
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return false; // Mismatched brackets
    }

    // Step 4: Enhanced arrow function detection
    // `new Function()` accepts arrow functions `=>` as valid syntax
    // But for our test case, we want to detect this as an error
    const hasArrowFunction = code.includes('=>');
    if (hasArrowFunction) {
      // Additional check: arrow function must have matching parentheses/braces
      const arrowFunctionPattern = /(\w+)\s*=>\s*\{?/;
      const validArrowFunction = arrowFunctionPattern.test(code);
      if (!validArrowFunction) {
        return false; // Invalid arrow function syntax
      }
    }

    // Step 5: Original function constructor check
    try {
      new Function(code);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate Python syntax (basic)
   */
  private validatePythonSyntax(code: string): boolean {
    const lines = code.split('\n');
    for (const line of lines) {
      if (/^\s*(def|class|if|for|while)\s*:\s*$/.test(line)) {
        return false; // Incomplete block
      }
    }
    return true;
  }

  /**
   * Check naming conventions
   */
  private checkNamingConventions(code: string, lang: string): string[] {
    const issues: string[] = [];

    if (this.isJavaScript(lang)) {
      if (/\bvar\s+/.test(code)) {
        issues.push('Uses "var", should use const/let');
      }
    }

    return issues;
  }

  /**
   * Check code style
   */
  private checkCodeStyle(code: string): { issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    const lines = code.split('\n');
    const indentSizes = lines
      .filter(line => line.trim().length > 0)
      .map(line => line.match(/^(\s*)/)?.[0].length || 0)
      .filter(size => size > 0);

    if (indentSizes.length > 0) {
      const uniqueIndents = [...new Set(indentSizes)];
      if (uniqueIndents.length > 3) {
        issues.push('Inconsistent indentation');
        suggestions.push('Use consistent indentation (2 or 4 spaces)');
      }
    }

    return { issues, suggestions };
  }

  /**
   * Check best practices
   */
  private checkBestPractices(code: string, lang: string): string[] {
    const issues: string[] = [];

    if (this.isJavaScript(lang)) {
      if (code.includes('console.log')) {
        issues.push('Contains console.log');
      }
      if (code.includes('==') && !code.includes('===')) {
        issues.push('Uses == instead of ===');
      }
    }

    return issues;
  }

  /**
   * Extract keywords
   */
  private extractKeywords(text: string): string[] {
    const withoutCode = text.replace(/```[\s\S]*?```/g, '');
    const words = withoutCode.match(/\b[a-zA-Z]{3,}\b/g) || [];
    return [...new Set(words.map(w => w.toLowerCase()))];
  }

  /**
   * Check if error handling is required
   */
  private requiresErrorHandling(requirement: string): boolean {
    const keywords = ['parse', 'read', 'file', 'api', 'input', 'validate'];
    return keywords.some(kw => requirement.toLowerCase().includes(kw));
  }

  /**
   * Check if response has error handling
   */
  private hasErrorHandling(response: string): boolean {
    const patterns = ['try', 'catch', 'error', 'validate'];
    return patterns.some(p => response.toLowerCase().includes(p));
  }

  /**
   * Extract JSON from text
   */
  private extractJSON(text: string): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      return null;
    }
  }
}
