/**
 * Progressive Prompt Simplification
 *
 * Implements multi-tier retry system with progressively simplified prompts.
 * Based on industry best practices from Cursor, Aider, and production AI agents.
 */

import chalk from 'chalk';
import { Config } from '../config';
import { TokenUsage } from '../types';

export interface RetryAttempt {
  attempt: number;
  prompt: string;
  temperature: number;
  description: string;
}

export interface ProgressiveRetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, total: number) => void;
  endpoint?: string;
  signal?: AbortSignal;
}

/**
 * Generate progressively simplified prompts
 */
export class ProgressiveRetryPrompts {
  /**
   * Generate prompts for plan mode
   */
  static forPlanMode(originalPrompt: string, userRequirement: string): RetryAttempt[] {
    return [
      {
        attempt: 0,
        prompt: originalPrompt,
        temperature: 0.7,
        description: 'Original prompt with examples',
      },
      {
        attempt: 1,
        prompt: `${originalPrompt}

🚨 CRITICAL OUTPUT REQUIREMENTS:
1. Respond with ONLY valid JSON - no markdown, no code blocks
2. Do NOT wrap JSON in \`\`\`json or \`\`\`
3. Start your response immediately with '{'
4. End your response with '}'
5. If you must explain, put it in the "description" field

Expected format:
{
  "todo": ["task 1", "task 2"],
  "actions": [{"type": "create", "path": "file.txt", "content": "..."}]
}

Requirement: ${userRequirement}`,
        temperature: 0.3,
        description: 'Simplified prompt with explicit format requirements',
      },
      {
        attempt: 2,
        prompt: `Return valid JSON only. No explanations. No markdown.

Format: {"todo": ["string"], "actions": [{"type": "create|modify|run|verify", ...}]}

Requirement: ${userRequirement}

Start response with: {`,
        temperature: 0,
        description: 'Minimal prompt with JSON-only instruction',
      },
    ];
  }

  /**
   * Generate prompts for verify mode
   */
  static forVerifyMode(originalPrompt: string, userRequirement: string): RetryAttempt[] {
    return [
      {
        attempt: 0,
        prompt: originalPrompt,
        temperature: 0.7,
        description: 'Original prompt with examples',
      },
      {
        attempt: 1,
        prompt: `${originalPrompt}

🚨 CRITICAL: Respond with valid JSON only.

Format:
{
  "satisfied": true|false,
  "reasoning": "explanation",
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"]
}

Requirement: ${userRequirement}`,
        temperature: 0.3,
        description: 'Simplified prompt with explicit format',
      },
      {
        attempt: 2,
        prompt: `JSON response only.
Format: {"satisfied": boolean, "reasoning": "string"}

Requirement: ${userRequirement}

Start with: {`,
        temperature: 0,
        description: 'Minimal prompt',
      },
    ];
  }

  /**
   * Generate prompts for chat mode (less aggressive, usually works first time)
   */
  static forChatMode(originalPrompt: string): RetryAttempt[] {
    return [
      {
        attempt: 0,
        prompt: originalPrompt,
        temperature: 0.7,
        description: 'Original prompt',
      },
      {
        attempt: 1,
        prompt: `${originalPrompt}\n\nPlease provide a clear, concise response.`,
        temperature: 0.5,
        description: 'Simplified prompt',
      },
    ];
  }
}

/**
 * Execute API call with progressive retries
 */
export async function callAIWithProgressiveRetries(
  config: Config,
  systemPrompt: string,
  userRequirement: string,
  mode: 'plan' | 'verify' | 'chat',
  options: ProgressiveRetryOptions = {}
): Promise<{
  response: any;
  attempt: number;
  duration: number;
  usage?: TokenUsage;
}> {
  const {
    maxRetries = 3,
    onRetry,
    endpoint = config.baseUrl || 'https://api.openai.com/v1/chat/completions',
    signal,
  } = options;

  // Generate prompts based on mode
  const prompts = mode === 'plan'
    ? ProgressiveRetryPrompts.forPlanMode(systemPrompt, userRequirement)
    : mode === 'verify'
    ? ProgressiveRetryPrompts.forVerifyMode(systemPrompt, userRequirement)
    : ProgressiveRetryPrompts.forChatMode(systemPrompt);

  const startTime = Date.now();
  let lastError: any = null;

  // Try each prompt in sequence
  for (const retryAttempt of prompts.slice(0, maxRetries)) {
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    if (retryAttempt.attempt > 0) {
      console.log(chalk.yellow(`🔄 Retry ${retryAttempt.attempt}/${maxRetries - 1}: ${retryAttempt.description}\n`));

      if (onRetry) {
        onRetry(retryAttempt.attempt, maxRetries);
      }
    }

    try {
      const requestBody: any = {
        model: config.model,
        temperature: retryAttempt.temperature,
        max_tokens: mode === 'chat' ? 4096 : 2048,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: retryAttempt.prompt },
        ],
      };

      // Add response_format for OpenAI (only on first attempt)
      if (retryAttempt.attempt === 0 && (mode === 'plan' || mode === 'verify')) {
        const isOpenAI = endpoint.includes('api.openai.com');
        const supportsFormat = process.env.OPENAI_SUPPORTS_RESPONSE_FORMAT !== 'false';

        if (isOpenAI || supportsFormat) {
          requestBody.response_format = { type: 'json_object' };
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`API error: ${response.status} - ${errorText}`);

        // If response_format error, remove it and retry immediately
        if (errorText.includes('response_format') && retryAttempt.attempt === 0) {
          delete requestBody.response_format;
          continue; // Retry with modified request
        }

        if (retryAttempt.attempt < maxRetries - 1) {
          console.log(chalk.yellow(`⚠️  Attempt ${retryAttempt.attempt + 1} failed: ${response.status}\n`));
          continue;
        }

        throw lastError;
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const content = message?.content || message?.reasoning_content || '';

      const duration = Date.now() - startTime;
      const usage: TokenUsage | undefined = data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      } : undefined;

      return {
        response: data,
        attempt: retryAttempt.attempt,
        duration,
        usage,
      };

    } catch (error: any) {
      lastError = error;

      // If this is not the last attempt, continue to next prompt
      if (retryAttempt.attempt < maxRetries - 1) {
        console.log(chalk.yellow(`⚠️  Attempt ${retryAttempt.attempt + 1} failed: ${error.message}\n`));
        continue;
      }

      // Last attempt failed, throw error
      throw new Error(`All ${maxRetries} retry attempts failed. Last error: ${lastError.message}`);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Progressive retry failed');
}

/**
 * Format retry statistics for logging
 */
export function formatRetryStats(attempts: number, maxRetries: number, duration: number): string {
  const success = attempts === 0 ? 'First attempt' : `After ${attempts} retries`;
  const rate = attempts === 0 ? 100 : Math.round((1 / (attempts + 1)) * 100);

  return [
    `📊 Retry Statistics:`,
    `   Attempts: ${attempts + 1}/${maxRetries}`,
    `   Success: ${success}`,
    `   Duration: ${duration}ms`,
    `   Success Rate: ${rate}%`,
  ].join('\n');
}
