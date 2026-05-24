// src/tools/builtin/search.ts
/**
 * Web search tool
 * Performs web searches using Bing search API
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
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
 * Search result interface
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  search_timestamp?: string;  // ISO timestamp of when search was performed
  search_query?: string;      // The actual query used (with time enhancement)
}

/**
 * Web search tool implementation
 */
export const searchTool: Tool = {
  name: 'search',
  description: 'Search the web using Bing search engine',
  category: ToolCategory.ANALYSIS,
  permissions: [], // 搜索功能不需要权限验证
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'Search query string',
      required: true,
    },
    {
      name: 'max_results',
      type: 'number',
      description: 'Maximum number of results to return (default: 10)',
      required: false,
      default: 10,
    },
  ],

  /**
   * Validate search parameters
   */
  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    // Check if query is provided and is a string
    if (!params.query || typeof params.query !== 'string') {
      errors.push('Query must be a non-empty string');
    }

    // Validate max_results if provided
    if (params.max_results !== undefined) {
      const maxResults = Number(params.max_results);
      if (isNaN(maxResults) || maxResults < 1 || maxResults > 50) {
        errors.push('max_results must be a number between 1 and 50');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Execute web search
   */
  async handler(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { query, max_results = 10 } = params as {
      query: string;
      max_results?: number;
    };

    try {
      const results = await searchBing(query, max_results);

      return {
        success: true,
        output: `Found ${results.length} search results for "${query}"`,
        metadata: {
          query,
          count: results.length,
          results,
        },
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
      // Record search execution
      const action: any = {
        type: 'search',
        query: result.metadata.query as string,
        results_count: result.metadata.count as number,
      };

      context.history.recordExecution(action, 'success', 0);
    }
  },
};

/**
 * Perform Bing search
 */
export async function searchBing(query: string, maxResults: number = 10): Promise<SearchResult[]> {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

  // Enhance query with current time for better temporal results
  const enhancedQuery = enhanceQueryWithTime(query);

  // Log the actual search query for transparency
  console.log(chalk.gray(`🔍 Searching for: "${enhancedQuery}"`));

  const url = `https://cn.bing.com/search?q=${encodeURIComponent(enhancedQuery)}`;

  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': userAgent },
      timeout: 10000,
    });

    const results = parseBingResults(data, maxResults);

    // Add search metadata to each result
    const searchTimestamp = new Date().toISOString();
    return results.map(result => ({
      ...result,
      search_timestamp: searchTimestamp,
      search_query: enhancedQuery,
    }));

  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Search request failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Enhance search query with current time context
 * Adds temporal information to improve search result relevance
 */
function enhanceQueryWithTime(query: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Check if query already contains temporal keywords
  const temporalKeywords = /\b(2024|2025|2026|最新|今天|本周|本月|今年|latest|today|this week|this month|this year)\b/i;

  if (temporalKeywords.test(query)) {
    // Query already has temporal context, use as-is
    return query;
  }

  // Add year and month to query for better temporal relevance
  // Format: "original query year month"
  return `${query} ${year}年${month}月`;
}

/**
 * Parse Bing search results from HTML
 */
function parseBingResults(html: string, maxResults: number): SearchResult[] {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  $('.b_algo').each((index, element) => {
    if (index >= maxResults) return false; // Stop after maxResults

    const $el = $(element);
    const title = $el.find('h2 a').first().text().trim();
    const url = $el.find('h2 a').first().attr('href');
    const snippet = $el.find('.b_caption p').text().trim();

    if (title && url) {
      results.push({ title, url, snippet: snippet || 'No description available' });
    }
  });

  return results;
}
