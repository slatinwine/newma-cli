/**
 * Markdown Renderer for Terminal Output
 *
 * Provides Markdown rendering capabilities for CLI chat responses.
 * Uses unified/remark for Markdown parsing with custom chalk-based rendering.
 */

import chalk from 'chalk';

// Lazy load dependencies
let unified: any = null;
let remarkParse: any = null;
let compiler: any = null;

/**
 * Initialize the unified/remark dependencies
 * Uses lazy loading to handle potential import errors gracefully
 */
function initDependencies() {
  if (unified !== null) {
    return { unified, remarkParse, compiler };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    unified = require('unified');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    remarkParse = require('remark-parse');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    compiler = require('terminal-markdown/lib/compiler');

    return { unified, remarkParse, compiler };
  } catch (error) {
    console.error(chalk.yellow('Warning: Markdown dependencies not available. Falling back to basic rendering.\n'));
    return null;
  }
}

/**
 * Render Markdown text to terminal-friendly format
 *
 * Features:
 * - Headers (H1-H6)
 * - Bold, italic, strikethrough
 * - Code blocks with syntax highlighting
 * - Inline code
 * - Ordered and unordered lists
 * - Blockquotes
 * - Tables
 * - Links
 * - Task lists
 *
 * @param markdown - Raw markdown string to render
 * @param options - Rendering options
 * @returns Rendered string ready for console output
 */
export function renderMarkdown(
  markdown: string,
  options: {
    /** Enable syntax highlighting for code blocks (default: true) */
    highlight?: boolean;
    /** Maximum width for output (default: terminal width or 80) */
    maxWidth?: number;
    /** Show inline codes in different color (default: true) */
    colorInlineCode?: boolean;
  } = {}
): string {
  // Initialize dependencies
  const deps = initDependencies();

  if (!deps || !deps.unified || !deps.remarkParse || !deps.compiler) {
    // Fallback: return plain text with basic chalk formatting
    return renderFallbackMarkdown(markdown, options);
  }

  try {
    // Create unified processor
    function stringify() {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.Compiler = deps.compiler;
    }

    const processor = deps.unified()
      .use(deps.remarkParse)
      .use(stringify);

    // Process markdown
    const rendered = processor.processSync(markdown).toString();

    return rendered;
  } catch (error) {
    // If rendering fails, fallback to plain text
    console.error(chalk.yellow(`Warning: Markdown rendering failed: ${error}. Using fallback.\n`));
    return renderFallbackMarkdown(markdown, options);
  }
}

/**
 * Fallback Markdown renderer using chalk
 *
 * Provides basic formatting when terminal-markdown is not available:
 * - Headers: colored and bold
 * - Bold: bold text
 * - Code blocks: gray background
 * - Inline code: yellow
 * - Lists: with bullets
 *
 * @param markdown - Raw markdown string
 * @param options - Rendering options
 * @returns Rendered string with basic formatting
 */
function renderFallbackMarkdown(
  markdown: string,
  options: {
    colorInlineCode?: boolean;
    maxWidth?: number;
  } = {}
): string {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    // Headers (# ## ### etc.)
    const headerMatch = line.match(/^(#{1,6})\s(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const colors = [
        chalk.red.bold,    // H1
        chalk.yellow.bold, // H2
        chalk.green.bold,  // H3
        chalk.cyan.bold,   // H4
        chalk.blue.bold,   // H5
        chalk.magenta.bold // H6
      ];
      const color = colors[Math.min(level - 1, 5)];
      result.push(color(text));
      continue;
    }

    // Code blocks (```...```)
    if (line.trim().startsWith('```')) {
      result.push(chalk.gray(line)); // Delimiter
      continue;
    }

    // Blockquotes (> ...)
    if (line.trim().startsWith('>')) {
      result.push(chalk.cyan(line));
      continue;
    }

    // Unordered lists (- * +)
    if (line.match(/^\s*[-*+]\s/)) {
      result.push(chalk.white(line));
      continue;
    }

    // Ordered lists (1. 2. 3.)
    if (line.match(/^\s*\d+\.\s/)) {
      result.push(chalk.white(line));
      continue;
    }

    // Bold (**...** or __...__)
    let processedLine = line.replace(/\*\*(.+?)\*\*/g, chalk.bold('$1'));
    processedLine = processedLine.replace(/__(.+?)__/g, chalk.bold('$1'));

    // Italic (*...* or _..._)
    processedLine = processedLine.replace(/\*(.+?)\*/g, chalk.italic('$1'));
    processedLine = processedLine.replace(/_(.+?)_/g, chalk.italic('$1'));

    // Inline code (`...`)
    if (options.colorInlineCode !== false) {
      processedLine = processedLine.replace(/`([^`]+)`/g, chalk.yellow('$1'));
    }

    result.push(processedLine);
  }

  return result.join('\n');
}

/**
 * Check if Markdown rendering is supported
 *
 * @returns true if terminal-markdown is available
 */
export function isMarkdownSupported(): boolean {
  const deps = initDependencies();
  return deps !== null && deps.unified !== null && deps.compiler !== null;
}

/**
 * Get rendering support information
 *
 * @returns Object with support details
 */
export function getRendererInfo(): {
  supported: boolean;
  renderer: string;
  features: string[];
} {
  const deps = initDependencies();

  if (deps && deps.unified && deps.compiler) {
    return {
      supported: true,
      renderer: 'terminal-markdown (unified/remark)',
      features: [
        'Headers (H1-H6)',
        'Bold, italic, strikethrough',
        'Code blocks with syntax highlighting',
        'Inline code',
        'Ordered and unordered lists',
        'Blockquotes',
        'Tables',
        'Links',
        'Task lists',
      ]
    };
  }

  return {
    supported: false,
    renderer: 'chalk fallback',
    features: [
      'Headers (H1-H6)',
      'Basic bold and italic',
      'Code blocks (basic)',
      'Inline code (colored)',
      'Basic lists',
    ]
  };
}
