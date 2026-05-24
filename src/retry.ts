// src/retry.ts
/**
 * Retry logic with exponential backoff
 * Handles transient failures in network and API operations
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,  // 1 second
  maxDelay: 10000,     // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Retry configuration for file operations (fewer retries)
 */
export const FILE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  initialDelay: 500,
  maxDelay: 2000,
  backoffMultiplier: 2,
};

/**
 * Result type for error handling without exceptions
 */
export type Result<T, E = Error> =
  | { success: true; data: T; attempts: number }
  | { success: false; error: E; attempts: number };

/**
 * Sleep utility for backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute async function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result with data or error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Result<T>> {
  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const data = await fn();
      return { success: true, data, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if this is the last attempt
      if (attempt >= config.maxAttempts) {
        break;
      }

      // Log retry attempt
      console.warn(`⚠️ Attempt ${attempt}/${config.maxAttempts} failed, retrying in ${delay}ms...`);

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  return { success: false, error: lastError!, attempts: config.maxAttempts };
}

/**
 * Wrap file operations with retry logic
 *
 * @param operation - Description of the operation for error messages
 * @param fn - Async function to execute
 * @returns Result with data or throws
 */
export async function retryFileOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const result = await retryWithBackoff(fn, FILE_RETRY_CONFIG);

  if (!result.success) {
    throw new Error(`File operation failed (${operation}): ${result.error.message}`);
  }

  return result.data;
}

/**
 * Execute with retry and custom error handling
 *
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @param onError - Optional error handler for each attempt
 * @returns Result
 */
export async function retryWithErrorHandling<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onError?: (error: Error, attempt: number) => void
): Promise<Result<T>> {
  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const data = await fn();
      return { success: true, data, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Call error handler if provided
      if (onError) {
        onError(lastError, attempt);
      }

      // Don't retry if this is the last attempt
      if (attempt >= config.maxAttempts) {
        break;
      }

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  return { success: false, error: lastError!, attempts: config.maxAttempts };
}

/**
 * Check if a retry is worth attempting based on error type
 */
export function shouldRetry(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Retry on timeout and network errors
  if (message.includes('timeout') || message.includes('etimedout')) {
    return true;
  }

  if (message.includes('econnrefused') || message.includes('econnreset')) {
    return true;
  }

  // Retry on rate limiting
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }

  // Don't retry on other errors
  return false;
}

/**
 * Calculate delay for next retry attempt
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}
