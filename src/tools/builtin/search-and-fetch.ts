// src/tools/builtin/search-and-fetch.ts
/**
 * Combined search and fetch tool
 * Searches the web and fetches content from top results
 */

import {
  Tool,
  ToolContext,
  ToolResult,
  ToolCategory,
  Permission,
  ToolParameter,
  ValidationResult,
} from '../types';
import { searchBing } from './search';
import { fetchPageContent } from './web-scrape';

/**
 * Fetched search result with content
 */
interface SearchResultWithContent {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  content_length?: number;
  error?: string;
}

/**
 * Search and fetch tool implementation
 */
export const searchAndFetchTool: Tool = {
  name: 'search_and_fetch',
  description: 'Search the web and fetch content from top results for AI analysis',
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
      description: 'Number of search results to fetch content from (default: 3, max: 5)',
      required: false,
      default: 3,
    },
    {
      name: 'content_length',
      type: 'number',
      description: 'Maximum characters to extract from each page (default: 5000)',
      required: false,
      default: 5000,
    },
  ],

  /**
   * Validate parameters
   */
  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!params.query || typeof params.query !== 'string') {
      errors.push('Query must be a non-empty string');
    }

    if (params.max_results !== undefined) {
      const maxResults = Number(params.max_results);
      if (isNaN(maxResults) || maxResults < 1 || maxResults > 5) {
        errors.push('max_results must be a number between 1 and 5');
      }
    }

    if (params.content_length !== undefined) {
      const contentLength = Number(params.content_length);
      if (isNaN(contentLength) || contentLength < 500 || contentLength > 50000) {
        errors.push('content_length must be a number between 500 and 50000');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Execute search and fetch
   */
  async handler(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { query, max_results = 3, content_length = 5000 } = params as {
      query: string;
      max_results?: number;
      content_length?: number;
    };

    try {
      // Step 1: Search
      console.log(`🔍 Searching for: "${query}"`);
      const searchResults = await searchBing(query, 10);

      if (searchResults.length === 0) {
        return {
          success: false,
          error: 'No search results found',
        };
      }

      console.log(`✅ Found ${searchResults.length} results, fetching top ${max_results}...`);

      // Step 2: Fetch content from top results
      const resultsWithContent: SearchResultWithContent[] = [];
      const fetchPromises = searchResults
        .slice(0, max_results)
        .map(async (result) => {
          try {
            console.log(`  📄 Fetching: ${result.title}`);
            const content = await fetchPageContent(result.url, content_length);

            return {
              title: result.title,
              url: result.url,
              snippet: result.snippet,
              content: content.text,
              content_length: content.text_length,
            };
          } catch (error) {
            console.log(`  ⚠️  Failed to fetch ${result.url}: ${error}`);
            return {
              title: result.title,
              url: result.url,
              snippet: result.snippet,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

      const fetchedResults = await Promise.all(fetchPromises);
      resultsWithContent.push(...fetchedResults);

      // Step 3: Format for AI consumption
      const successfulFetches = resultsWithContent.filter((r) => r.content);
      const totalContentLength = successfulFetches.reduce(
        (sum, r) => sum + (r.content_length || 0),
        0
      );

      return {
        success: true,
        output: `Fetched content from ${successfulFetches.length}/${max_results} pages (${totalContentLength} characters)`,
        metadata: {
          query,
          total_results: searchResults.length,
          fetched_count: resultsWithContent.length,
          successful_count: successfulFetches.length,
          total_content_length: totalContentLength,
          results: resultsWithContent,
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
      const action: any = {
        type: 'search_and_fetch',
        query: result.metadata.query as string,
        fetched_count: result.metadata.fetched_count as number,
        successful_count: result.metadata.successful_count as number,
        total_content_length: result.metadata.total_content_length as number,
      };

      context.history.recordExecution(action, 'success', 0);
    }
  },
};

/**
 * Helper function to format search results for AI
 */
export function formatSearchResultsForAI(results: SearchResultWithContent[], query: string): string {
  let formatted = `# Web Search Results: "${query}"\n\n`;
  formatted += `Fetched ${results.filter((r) => r.content).length} pages with content\n\n`;
  formatted += `---\n\n`;

  results.forEach((result, index) => {
    formatted += `## ${index + 1}. ${result.title}\n`;
    formatted += `URL: ${result.url}\n\n`;

    if (result.content) {
      formatted += `${result.content}\n\n`;
    } else if (result.error) {
      formatted += `_Failed to fetch content: ${result.error}_\n\n`;
    }

    formatted += `---\n\n`;
  });

  return formatted;
}

/**
 * Format search results metadata for AI
 */
export function formatSearchMetadataForAI(metadata: any): string {
  const results = metadata.results as SearchResultWithContent[];
  let formatted = `# Search and Fetch Results for: "${metadata.query}"\n\n`;
  formatted += `Total results: ${metadata.total_results}\n`;
  formatted += `Successfully fetched: ${metadata.successful_count}/${metadata.fetched_count}\n\n`;
  formatted += `---\n\n`;

  results.forEach((result, index) => {
    formatted += `## Result ${index + 1}\n`;
    formatted += `**Title**: ${result.title}\n`;
    formatted += `**URL**: ${result.url}\n`;
    formatted += `**Snippet**: ${result.snippet}\n\n`;

    if (result.content) {
      formatted += `**Content**:\n${result.content}\n\n`;
    } else if (result.error) {
      formatted += `**Error**: ${result.error}\n\n`;
    }

    formatted += `---\n\n`;
  });

  return formatted;
}
