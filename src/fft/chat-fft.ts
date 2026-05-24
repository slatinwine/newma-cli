/**
 * Chat mode with FFT (Fast and Frugal Tree) decision making
 *
 * This module implements chatAI using FFT for fast, transparent decisions.
 *
 * Phase 9.2: Added Memo integration for decision path recording
 */

import chalk from 'chalk';
import { Config } from '../config';
import { ToolExecutor } from '../executor-v2';
import { ToolRegistry } from '../tools/registry';
import { FFTEngine, FFTEngineOptions } from './engine';
import { ChatInput, FFTAction } from './types';
import { renderMarkdown } from '../markdown-renderer';
import fetch from 'node-fetch';
import { MemoCliPlugin } from '../loop/plugins/memo-cli-plugin';

/**
 * Chat with FFT - Fast decision making using predefined decision tree
 *
 * Phase 9.2: Added memoPlugin parameter for decision recording
 *
 * @param config - OpenAI configuration
 * @param userMessage - User's message (also used as requirement)
 * @param signal - AbortSignal for cancellation
 * @param userProfile - User profile (optional)
 * @param toolRegistry - Tool registry
 * @param toolExecutor - Tool executor
 * @param memoPlugin - Memo plugin for recording decisions (optional)
 * @returns AI response as string
 */
export async function chatAIWithFFT(
  config: Config,
  userMessage: string,
  signal?: AbortSignal,
  userProfile?: string,
  toolRegistry?: ToolRegistry,
  toolExecutor?: ToolExecutor,
  hookSystem?: any, // TODO: Add proper type
  frontend?: any, // Frontend for output (WebFrontend)
  imageRefs?: any[], // Image references for multimodal input
  projectRoot?: string, // Project root for resolving image paths
  skillManager?: any, // Skill manager for AI tool integration
  memoPlugin?: MemoCliPlugin  // ← Phase 9.2
): Promise<string> {
  const startTime = Date.now();

  console.log(chalk.gray('📤 [FFT Mode] Analyzing request with fast decision tree...\n'));

  // Build input context
  const input: ChatInput = {
    message: userMessage,
    userProfile,
    timestamp: new Date(),
  };

  // Phase 9.2: Create FFT engine with Memo integration
  const fftOptions: FFTEngineOptions = {
    maxDepth: 3,
    enableFallback: true,
    verbose: process.env.DEBUG_FFT === 'true',
    memoPlugin,  // ← Phase 9.2
    requirement: userMessage,  // ← Phase 9.2
  };

  const engine = new FFTEngine(fftOptions);

  const fftTree = engine.buildChatFFT();

  // Evaluate FFT decision tree
  const fftResult = await engine.evaluate(fftTree, input);

  const decisionTime = Date.now() - startTime;
  console.log(chalk.gray(`⏱️  [FFT] Decision made in ${decisionTime}ms`));
  console.log(chalk.gray(`📊 [FFT] Path: ${fftResult.path.join(' → ')}`));
  console.log(chalk.gray(`📊 [FFT] Action: ${chalk.cyan(fftResult.action.type)}\n`));

  // Execute the FFT action
  switch (fftResult.action.type) {
    case 'search':
      return await executeSearchAction(
        config,
        userMessage,
        fftResult.action,
        signal,
        userProfile,
        toolExecutor
      );

    case 'answer':
      return await executeDirectAnswer(
        config,
        userMessage,
        signal,
        userProfile
      );

    case 'clarify':
      return fftResult.action.question;

    case 'fallback':
      console.log(chalk.yellow('[FFT] Using fallback to standard AI mode\n'));
      return await executeDirectAnswer(
        config,
        userMessage,
        signal,
        userProfile
      );

    default:
      // Should never reach here
      return await executeDirectAnswer(
        config,
        userMessage,
        signal,
        userProfile
      );
  }
}

/**
 * Execute search action based on FFT decision
 */
async function executeSearchAction(
  config: Config,
  userMessage: string,
  action: Extract<FFTAction, { type: 'search' }>,
  signal?: AbortSignal,
  userProfile?: string,
  toolExecutor?: ToolExecutor
): Promise<string> {
  if (!toolExecutor) {
    console.log(chalk.yellow('⚠️  [FFT] Search requested but no tool executor available\n'));
    console.log(chalk.gray('[FFT] Falling back to direct answer\n'));
    return await executeDirectAnswer(config, userMessage, signal, userProfile);
  }

  console.log(chalk.cyan(`🔍 [FFT] Executing search: ${action.prompt || 'Searching...'}\n`));

  // Build search query from user message
  const searchQuery = extractSearchQuery(userMessage);

  try {
    // Execute the specified search tool
    const toolResult = await toolExecutor.executeToolCall({
      tool: action.tool,
      parameters: {
        query: searchQuery,
        max_results: action.maxResults || 3,
      },
      id: `fft-search-${Date.now()}`,
    });

    if (!toolResult.success) {
      console.log(chalk.red(`❌ [FFT] Search failed: ${toolResult.error}\n`));
      console.log(chalk.gray('[FFT] Falling back to direct answer\n'));
      return await executeDirectAnswer(config, userMessage, signal, userProfile);
    }

    // Format search results
    let searchContext = '';
    if (toolResult.metadata && (toolResult.metadata as any).results) {
      const results = (toolResult.metadata as any).results;
      searchContext = '\n\n搜索结果:\n' + results.map((r: any, i: number) => {
        return `\n[${i + 1}] ${r.title}\n    URL: ${r.url}\n    摘要: ${r.snippet}\n`;
      }).join('');
    } else if (toolResult.output) {
      searchContext = `\n\n搜索结果:\n${toolResult.output}\n`;
    }

    console.log(chalk.gray(`📥 [FFT] Search completed, generating answer...\n`));

    // Generate answer based on search results
    return await generateAnswerFromSearch(
      config,
      userMessage,
      searchContext,
      signal,
      userProfile
    );

  } catch (error: any) {
    console.log(chalk.red(`❌ [FFT] Search error: ${error.message}\n`));
    console.log(chalk.gray('[FFT] Falling back to direct answer\n'));
    return await executeDirectAnswer(config, userMessage, signal, userProfile);
  }
}

/**
 * Execute direct answer (no search)
 */
async function executeDirectAnswer(
  config: Config,
  userMessage: string,
  signal?: AbortSignal,
  userProfile?: string
): Promise<string> {
  console.log(chalk.gray('💬 [FFT] Generating direct answer...\n'));

  const endpoint = config.endpoint ||
    `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

  // Build system prompt
  let systemPrompt = `You are a helpful AI assistant.
Respond concisely and directly.
Provide accurate, well-structured answers based on your knowledge.

📅 CURRENT TIME CONTEXT
Today's date: ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
Current year: ${new Date().getFullYear()}
Use this temporal context when understanding questions.`;

  if (userProfile) {
    systemPrompt += `\n\nUSER PROFILE:\n${userProfile}\n\nIMPORTANT: Adapt your response language and style to match the user's preferences.`;
  }

  try {
    const requestBody = {
      model: config.model,
      temperature: 0.7,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    };

    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.text();
      throw new Error(`OpenAI API error: ${fetchResponse.status} - ${err}`);
    }

    const data = await fetchResponse.json();
    const message = data.choices?.[0]?.message;

    if (!message?.content) {
      throw new Error('No content in API response');
    }

    const response = message.content;

    // Render markdown and display
    const renderedMessage = renderMarkdown(response);
    console.log(renderedMessage);

    if (data.usage) {
      console.log(chalk.gray(`\n📊 Tokens: ${data.usage.total_tokens}`));
    }

    return response;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }

    console.log(chalk.red(`❌ [FFT] API error: ${error.message}\n`));
    throw error;
  }
}

/**
 * Generate answer based on search results
 */
async function generateAnswerFromSearch(
  config: Config,
  userMessage: string,
  searchContext: string,
  signal?: AbortSignal,
  userProfile?: string
): Promise<string> {
  const endpoint = config.endpoint ||
    `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

  let systemPrompt = `You are a helpful AI assistant with access to search results.
Provide accurate, well-structured answers based on the search results.

When answering:
1. Synthesize information from multiple sources when available
2. Mention the timeframe of your information (e.g., "As of January 2026")
3. Cite sources when relevant
4. Keep responses concise but comprehensive
5. If search results are insufficient, clearly state limitations`;

  if (userProfile) {
    systemPrompt += `\n\nUSER PROFILE:\n${userProfile}\n\nIMPORTANT: Adapt your response language and style to match the user's preferences.`;
  }

  try {
    const requestBody = {
      model: config.model,
      temperature: 0.7,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Question: ${userMessage}\n\n${searchContext}\n\nPlease provide a comprehensive answer based on these search results.`
        },
      ],
    };

    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.text();
      throw new Error(`OpenAI API error: ${fetchResponse.status} - ${err}`);
    }

    const data = await fetchResponse.json();
    const message = data.choices?.[0]?.message;

    if (!message?.content) {
      throw new Error('No content in API response');
    }

    const response = message.content;

    // Render markdown and display
    const renderedMessage = renderMarkdown(response);
    console.log(renderedMessage);

    if (data.usage) {
      console.log(chalk.gray(`\n📊 Tokens: ${data.usage.total_tokens}`));
    }

    return response;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }

    console.log(chalk.red(`❌ [FFT] API error: ${error.message}\n`));
    throw error;
  }
}

/**
 * Extract search query from user message
 */
function extractSearchQuery(message: string): string {
  // Remove common question words and keep the core query
  const questionWords = [
    'what is', 'what are', 'how to', 'how do',
    'explain', 'describe', 'tell me about',
    '什么是', '如何', '怎么', '解释', '描述',
  ];

  let query = message.toLowerCase();

  // Remove question words
  questionWords.forEach(word => {
    const regex = new RegExp(`^${word}\\s+`, 'i');
    query = query.replace(regex, '');
  });

  // Remove trailing question marks and extra whitespace
  query = query.replace(/\?+$/, '').trim();

  // If query is too short, use original message
  if (query.length < 3) {
    return message;
  }

  return query;
}
