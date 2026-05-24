// src/errors.ts
/**
 * Enhanced error handling system for Kode
 * Provides structured error categorization and user-friendly messaging
 */

/**
 * Error codes for categorizing different types of failures
 */
export enum ErrorCode {
  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_EXISTS = 'FILE_EXISTS',
  INVALID_PATH = 'INVALID_PATH',

  // API errors
  API_ERROR = 'API_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',

  // Execution errors
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  COMMAND_FAILED = 'COMMAND_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Rollback errors
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',
  BACKUP_FAILED = 'BACKUP_FAILED',

  // Retry errors
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
}

/**
 * Base error class for all Kode errors
 * Provides structured error information with categorization
 */
export class KodeError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public retryable: boolean = false,
    public cause?: Error
  ) {
    super(message);
    this.name = 'KodeError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, KodeError);
    }
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.retryable || this.isRetryableCode(this.code);
  }

  /**
   * Determine if an error code is inherently retryable
   */
  private isRetryableCode(code: ErrorCode): boolean {
    return [
      ErrorCode.API_TIMEOUT,
      ErrorCode.API_RATE_LIMIT,
    ].includes(code);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return getUserFriendlyMessage(this);
  }
}

/**
 * Handle unknown errors and convert to KodeError
 */
export function handleError(error: unknown): KodeError {
  if (error instanceof KodeError) {
    return error;
  }

  if (error instanceof Error) {
    // Categorize common errors
    const message = error.message.toLowerCase();

    // File system errors
    if (message.includes('enoent') || message.includes('file not found')) {
      return new KodeError(
        `File not found: ${error.message}`,
        ErrorCode.FILE_NOT_FOUND,
        false,
        error
      );
    }

    if (message.includes('eacces') || message.includes('permission denied')) {
      return new KodeError(
        `Permission denied: ${error.message}`,
        ErrorCode.PERMISSION_DENIED,
        false,
        error
      );
    }

    if (message.includes('eexist') || message.includes('file already exists')) {
      return new KodeError(
        `File already exists: ${error.message}`,
        ErrorCode.FILE_EXISTS,
        false,
        error
      );
    }

    // Network/timeout errors
    if (message.includes('etimedout') || message.includes('timeout')) {
      return new KodeError(
        `Operation timed out: ${error.message}`,
        ErrorCode.API_TIMEOUT,
        true,  // Timeout errors are retryable
        error
      );
    }

    if (message.includes('econnrefused')) {
      return new KodeError(
        `Connection refused: ${error.message}`,
        ErrorCode.API_ERROR,
        true,  // Connection issues might be transient
        error
      );
    }

    // Generic error wrapper
    return new KodeError(
      error.message,
      ErrorCode.EXECUTION_ERROR,
      false,
      error
    );
  }

  // Non-error objects
  return new KodeError(
    `Unknown error: ${String(error)}`,
    ErrorCode.EXECUTION_ERROR,
    false
  );
}

/**
 * Get user-friendly error message based on error code
 */
export function getUserFriendlyMessage(error: KodeError): string {
  switch (error.code) {
    case ErrorCode.FILE_NOT_FOUND:
      return `I couldn't find the file you're looking for. Please check the file path.`;

    case ErrorCode.PERMISSION_DENIED:
      return `I don't have permission to access that file. Try checking file permissions.`;

    case ErrorCode.API_TIMEOUT:
      return `The API request timed out. This might be a network issue.`;

    case ErrorCode.API_RATE_LIMIT:
      return `API rate limit reached. Please wait a moment and try again.`;

    case ErrorCode.INVALID_RESPONSE:
      return `The AI returned an invalid response. This might be a temporary issue.`;

    case ErrorCode.COMMAND_FAILED:
      return `The command failed: ${error.message}`;

    case ErrorCode.VALIDATION_ERROR:
      return `Validation failed: ${error.message}`;

    case ErrorCode.ROLLBACK_FAILED:
      return `Rollback failed: ${error.message}. You may need to manually restore files.`;

    case ErrorCode.BACKUP_FAILED:
      return `Failed to create backup: ${error.message}`;

    case ErrorCode.MAX_RETRIES_EXCEEDED:
      return `Operation failed after maximum retry attempts.`;

    default:
      return error.message;
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: KodeError): boolean {
  return error.isRetryable();
}

/**
 * Create a retryable error wrapper
 */
export function asRetryable(error: Error | KodeError): KodeError {
  if (error instanceof KodeError) {
    error.retryable = true;
    return error;
  }

  return new KodeError(
    error.message,
    ErrorCode.EXECUTION_ERROR,
    true,
    error
  );
}
