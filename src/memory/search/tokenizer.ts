/**
 * Memory Search - Text Tokenizer
 *
 * Provides intelligent tokenization for mixed Chinese-English text and code identifiers
 */

/**
 * Tokenization options
 */
export interface TokenizerOptions {
  /**
   * Minimum token length to keep
   * @default 2
   */
  minLength?: number;

  /**
   * Maximum token length to keep
   * @default 50
   */
  maxLength?: number;

  /**
   * Whether to lowercase all tokens
   * @default true
   */
  lowercase?: boolean;

  /**
   * Whether to keep code identifiers (camelCase, snake_case, etc.)
   * @default true
   */
  keepCodeIdentifiers?: boolean;

  /**
   * Whether to remove stop words
   * @default true
   */
  removeStopWords?: boolean;
}

/**
 * Tokenization result
 */
export interface TokenizationResult {
  /**
   * All tokens extracted from the text
   */
  tokens: string[];

  /**
   * Original text for reference
   */
  original: string;

  /**
   * Statistics about the tokenization
   */
  stats: {
    tokenCount: number;
    uniqueTokens: number;
    chineseChars: number;
    englishWords: number;
    codeIdentifiers: number;
  };
}

/**
 * Common stop words for Chinese and English
 */
const STOP_WORDS = new Set([
  // English stop words
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  // Chinese stop words
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
  '看', '好', '自己', '这',
]);

/**
 * Text tokenizer for mixed Chinese-English content and code
 */
export class Tokenizer {
  private options: Required<TokenizerOptions>;

  constructor(options: TokenizerOptions = {}) {
    this.options = {
      minLength: options.minLength ?? 2,
      maxLength: options.maxLength ?? 50,
      lowercase: options.lowercase ?? true,
      keepCodeIdentifiers: options.keepCodeIdentifiers ?? true,
      removeStopWords: options.removeStopWords ?? true,
    };
  }

  /**
   * Tokenize text into individual tokens
   */
  tokenize(text: string): TokenizationResult {
    const tokens = new Set<string>();
    let chineseChars = 0;
    let englishWords = 0;
    let codeIdentifiers = 0;

    // Extract and process code identifiers first
    if (this.options.keepCodeIdentifiers) {
      const codeTokens = this.extractCodeIdentifiers(text);
      codeTokens.forEach(token => {
        if (this.isValidToken(token)) {
          tokens.add(this.options.lowercase ? token.toLowerCase() : token);
          codeIdentifiers++;
        }
      });
    }

    // Extract Chinese characters (bigrams)
    const chineseBigrams = this.extractChineseBigrams(text);
    chineseBigrams.forEach(bigram => {
      if (this.isValidToken(bigram)) {
        tokens.add(bigram); // Don't lowercase Chinese
        chineseChars += 2;
      }
    });

    // Extract English words
    const englishTokens = this.extractEnglishWords(text);
    englishTokens.forEach(word => {
      const processedWord = this.options.lowercase ? word.toLowerCase() : word;
      if (this.isValidToken(processedWord)) {
        tokens.add(processedWord);
        englishWords++;
      }
    });

    // Remove stop words if enabled
    const finalTokens = Array.from(tokens).filter(
      token => !this.options.removeStopWords || !STOP_WORDS.has(token.toLowerCase())
    );

    return {
      tokens: finalTokens,
      original: text,
      stats: {
        tokenCount: finalTokens.length,
        uniqueTokens: tokens.size,
        chineseChars,
        englishWords,
        codeIdentifiers,
      },
    };
  }

  /**
   * Extract code identifiers (camelCase, snake_case, PascalCase, CONSTANT_CASE)
   */
  private extractCodeIdentifiers(text: string): string[] {
    const identifiers: string[] = [];

    // Match common code patterns
    const patterns = [
      // camelCase and PascalCase
      /[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*/g,
      // snake_case
      /[a-z][a-z0-9]*(_[a-z][a-z0-9]*)+/g,
      // CONSTANT_CASE
      /[A-Z][A-Z0-9]*(_[A-Z][A-Z0-9]*)+/g,
      // kebab-case (less common in code)
      /[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+/g,
      // Function calls
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      // Property access
      /\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      // Generic identifiers
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Clean up the match (remove dots, parentheses, etc.)
          const cleaned = match.replace(/[.\(\)]/g, '');
          if (cleaned.length >= this.options.minLength) {
            // Split camelCase into individual words
            const words = this.splitCamelCase(cleaned);
            identifiers.push(...words);
          }
        });
      }
    }

    return identifiers;
  }

  /**
   * Split camelCase or PascalCase into individual words
   */
  private splitCamelCase(identifier: string): string[] {
    // Insert space before capital letters, then split
    const words = identifier
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .split(/[\s_-]+/);

    // Keep the original identifier as well
    return [identifier.toLowerCase(), ...words].filter(w => w.length >= this.options.minLength);
  }

  /**
   * Extract Chinese character bigrams
   */
  private extractChineseBigrams(text: string): string[] {
    const bigrams: string[] = [];
    // Match Chinese characters (Unicode range for common Chinese)
    const chineseChars = text.match(/[\u4e00-\u9fff]/g);

    if (chineseChars && chineseChars.length >= 2) {
      for (let i = 0; i < chineseChars.length - 1; i++) {
        const bigram = chineseChars[i] + chineseChars[i + 1];
        bigrams.push(bigram);
      }

      // Also add individual characters for single-character terms
      chineseChars.forEach(char => {
        if (char.length >= this.options.minLength) {
          bigrams.push(char);
        }
      });
    }

    return bigrams;
  }

  /**
   * Extract English words
   */
  private extractEnglishWords(text: string): string[] {
    // Match English words (letters only, 2+ characters)
    const words = text.match(/[a-zA-Z]{2,}/g) || [];
    return words;
  }

  /**
   * Check if a token is valid (meets length requirements)
   */
  private isValidToken(token: string): boolean {
    const length = token.length;
    return length >= this.options.minLength && length <= this.options.maxLength;
  }

  /**
   * Calculate similarity between two token sets (Jaccard index)
   */
  static calculateSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}

/**
 * Default tokenizer instance with standard options
 */
export const defaultTokenizer = new Tokenizer();

/**
 * Convenience function to tokenize text with default options
 */
export function tokenize(text: string, options?: TokenizerOptions): TokenizationResult {
  const tokenizer = options ? new Tokenizer(options) : defaultTokenizer;
  return tokenizer.tokenize(text);
}