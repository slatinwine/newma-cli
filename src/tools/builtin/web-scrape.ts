// src/tools/builtin/web-scrape.ts
/**
 * Web scraping tool
 * Fetches and extracts content from web pages
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  Tool,
  ToolContext,
  ToolResult,
  ToolCategory,
  Permission,
  ToolParameter,
  ValidationResult,
} from '../types';

/**
 * Scraped content interface
 */
interface ScrapedContent {
  url: string;
  title: string;
  text: string;
  html_length: number;
  text_length: number;
}

/**
 * Web scrape tool implementation
 */
export const webScrapeTool: Tool = {
  name: 'web_scrape',
  description: 'Fetch and extract content from a web page',
  category: ToolCategory.ANALYSIS,
  permissions: [], // 搜索功能不需要权限验证
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'URL of the web page to scrape',
      required: true,
    },
    {
      name: 'max_length',
      type: 'number',
      description: 'Maximum text length to extract (default: 10000)',
      required: false,
      default: 10000,
    },
    {
      name: 'include_html',
      type: 'boolean',
      description: 'Include HTML structure in output (default: false)',
      required: false,
      default: false,
    },
  ],

  /**
   * Validate parameters
   */
  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Check if URL is provided
    if (!params.url || typeof params.url !== 'string') {
      errors.push('URL must be a non-empty string');
    } else {
      // Validate URL format
      try {
        new URL(params.url as string);
      } catch {
        errors.push('Invalid URL format');
      }
    }

    // Validate max_length if provided
    if (params.max_length !== undefined) {
      const maxLength = Number(params.max_length);
      if (isNaN(maxLength) || maxLength < 100 || maxLength > 100000) {
        errors.push('max_length must be a number between 100 and 100000');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Execute web scraping
   */
  async handler(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { url, max_length = 10000, include_html = false } = params as {
      url: string;
      max_length?: number;
      include_html?: boolean;
    };

    try {
      const content = await fetchPage(url, max_length, include_html);

      return {
        success: true,
        output: `Successfully scraped "${content.title}" (${content.text_length} characters)`,
        metadata: content as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Post-execution: record in history
   */
  async postExecute(result: ToolResult, context: ToolContext): Promise<void> {
    if (result.success && result.metadata) {
      const action: any = {
        type: 'web_scrape',
        url: result.metadata.url as string,
        title: result.metadata.title as string,
        content_length: result.metadata.text_length as number,
      };

      context.history.recordExecution(action, 'success', 0);
    }
  },
};

/**
 * Fetch and parse web page
 */
async function fetchPage(
  url: string,
  maxLength: number = 10000,
  includeHtml: boolean = false
): Promise<ScrapedContent> {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

  try {
    const { data, status } = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
      },
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });

    if (status !== 200) {
      throw new Error(`HTTP ${status}: Failed to fetch page`);
    }

    // Parse HTML
    const $ = cheerio.load(data);

    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

    // Remove unwanted elements
    $('script, style, nav, footer, iframe, noscript').remove();

    // Extract text content
    let text = '';

    // Try to find main content areas
    const mainContent = $('main, article, .content, .post, #content, .article').first();
    if (mainContent.length > 0) {
      text = mainContent.text();
    } else {
      // Fallback to body
      text = $('body').text();
    }

    // Clean up text
    text = text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines
      .trim();

    // Truncate if needed
    const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    const scrapedContent: ScrapedContent = {
      url,
      title,
      text: truncated,
      html_length: data.length,
      text_length: text.length,
    };

    // Optionally include HTML
    if (includeHtml) {
      (scrapedContent as any).html = data;
    }

    return scrapedContent;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Page not found (404)');
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('Domain not found');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Request timeout');
      }
      throw new Error(`Failed to fetch page: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Helper function to fetch page content (outside tool object)
 */
export async function fetchPageContent(
  url: string,
  maxLength: number = 10000
): Promise<ScrapedContent> {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

  const { data } = await axios.get(url, {
    headers: { 'User-Agent': userAgent },
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

  // Remove unwanted elements
  $('script, style, nav, footer, iframe, noscript').remove();

  // Extract text
  let text = $('main, article, .content, .post, #content, .article').first().text() || $('body').text();

  // Clean up text
  text = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();

  // Truncate if needed
  const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

  return {
    url,
    title,
    text: truncated,
    html_length: data.length,
    text_length: text.length,
  };
}
