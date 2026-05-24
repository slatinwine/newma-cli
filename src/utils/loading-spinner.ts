// src/utils/loading-spinner.ts
/**
 * Loading spinner utility for long-running operations
 * Provides visual feedback during AI calls and other async operations
 */

import readline from 'readline';

/**
 * Loading spinner class
 */
export class LoadingSpinner {
  private spinner: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private index = 0;
  private interval?: NodeJS.Timeout;
  private message: string;
  private isActive = false;

  constructor(message: string = 'Loading...') {
    this.message = message;
  }

  /**
   * Start the spinner
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.index = 0;

    // Hide cursor
    process.stdout.write('\x1B[?25l');

    this.interval = setInterval(() => {
      const frame = this.spinner[this.index];
      process.stdout.write(`\r${frame} ${this.message}`);
      this.index = (this.index + 1) % this.spinner.length;
    }, 80);
  }

  /**
   * Stop the spinner
   */
  stop(): void {
    if (!this.isActive) return;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    this.isActive = false;

    // Clear the line and show cursor
    process.stdout.write('\r\x1B[K');
    process.stdout.write('\x1B[?25h');
  }

  /**
   * Update the spinner message
   */
  setMessage(message: string): void {
    this.message = message;
  }

  /**
   * Succeed - stop spinner and show success message
   */
  succeed(message?: string): void {
    this.stop();
    if (message) {
      process.stdout.write(`✓ ${message}\n`);
    }
  }

  /**
   * Fail - stop spinner and show error message
   */
  fail(message?: string): void {
    this.stop();
    if (message) {
      process.stdout.write(`✗ ${message}\n`);
    }
  }

  /**
   * Info - stop spinner and show info message
   */
  info(message: string): void {
    this.stop();
    process.stdout.write(`ℹ ${message}\n`);
  }

  /**
   * Warn - stop spinner and show warning message
   */
  warn(message: string): void {
    this.stop();
    process.stdout.write(`⚠ ${message}\n`);
  }
}

/**
 * Create and start a spinner immediately
 */
export function createSpinner(message: string): LoadingSpinner {
  const spinner = new LoadingSpinner(message);
  spinner.start();
  return spinner;
}

/**
 * Run an async function with a loading spinner
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>
): Promise<T> {
  const spinner = new LoadingSpinner(message);
  spinner.start();

  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}
